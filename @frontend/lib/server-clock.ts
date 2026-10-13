'use client';

import { axiosInstance } from '@/lib/api-client';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/** 서버 시각 - 기기 시각(ms)이 들어 있는 구간 */
interface OffsetBounds {
  lo: number;
  hi: number;
}

type ClockStatus = 'syncing' | 'synced' | 'fallback';

const SERVER_TIME_URL = '/api/server-time';
const SAMPLES_PER_SYNC = 3;
const SAMPLE_GAP_MS = 300;
const SAMPLE_GAP_JITTER_MS = 150;
const SYNC_TIMEOUT_MS = 3000;
const SYNC_MIN_INTERVAL_MS = 10_000;
const RESYNC_JITTER_MS = 1000;
const CLOCK_JUMP_THRESHOLD_MS = 1000;
const MAX_REJECTED_SAMPLES = 2;
const TICK_EPSILON_MS = 5;
// 서버·프록시가 Date 문자열을 캐시했다가 초 경계 직후 늦게 갱신하는 경우 허용치
const DATE_HEADER_SLACK_MS = 50;

let status: ClockStatus = 'syncing';
let bounds: OffsetBounds | null = null;
let rejectedCount = 0;
let pendingReset = false;

/** 마지막 틱의 서버 시각(ms), 첫 동기화 전에는 null */
let snapshot: number | null = null;
const listeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let lastTick: { wall: number; perf: number } | null = null;

let syncPromise: Promise<void> | null = null;
let lastSyncAt = -Infinity;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Date 헤더 하나로 시간차 구간 계산
 * - 헤더는 초 단위로 절삭되므로 서버 시각은 [D, D + 1000) 안에 있음
 * - 그 순간의 기기 시각은 요청 시작(startedAt)과 응답 수신(receivedAt) 사이
 */
function getSampleBounds(
  dateHeader: string,
  startedAt: number,
  receivedAt: number,
): OffsetBounds | null {
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs) || receivedAt < startedAt) return null;
  return {
    lo: serverMs - receivedAt,
    hi: serverMs + 1000 + DATE_HEADER_SLACK_MS - startedAt,
  };
}

/** 두 구간의 교집합, 겹치지 않으면 null */
function intersectBounds(a: OffsetBounds, b: OffsetBounds): OffsetBounds | null {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return lo <= hi ? { lo, hi } : null;
}

/** 서버 시각 추정값(ms, 구간 중앙), 동기화 전에는 기기 시계 */
export function getServerNow(): number {
  const offset = bounds ? (bounds.lo + bounds.hi) / 2 : 0;
  return Date.now() + offset;
}

function computeSnapshot() {
  return status === 'syncing' ? null : getServerNow();
}

function isSameSecond(a: number | null, b: number | null) {
  if (a === null || b === null) return a === b;
  return Math.floor(a / 1000) === Math.floor(b / 1000);
}

/**
 * 응답 Date 헤더를 시간차 표본으로 반영
 * @returns 유효한 Date 헤더였는지
 */
function recordServerTimeSample(dateHeader: unknown, startedAt: number, receivedAt: number) {
  if (typeof window === 'undefined' || typeof dateHeader !== 'string') return false;
  const sample = getSampleBounds(dateHeader, startedAt, receivedAt);
  if (!sample) return false;

  const merged = bounds && !pendingReset ? intersectBounds(bounds, sample) : sample;
  if (merged) {
    bounds = merged;
  } else if (rejectedCount + 1 >= MAX_REJECTED_SAMPLES) {
    // 연속으로 어긋나면 기존 구간이 틀린 것으로 보고 교체
    bounds = sample;
  } else {
    rejectedCount += 1;
    return true;
  }
  rejectedCount = 0;
  pendingReset = false;
  status = 'synced';
  refresh();
  return true;
}

// api-client 가 이 파일을 import 하면 서버 코드에 React 훅이 섞여 빌드가 깨지므로 여기서 axios 에 붙음
type TimedRequestConfig = InternalAxiosRequestConfig & { requestStartedAt?: number };

function recordResponseTime(response?: AxiosResponse) {
  const startedAt = (response?.config as TimedRequestConfig | undefined)?.requestStartedAt;
  if (!response || startedAt === undefined) return;
  recordServerTimeSample(response.headers['date'], startedAt, Date.now());
}

axiosInstance.interceptors.request.use((config) => {
  (config as TimedRequestConfig).requestStartedAt = Date.now();
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    recordResponseTime(response);
    return response;
  },
  (error) => {
    recordResponseTime(error?.response);
    return Promise.reject(error);
  },
);

async function fetchServerTimeSample(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const startedAt = Date.now();
    const response = await fetch(SERVER_TIME_URL, { cache: 'no-store', signal: controller.signal });
    return recordServerTimeSample(response.headers.get('date'), startedAt, Date.now());
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runSync() {
  for (let i = 0; i < SAMPLES_PER_SYNC; i++) {
    // 서버 초 경계와 겹치는 위치가 달라지도록 간격을 두고 잼
    if (i > 0) await wait(SAMPLE_GAP_MS + Math.random() * SAMPLE_GAP_JITTER_MS);
    const received = await fetchServerTimeSample();
    if (!received && status === 'syncing') {
      status = 'fallback';
      refresh();
    }
  }
}

export function requestServerClockSync({ force = false } = {}) {
  if (typeof window === 'undefined' || syncPromise) return;
  if (!force && performance.now() - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
  syncPromise = runSync().finally(() => {
    syncPromise = null;
    lastSyncAt = performance.now();
  });
}

/** 기기 시계 변경·절전 복귀 감지: 벽시계와 단조 시계의 경과량 비교 */
function detectClockJump() {
  const now = { wall: Date.now(), perf: performance.now() };
  if (lastTick) {
    const drift = now.wall - lastTick.wall - (now.perf - lastTick.perf);
    if (Math.abs(drift) > CLOCK_JUMP_THRESHOLD_MS) {
      pendingReset = true;
      requestServerClockSync({ force: true });
    }
  }
  lastTick = now;
}

function scheduleTick() {
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = null;
  if (listeners.size === 0) return;

  // 서버 시각의 다음 초 경계에 맞춰 깨움(1초 간격 고정이면 오차가 쌓임)
  const delay = 1000 - (getServerNow() % 1000);
  tickTimer = setTimeout(tick, delay + TICK_EPSILON_MS);
}

function refresh() {
  snapshot = computeSnapshot();
  if (listeners.size === 0) return;
  listeners.forEach((listener) => listener());
  scheduleTick();
}

function tick() {
  detectClockJump();
  refresh();
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  tick();
  // 탭 복귀 요청이 한꺼번에 몰리지 않도록 분산
  setTimeout(() => requestServerClockSync(), Math.random() * RESYNC_JITTER_MS);
}

function handleOnline() {
  requestServerClockSync();
}

function start() {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);
  requestServerClockSync();
  tick();
}

function stop() {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = null;
  lastTick = null;
}

function subscribeServerClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

function getServerClockSnapshot() {
  // 구독 전(첫 렌더)에는 ticker 가 없으므로 초가 바뀌었으면 새로 계산
  if (listeners.size === 0) {
    const next = computeSnapshot();
    if (!isSameSecond(snapshot, next)) snapshot = next;
  }
  return snapshot;
}

type Selector<T> = (serverNowMs: number) => T;

const getServerRenderSnapshot = () => null;

/**
 * 전역 서버 시계 구독
 * - selector 결과가 isEqual 로 같으면 리렌더하지 않음
 * - 서버 렌더·첫 동기화 전에는 null
 */
export function useServerClock<T>(
  selector: Selector<T>,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T | null {
  const cacheRef = useRef<{ serverNowMs: number; selector: Selector<T>; value: T } | null>(null);

  // getSnapshot 은 매번 같은 값을 돌려줘야 무한 렌더가 나지 않음
  const getSelection = useCallback(() => {
    const serverNowMs = getServerClockSnapshot();
    if (serverNowMs === null) return null;

    const cached = cacheRef.current;
    if (cached && cached.serverNowMs === serverNowMs && cached.selector === selector) {
      return cached.value;
    }

    const next = selector(serverNowMs);
    const value = cached && isEqual(cached.value, next) ? cached.value : next;
    cacheRef.current = { serverNowMs, selector, value };
    return value;
  }, [selector, isEqual]);

  return useSyncExternalStore(subscribeServerClock, getSelection, getServerRenderSnapshot);
}
