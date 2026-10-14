'use client';

import { enterQueue, getQueueStatus } from '@/lib/api/queue';
import { getShowDetail } from '@/lib/api/show';
import { useAuth } from '@/lib/auth/AuthContext';
import { loginPathFromHere } from '@/lib/auth/session';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface QueueWaitingScreenProps {
  showId: number;
  scheduleId: number;
  title?: string | null;
  showDate?: string | null;
}

const formatDurationFromSeconds = (valueSeconds: number | null) => {
  if (valueSeconds === null || Number.isNaN(valueSeconds)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.floor(valueSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  }
  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }
  return `${seconds}초`;
};

const formatNumber = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(value)));
};

export default function QueueWaitingScreen({
  showId,
  scheduleId,
  title,
  showDate,
}: QueueWaitingScreenProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { data: showDetail } = useQuery(getShowDetail(showId));
  const [queueToken, setQueueToken] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaitingCount, setTotalWaitingCount] = useState<number | null>(null);
  const [estimatedWaitTimeSeconds, setEstimatedWaitTimeSeconds] = useState<number | null>(null);
  const [phase, setPhase] = useState<'IDLE' | 'ENTERING' | 'WAITING' | 'READY' | 'EXPIRED' | 'ERROR'>(
    'IDLE',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(1);
  const queryTitle = title?.trim();
  const displayTitle = queryTitle && queryTitle !== '-' ? queryTitle : (showDetail?.title ?? '공연');

  const handleEnterQueue = useCallback(
    async () => {
      if (!showId || Number.isNaN(showId) || !scheduleId || Number.isNaN(scheduleId)) {
        setPhase('ERROR');
        setErrorMessage('공연 또는 스케줄 식별자가 없습니다.');
        return;
      }
      if (!user?.providerId) {
        router.replace(loginPathFromHere());
        return;
      }

      try {
        setErrorMessage(null);
        setPhase('ENTERING');
        const queueData = await enterQueue({
          scheduleId,
        });

        setQueueMessage(queueData.message);
        setPosition(queueData.position);
        setTotalWaitingCount(queueData.position);
        setEstimatedWaitTimeSeconds(queueData.estimatedWaitTimeSeconds);
        setRetryAfterSeconds(1);

        if (queueData.token) {
          setQueueToken(queueData.token);
          setPhase('READY');
          return;
        }

        setPhase('WAITING');
      } catch {
        setPhase('ERROR');
        setErrorMessage('대기열 진입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    },
    [router, scheduleId, showId, user?.providerId],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(loginPathFromHere());
      return;
    }
    void handleEnterQueue();
  }, [handleEnterQueue, isLoading, router, user]);

  useEffect(() => {
    if (phase !== 'WAITING') return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const pollQueueStatus = async () => {
      try {
        const status = await getQueueStatus(scheduleId);
        if (cancelled) return;

        setQueueMessage(status.message);

        if (status.status === 'WAITING') {
          setPosition(status.position);
          setTotalWaitingCount((prev) => {
            if (status.position === null || Number.isNaN(status.position)) return prev;
            if (prev === null || Number.isNaN(prev)) return status.position;
            return Math.max(prev, status.position);
          });
          setEstimatedWaitTimeSeconds(status.estimatedWaitTimeSeconds);
          setRetryAfterSeconds(status.retryAfterSeconds);
          timeoutId = window.setTimeout(
            () => {
              void pollQueueStatus();
            },
            Math.max(1, status.retryAfterSeconds) * 1000,
          );
          return;
        }

        if (status.status === 'READY') {
          setPosition(status.position);
          setTotalWaitingCount((prev) => {
            if (status.position === null || Number.isNaN(status.position)) return prev;
            if (prev === null || Number.isNaN(prev)) return status.position;
            return Math.max(prev, status.position);
          });
          setEstimatedWaitTimeSeconds(status.estimatedWaitTimeSeconds);
          setQueueToken(status.token);
          setPhase('READY');
          return;
        }

        setQueueToken(null);
        setPhase('EXPIRED');
      } catch {
        if (!cancelled) {
          setPhase('ERROR');
          setErrorMessage('대기열 상태 조회에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
      }
    };

    void pollQueueStatus();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [phase, scheduleId]);

  if (phase === 'IDLE' || phase === 'ENTERING') {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f3f3f3] p-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-slate-500" />
          <div className="space-y-2">
            <p className="text-2xl font-bold text-black">예매 화면을 불러오는 중입니다.</p>
            <p className="text-2xl font-bold text-violet-600">조금만 기다려주세요.</p>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'WAITING') {
    const normalizedPosition = typeof position === 'number' ? Math.max(1, position) : null;
    const normalizedTotal =
      typeof totalWaitingCount === 'number' ? Math.max(normalizedPosition ?? 1, totalWaitingCount) : null;
    const progressPercent =
      normalizedPosition && normalizedTotal
        ? Math.min(100, Math.max(0, ((normalizedTotal - normalizedPosition + 1) / normalizedTotal) * 100))
        : 4;

    return (
      <section className="flex min-h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-3xl m-auto">
          <div className="space-y-2">
            <p className="text-2xl font-bold text-black">접속 인원이 많아 대기 중입니다.</p>
            <p className="text-2xl font-bold text-violet-600">조금만 기다려주세요.</p>
            <p className="pt-2 text-slate-700">
              {displayTitle}
              {showDate ? ` · ${showDate}` : ''}
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-center font-semibold text-black">나의 대기순서</p>
            <p className="mt-4 text-center text-2xl font-black tracking-tight text-black">
              {formatNumber(position)}
            </p>

            <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-7 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">현재 대기인원</span>
                <span className="font-bold text-black">{formatNumber(position)}명</span>
              </div>
              <p className="mt-3 text-right text-sm text-slate-500">
                예상 대기 시간 {formatDurationFromSeconds(estimatedWaitTimeSeconds)} · {retryAfterSeconds}초
                간격 갱신
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'READY') {
    return (
      <section className="m-auto max-w-3xl space-y-4 p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-black">입장 가능합니다.</p>
          <p className="mt-2 text-sm text-slate-600">
            입장 토큰이 발급되었습니다. 회차 선택 단계로 이동해 주세요.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/shows/reservation/schedule?showId=${showId}&scheduleId=${scheduleId}`)}
              className="inline-flex items-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90"
            >
              회차 선택으로 이동
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              현재 창 종료
            </button>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">queueToken: {queueToken ?? '-'}</p>
        </div>
      </section>
    );
  }

  if (phase === 'EXPIRED') {
    return (
      <section className="m-auto flex min-h-screen max-w-3xl flex-col justify-center space-y-4 p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-2xl font-semibold text-violet-600">대기열이 만료되었습니다.</p>
          <p className="mt-2 text-sm text-slate-600">
            {queueMessage ?? '대기 시간이 만료되었습니다. 다시 대기열에 진입해주세요.'}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleEnterQueue()}
              className="inline-flex items-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90"
            >
              대기열 재진입
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              현재 창 종료
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'ERROR') {
    return (
      <section className="m-auto max-w-3xl space-y-4 p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-red-600">문제가 발생했습니다.</p>
          <p className="mt-2 text-sm text-slate-600">
            {errorMessage ?? '요청 처리 중 오류가 발생했습니다.'}
          </p>
          <button
            type="button"
            onClick={() => void handleEnterQueue()}
            className="mt-5 inline-flex items-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90"
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  return null;
}
