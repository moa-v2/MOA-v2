'use client';

import { SIDEBAR_PHASE, type SidebarPhase } from '@/constants/shows/details';
import { requestServerClockSync, useServerClock } from '@/lib/server-clock';
import dayjs from '@/plugins/dayjs';
import { useCallback, useEffect, useMemo } from 'react';
import ScheduleSelection from './ScheduleSelection';
import BeforeOpen, { type OpenCountdown } from './BeforeOpen';
import { DATE_UNIT } from '@/constants/common/dateFormat';

interface ShowDetailSidebarProps {
  salePeriod: ShowCatalog.SalePeriod;
  schedules?: ShowCatalog.Schedule[];
  onMoveToSeatSelection?: () => void;
}

interface SaleState extends OpenCountdown {
  phase: SidebarPhase;
  isEnded: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 오픈 직전 오차 구간을 다시 좁히는 시점(남은 초)
const FINE_SYNC_SECONDS = [60, 10];

// 서버 일시는 오프셋 없는 KST 라 기기 타임존으로 읽으면 해외에서 시차만큼 틀어짐
function parseKst(dateStr?: string) {
  if (!dateStr || !dayjs(dateStr).isValid()) return null;
  return dayjs.tz(dateStr, 'Asia/Seoul').valueOf();
}

/** KST(UTC+9, 서머타임 없음) 달력 날짜 차이 */
function getKstDayDiff(fromMs: number, toMs: number) {
  const toKstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
  return toKstDay(toMs) - toKstDay(fromMs);
}

function getSaleState(openAtMs: number | null, endAtMs: number | null, nowMs: number): SaleState {
  const isEnded = endAtMs !== null && dayjs(endAtMs).isBefore(nowMs, DATE_UNIT.HOUR);
  if (openAtMs === null) {
    return { phase: SIDEBAR_PHASE.BEFORE_OPEN, dDay: null, remainingSeconds: null, isEnded };
  }
  if (nowMs >= openAtMs) {
    return { phase: SIDEBAR_PHASE.AFTER_OPENING, dDay: 0, remainingSeconds: null, isEnded };
  }

  const remainingMs = openAtMs - nowMs;
  return {
    phase: SIDEBAR_PHASE.BEFORE_OPEN,
    dDay: getKstDayDiff(nowMs, openAtMs),
    // 24시간 전부터만 초 단위 값을 내려야 그 전에는 매초 리렌더하지 않음
    remainingSeconds: remainingMs > DAY_MS ? null : Math.ceil(remainingMs / 1000),
    isEnded,
  };
}

function isSameSaleState(a: SaleState, b: SaleState) {
  return (
    a.phase === b.phase &&
    a.dDay === b.dDay &&
    a.remainingSeconds === b.remainingSeconds &&
    a.isEnded === b.isEnded
  );
}

export default function ShowDetailSidebar({ salePeriod, schedules = [] }: ShowDetailSidebarProps) {
  const openAtMs = useMemo(() => parseKst(salePeriod.startDate), [salePeriod.startDate]);
  const endAtMs = useMemo(() => parseKst(salePeriod.endDate), [salePeriod.endDate]);
  const selectSaleState = useCallback(
    (nowMs: number) => getSaleState(openAtMs, endAtMs, nowMs),
    [openAtMs, endAtMs],
  );
  const sale = useServerClock(selectSaleState, isSameSaleState);

  const remaining = sale?.remainingSeconds ?? null;
  const fineSyncStage =
    remaining === null ? 0 : FINE_SYNC_SECONDS.filter((seconds) => remaining <= seconds).length;

  useEffect(() => {
    if (fineSyncStage > 0) requestServerClockSync();
  }, [fineSyncStage]);

  return (
    <aside className="w-full shrink-0 lg:w-[320px]">
      <div className="sticky top-4 flex flex-col gap-3">
        {sale?.isEnded ? (
          <div className="bg-card text-muted-foreground rounded-lg border p-22 text-center text-sm">
            해당 공연의 모든 회차가 종료되었습니다.
          </div>
        ) : sale?.phase === SIDEBAR_PHASE.AFTER_OPENING ? (
          <ScheduleSelection schedules={schedules} />
        ) : (
          <BeforeOpen saleOpenAt={salePeriod.startDate} countdown={sale} />
        )}
      </div>
    </aside>
  );
}
