// API 클라이언트 (axios + 환경별 엔드포인트 분기)
// 개발 환경: 직접 백엔드 API 호출 (네트워크 탭에서 확인 가능)
// 프로덕션 환경: Next.js API Routes를 통해 호출 (백엔드 API 노출 방지)

import type { AlertOptions } from '@/components/molecules/AlertContext';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { createStore } from 'zustand/vanilla';

type RouterLike = {
  back: () => void;
};

// axios 인스턴스 설정
export const axiosInstance: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// axios interceptor
let globalRouter: RouterLike | null = null;
let globalAlert: ((options: AlertOptions) => void) | null = null;
let globalOnUnauthorized: (() => void) | null = null;

export const setGlobalRouter = (router: RouterLike | null) => (globalRouter = router);
export const setGlobalAlertHandler = (handler: (options: AlertOptions) => void) =>
  (globalAlert = handler);
export const setGlobalOnUnauthorized = (handler: (() => void) | null) =>
  (globalOnUnauthorized = handler);

const getSafeErrorPayload = (error: unknown) => {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof responseData === 'string') {
    const normalized = responseData.trim();
    const isHtmlResponse = normalized.startsWith('<!DOCTYPE html') || normalized.startsWith('<html');
    if (isHtmlResponse) {
      return 'HTML error response received (body omitted)';
    }
    return normalized.slice(0, 300);
  }
  return responseData ?? (error as { message?: string })?.message ?? 'Unknown error';
};

// 중계 라우트가 백엔드 대신 데모 데이터로 응답 중인지(x-demo-data 헤더)
export const demoModeStore = createStore(() => ({ active: false }));

const syncDemoMode = (response?: AxiosResponse) => {
  if (!response) return;
  const active = response.headers['x-demo-data'] === '1';
  if (demoModeStore.getState().active !== active) demoModeStore.setState({ active });
};

axiosInstance.interceptors.response.use(
  (response) => {
    syncDemoMode(response);
    return response;
  },
  async (error) => {
    syncDemoMode(error?.response);
    const method = (error as { config?: { method?: string } })?.config?.method?.toUpperCase() ?? 'UNKNOWN';
    const url = (error as { config?: { url?: string } })?.config?.url ?? 'UNKNOWN_URL';
    const status = (error as { response?: { status?: number } })?.response?.status ?? 'NO_STATUS';
    console.error(`API Error [${method} ${url}] (${status})`, getSafeErrorPayload(error));

    if (error.response?.status === 401) {
      // 로그인 여부 확인 요청은 401 글로벌 리다이렉트 제외
      const isAuthCheckRequest =
        (error.config?.method?.toLowerCase() === 'get' &&
          (error.config?.url?.includes('users/me') ?? false)) ||
        (error.config?.method?.toLowerCase() === 'post' &&
          (error.config?.url?.includes('/auth/verification-status') ?? false));
      if (!isAuthCheckRequest) {
        globalOnUnauthorized?.();
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 404) {
      const message = error.response?.data?.message || '요청한 데이터를 찾을 수 없습니다';
      const confirmed = globalAlert?.({ title: '404 Error', description: message });
      if (confirmed) globalRouter?.back();
    }

    return Promise.reject(error);
  },
);
