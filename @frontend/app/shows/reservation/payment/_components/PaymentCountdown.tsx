'use client';

import { getServerNow, useServerClock } from '@/lib/server-clock';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PaymentCountdownProps {
  /** 결제 마감 시각(서버 시계 기준 epoch ms) */
  expiresAt: number;
  fallbackRemainingSeconds?: number;
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PaymentCountdown({
  expiresAt,
  fallbackRemainingSeconds = 0,
}: PaymentCountdownProps) {
  const [fallbackExpiresAt] = useState(
    () => getServerNow() + Math.max(0, fallbackRemainingSeconds) * 1000,
  );
  const deadline = expiresAt > 0 ? expiresAt : fallbackExpiresAt;

  // 1초씩 깎으면 백그라운드 탭에서 타이머가 늦어진 만큼 시간이 남은 것처럼 보임
  const selectRemaining = useCallback(
    (nowMs: number) => Math.max(0, Math.ceil((deadline - nowMs) / 1000)),
    [deadline],
  );
  const remainingSeconds = useServerClock(selectRemaining);
  const isExpiredHandledRef = useRef(false);

  useEffect(() => {
    if (remainingSeconds !== 0 || isExpiredHandledRef.current) return;
    isExpiredHandledRef.current = true;
    window.alert('결제 가능 시간이 종료되었습니다.');
    window.close();
  }, [remainingSeconds]);

  return (
    <p className="text-sm font-semibold text-slate-800">
      결제 가능 시간{' '}
      <span className="text-primary">
        {remainingSeconds === null ? '-:--' : formatCountdown(remainingSeconds)}
      </span>
    </p>
  );
}
