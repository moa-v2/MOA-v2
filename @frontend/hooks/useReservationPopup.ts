'use client';

import { checkAuthLogin } from '@/lib/api/auth/auth';
import { useAuth } from '@/lib/auth/AuthContext';
import { loginPathFromHere } from '@/lib/auth/session';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export interface ReservationPopupShowInfo {
  showId: number | string;
  scheduleId?: number | string;
  title?: string;
  showDate?: string;
}

export interface OpenReservationPopupOptions {
  width?: number;
  height?: number;
  popupName?: string;
}

export function useReservationPopup() {
  const router = useRouter();
  const { user } = useAuth();

  const runPreprocess = useCallback(async (): Promise<boolean> => {
    if (!user) {
      router.replace(loginPathFromHere());
      return false;
    }

    // 로그인 상태 확인
    const isLoggedIn = await checkAuthLogin();
    if (!isLoggedIn) {
      router.replace(loginPathFromHere());
      return false;
    }

    return true;
  }, [router, user]);

  const openReservationPopup = useCallback(
    async (
      showInfo: ReservationPopupShowInfo,
      options?: OpenReservationPopupOptions,
    ): Promise<Window | null> => {
      const preprocessPassed = await runPreprocess();
      if (!preprocessPassed) {
        return null;
      }

      const params = new URLSearchParams({
        showId: String(showInfo.showId),
      });

      if (showInfo.scheduleId !== undefined) {
        params.set('scheduleId', String(showInfo.scheduleId));
      }
      if (showInfo.title) {
        params.set('title', showInfo.title);
      }
      if (showInfo.showDate) {
        params.set('showDate', showInfo.showDate);
      }

      const width = options?.width ?? 1200;
      const height = options?.height ?? 900;
      const left = window.screenX + Math.max(0, Math.floor((window.outerWidth - width) / 2));
      const top = window.screenY + Math.max(0, Math.floor((window.outerHeight - height) / 2));

      const popup = window.open(
        `/shows/reservation?${params.toString()}`,
        options?.popupName ?? 'show-reservation',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      );

      popup?.focus();
      return popup;
    },
    [runPreprocess],
  );

  return { openReservationPopup };
}
