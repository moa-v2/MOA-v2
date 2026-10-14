'use client';

import { Button } from '@/components/atoms';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import { HEADER_ROUTES, USER_ROUTES } from '@/constants/route/userRoutes';
import { enterQueue, getQueueStatus } from '@/lib/api/queue';
import { getShowDetail } from '@/lib/api/show';
import { useAuth } from '@/lib/auth/AuthContext';
import { loginPathFromHere } from '@/lib/auth/session';
import { confirmScheduleSeats } from '@/lib/api/reservation';
import { getServerNow } from '@/lib/server-clock';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReservationScheduleSidePanel from './ReservationScheduleSidePanel';
import SeatMapCanvas, { type SelectedSeatInfo } from './SeatMapCanvas';

interface ReservationScheduleSelectionProps {
  showId: number;
  initialScheduleKeyId?: number;
  initialSeatsRefetchKey?: number;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
type QueuePhase = 'IDLE' | 'ENTERING' | 'WAITING' | 'READY' | 'EXPIRED' | 'ERROR';

function formatScheduleDisplay(schedule?: ShowCatalog.Schedule | null) {
  if (!schedule) return '-';

  const date = dayjs(schedule.date);
  if (!date.isValid()) return '-';

  const weekdayLabel = WEEKDAY_LABELS[date.day()];
  const time = dayjs(`${schedule.date}T${schedule.time}`);
  const formattedTime = time.isValid() ? time.format('hh:mm A') : String(schedule.time ?? '');

  return `${date.format(DATE_FORMAT.DATE_ONLY)}(${weekdayLabel}) ${formattedTime}`;
}

function formatDurationFromSeconds(valueSeconds: number | null) {
  if (valueSeconds === null || Number.isNaN(valueSeconds)) {
    return '-';
  }

  const totalSeconds = Math.max(0, Math.floor(valueSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function formatNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(value)));
}

export default function ReservationScheduleSelection({
  showId,
  initialScheduleKeyId,
  initialSeatsRefetchKey = 0,
}: ReservationScheduleSelectionProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, isLoading } = useQuery(getShowDetail(showId));

  const [selectedScheduleKeyId, setSelectedScheduleKeyId] = useState<number | null>(
    initialScheduleKeyId ?? null,
  );
  const [sidePanelMode, setSidePanelMode] = useState<'schedule' | 'seat'>('schedule');
  const [phase, setPhase] = useState<QueuePhase>('IDLE');
  const [position, setPosition] = useState<number | null>(null);
  const [estimatedWaitTimeSeconds, setEstimatedWaitTimeSeconds] = useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(1);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeatInfo[]>([]);
  const [sectionPriceMap, setSectionPriceMap] = useState<Record<string, number>>({});
  const [isSubmittingSeatConfirm, setIsSubmittingSeatConfirm] = useState(false);
  const [queueRequestKey, setQueueRequestKey] = useState(0);
  const [seatsRefetchKey, setSeatsRefetchKey] = useState(initialSeatsRefetchKey);
  const handleSectionPriceMapChange = useCallback((nextMap: Record<string, number>) => {
    setSectionPriceMap((prevMap) => {
      const prevKeys = Object.keys(prevMap);
      const nextKeys = Object.keys(nextMap);
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => prevMap[key] === nextMap[key])
      ) {
        return prevMap;
      }
      return nextMap;
    });
  }, []);
  const moveToPaymentPage = useCallback(
    (
      scheduleId: number,
      scheduleSeatIds: string[],
      seatCount: number,
      remainingSeconds: number,
      totalAmount: number,
      showTitle: string,
      scheduleText: string,
      seats: SelectedSeatInfo[],
    ) => {
      const expiresAt = getServerNow() + remainingSeconds * 1000;
      const params = new URLSearchParams({
        showId: String(showId),
        scheduleId: String(scheduleId),
        scheduleSeatIds: scheduleSeatIds.join(','),
        seatCount: String(seatCount),
        remainingSeconds: String(remainingSeconds),
        expiresAt: String(expiresAt),
        totalAmount: String(totalAmount),
        showTitle,
        scheduleText,
        seats: JSON.stringify(
          seats.map((seat) => ({
            seatId: seat.seatId,
            sectionName: seat.sectionName,
            row: seat.row,
            number: seat.number,
            price: seat.price,
          })),
        ),
      });
      router.push(`/shows/reservation/payment?${params.toString()}`);
    },
    [router, showId],
  );

  const schedules = useMemo(() => data?.schedules ?? [], [data?.schedules]);

  useEffect(() => {
    if (schedules.length === 0) return;
    if (
      selectedScheduleKeyId !== null &&
      schedules.some((schedule) => schedule.keyId === selectedScheduleKeyId)
    ) {
      return;
    }
    setSelectedScheduleKeyId(schedules[0].keyId);
  }, [schedules, selectedScheduleKeyId]);

  const selectedSchedule = useMemo(() => {
    if (schedules.length === 0) return null;
    if (selectedScheduleKeyId === null) return schedules[0];
    return schedules.find((schedule) => schedule.keyId === selectedScheduleKeyId) ?? schedules[0];
  }, [schedules, selectedScheduleKeyId]);
  const selectedScheduleDisplayText = useMemo(
    () => formatScheduleDisplay(selectedSchedule),
    [selectedSchedule],
  );
  const isQueueInProgress = phase === 'IDLE' || phase === 'ENTERING' || phase === 'WAITING';
  const isSchedulePanelActive = !isQueueInProgress && sidePanelMode === 'schedule';

  useEffect(() => {
    setPosition(null);
    setEstimatedWaitTimeSeconds(null);
    setRetryAfterSeconds(1);
    setQueueMessage(null);
    setErrorMessage(null);
    setSelectedSeatIds([]);
    setSelectedSeats([]);
    setSectionPriceMap({});
    setIsSubmittingSeatConfirm(false);
    setPhase('IDLE');
  }, [selectedScheduleKeyId, queueRequestKey]);

  useEffect(() => {
    if (phase === 'READY') {
      setSidePanelMode('seat');
      return;
    }
    setSidePanelMode('schedule');
  }, [phase]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace(loginPathFromHere());
    }
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    if (isAuthLoading || !user?.providerId || !selectedScheduleKeyId) return;

    let cancelled = false;

    const run = async () => {
      try {
        setErrorMessage(null);
        setPhase('ENTERING');
        const queueData = await enterQueue({ scheduleId: selectedScheduleKeyId });
        if (cancelled) return;

        setQueueMessage(queueData.message);
        setPosition(queueData.position);
        setEstimatedWaitTimeSeconds(queueData.estimatedWaitTimeSeconds);
        setRetryAfterSeconds(1);

        if (queueData.token) {
          setPhase('READY');
          return;
        }

        setPhase('WAITING');
      } catch {
        if (cancelled) return;
        setPhase('ERROR');
        setErrorMessage('대기열 진입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, queueRequestKey, selectedScheduleKeyId, user?.providerId]);

  useEffect(() => {
    if (phase !== 'WAITING' || !selectedScheduleKeyId) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const pollQueueStatus = async () => {
      try {
        const status = await getQueueStatus(selectedScheduleKeyId);
        if (cancelled) return;

        setQueueMessage(status.message);

        if (status.status === 'WAITING') {
          setPosition(status.position);
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
          setEstimatedWaitTimeSeconds(status.estimatedWaitTimeSeconds);
          setPhase('READY');
          return;
        }

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
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [phase, selectedScheduleKeyId]);

  if (!showId || Number.isNaN(showId)) {
    return (
      <section className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border p-6 text-sm text-slate-600">잘못된 공연 정보입니다.</div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border p-6 text-sm text-slate-600">회차 정보를 불러오는 중입니다...</div>
      </section>
    );
  }

  return (
    <section className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-slate-200 px-5 py-3">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <Link href={USER_ROUTES.HOME} className="font-logo text-lg font-bold tracking-tight text-slate-900">
            MOA
          </Link>
          <Button asChild variant="ghost" className="text-sm text-slate-700">
            <Link href={HEADER_ROUTES.MY_PAGE}>마이페이지</Link>
          </Button>
        </div>
      </header>

      {!isQueueInProgress && (
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{data?.title ?? '공연 정보'}</p>
              <p className="mt-1 text-sm text-slate-600">{formatScheduleDisplay(selectedSchedule)}</p>
            </div>
            <Button variant="outline" onClick={() => setSidePanelMode('schedule')}>
              일정 변경
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-100">
        <div
          className={`mx-auto h-full max-w-[1400px] min-h-0 ${
            isQueueInProgress
              ? 'grid grid-cols-1'
              : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden'
          }`}
        >
          <div className={`${isQueueInProgress ? '' : 'min-h-0 overflow-y-auto'}`}>
            {(phase === 'IDLE' || phase === 'ENTERING') && (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-5 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
                <p className="text-base font-semibold text-slate-900">대기열을 확인하는 중입니다.</p>
              </div>
            )}

            {phase === 'WAITING' && (
              <div className="max-w-3xl p-8 m-auto">
                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                  <p className="text-center font-semibold text-black">나의 대기순서</p>
                  <p className="mt-4 text-center text-2xl font-black tracking-tight text-black">
                    {formatNumber(position)}
                  </p>

                  <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-10 rounded-full bg-violet-500" />
                  </div>

                  <div className="mt-7 border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">현재 대기인원</span>
                      <span className="font-bold text-black">{formatNumber(position)}명</span>
                    </div>
                    <p className="mt-3 text-right text-sm text-slate-500">
                      예상 대기 시간 {formatDurationFromSeconds(estimatedWaitTimeSeconds)} ·{' '}
                      {retryAfterSeconds}초 간격 갱신
                    </p>
                  </div>
                </div>
              </div>
            )}

            {phase === 'READY' && (
              <div className="relative h-full px-5 py-6">
                <SeatMapCanvas
                  scheduleId={selectedScheduleKeyId ?? 0}
                  seatsRefetchKey={seatsRefetchKey}
                  disabled={isSchedulePanelActive}
                  selectedSeatIds={selectedSeatIds}
                  onSelectedSeatIdsChange={setSelectedSeatIds}
                  onSelectedSeatsChange={setSelectedSeats}
                  onSectionPriceMapChange={handleSectionPriceMapChange}
                />
                {isSchedulePanelActive && (
                  <div className="absolute inset-0 rounded-xl bg-black/10" aria-hidden="true" />
                )}
              </div>
            )}

            {(phase === 'EXPIRED' || phase === 'ERROR') && (
              <div className="max-w-3xl p-8  m-auto">
                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                  <p className="text-lg font-semibold text-red-600">
                    {phase === 'EXPIRED' ? '대기열이 만료되었습니다.' : '문제가 발생했습니다.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {phase === 'EXPIRED'
                      ? (queueMessage ?? '대기 시간이 만료되었습니다. 일정을 다시 선택해주세요.')
                      : (errorMessage ?? '요청 처리 중 오류가 발생했습니다.')}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => {
                      setPhase('IDLE');
                    }}
                  >
                    다시 시도
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!isQueueInProgress && (
            <ReservationScheduleSidePanel
              showId={showId}
              schedules={schedules}
              mode={sidePanelMode}
              selectedSeats={selectedSeats}
              sectionPriceMap={sectionPriceMap}
              initialSelectedScheduleKeyId={selectedScheduleKeyId ?? undefined}
              onConfirmSchedule={(scheduleKeyId) => {
                setSelectedScheduleKeyId(scheduleKeyId);
                setSidePanelMode('schedule');
                setQueueRequestKey((prev) => prev + 1);
              }}
              onConfirmSeatSelection={() => {
                if (!selectedScheduleKeyId) return;
                const scheduleSeatIds = selectedSeats.map((seat) => seat.scheduleSeatId);
                const showTitle = data?.title ?? '공연 정보';

                if (scheduleSeatIds.length === 0) {
                  window.alert('선점 가능한 좌석 정보가 없습니다. 좌석을 다시 선택해주세요.');
                  return;
                }

                setIsSubmittingSeatConfirm(true);
                void confirmScheduleSeats(
                  {
                    scheduleId: selectedScheduleKeyId,
                    scheduleSeatIds,
                  },
                )
                  .then((result) => {
                    if (!result.success) {
                      setSeatsRefetchKey((prev) => prev + 1);
                      const data = result.data as { code?: string; conflictSeatIds?: string[] };
                      if (data?.code === 'SEAT_CONFLICT') {
                        const conflictIds = new Set((data.conflictSeatIds ?? []).map((id) => String(id)));
                        setSelectedSeatIds((prev) =>
                          prev.filter((scheduleSeatId) => !conflictIds.has(String(scheduleSeatId))),
                        );
                        setSelectedSeats((prev) =>
                          prev.filter((seat) => !conflictIds.has(String(seat.scheduleSeatId))),
                        );
                        window.alert(result.message ?? '이미 선점된 좌석이 있습니다.');
                        return;
                      }

                      if (data?.code === 'QUEUE_EXPIRED') {
                        setPhase('EXPIRED');
                        window.alert(result.message ?? '토큰이 만료되었거나 유효하지 않습니다.');
                        return;
                      }

                      window.alert(result.message ?? '좌석 확인 중 문제가 발생했습니다.');
                      return;
                    }

                    const successData = result.data as {
                      seatCount?: number;
                      remainingSeconds?: number;
                      totalAmount?: number;
                      message?: string;
                    };
                    if (
                      typeof successData.seatCount !== 'number' ||
                      typeof successData.remainingSeconds !== 'number' ||
                      typeof successData.totalAmount !== 'number'
                    ) {
                      window.alert('좌석 선점 응답이 올바르지 않습니다. 다시 시도해주세요.');
                      return;
                    }
                    moveToPaymentPage(
                      selectedScheduleKeyId,
                      scheduleSeatIds.map(String),
                      successData.seatCount,
                      successData.remainingSeconds,
                      successData.totalAmount,
                      showTitle,
                      selectedScheduleDisplayText,
                      selectedSeats,
                    );
                  })
                  .catch((error: unknown) => {
                    setSelectedSeatIds([]);
                    setSelectedSeats([]);

                    const status = (error as { response?: { status?: number } })?.response?.status;
                    if (status === 409) {
                      setSeatsRefetchKey((prev) => prev + 1);
                      window.alert('이미 선점된 좌석이 있습니다.');
                      return;
                    }
                    setSeatsRefetchKey((prev) => prev + 1);
                    window.alert('좌석 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
                  })
                  .finally(() => {
                    setIsSubmittingSeatConfirm(false);
                  });
              }}
              onCloseSchedulePanel={() => {
                setSidePanelMode('seat');
              }}
              onRemoveSeat={(scheduleSeatId) => {
                setSelectedSeatIds((prev) => prev.filter((id) => id !== scheduleSeatId));
                setSelectedSeats((prev) => prev.filter((seat) => seat.scheduleSeatId !== scheduleSeatId));
              }}
              onClearSeats={() => {
                setSelectedSeatIds([]);
                setSelectedSeats([]);
              }}
              isSubmittingSeatConfirm={isSubmittingSeatConfirm}
            />
          )}
        </div>
      </div>
    </section>
  );
}
