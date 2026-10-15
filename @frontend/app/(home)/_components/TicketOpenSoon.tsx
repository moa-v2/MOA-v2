'use client';

import { Skeleton } from '@/components/atoms';
import { getShowCatalogList } from '@/lib/api/show';
import { formatCountdown, getKstDayDiff, kstToMs } from '@/lib/common/date';
import { getGenreLabel } from '@/lib/common/labels';
import { getServerNow, useServerClock } from '@/lib/server-clock';
import dayjs from '@/plugins/dayjs';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

// 백엔드 목록에 '판매 시작 전' 조건이 없어 최근 등록한 공연에서 고름(오픈 예정 공연은 대개 최근 등록)
const RECENT_PARAMS: ShowCatalog.ListParams = { page: 0, size: 50 };
const MAX_ITEMS = 6;
const DAY_SECONDS = 24 * 60 * 60;

type OpenState =
  | { phase: 'countdown'; seconds: number }
  | { phase: 'dday'; days: number }
  | { phase: 'open' };

const isSameOpenState = (a: OpenState, b: OpenState) => JSON.stringify(a) === JSON.stringify(b);

/** 24시간 안이면 남은 시간, 그 전에는 D-day, 열리면 '예매 중' */
function OpenBadge({ openAtMs }: { openAtMs: number }) {
  const selectState = useCallback(
    (nowMs: number): OpenState => {
      const seconds = Math.ceil((openAtMs - nowMs) / 1000);
      if (seconds <= 0) return { phase: 'open' };
      if (seconds <= DAY_SECONDS) return { phase: 'countdown', seconds };
      return { phase: 'dday', days: getKstDayDiff(nowMs, openAtMs) };
    },
    [openAtMs],
  );
  const state = useServerClock(selectState, isSameOpenState);

  if (!state) return null;
  if (state.phase === 'countdown') {
    return (
      <span className="text-destructive font-bold tabular-nums">
        {formatCountdown(state.seconds)}
      </span>
    );
  }
  if (state.phase === 'dday') {
    return (
      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
        D-{state.days}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
      예매 중
    </span>
  );
}

/** 메인: 판매 시작 전 공연을 오픈이 가까운 순서로 */
export default function TicketOpenSoon() {
  const { data, isPending } = useQuery(getShowCatalogList(RECENT_PARAMS));

  const shows = useMemo(() => {
    const now = getServerNow();
    return (data?.content ?? [])
      .map((show) => ({ show, openAtMs: kstToMs(show.salePeriod.startDate) }))
      .filter(({ openAtMs }) => openAtMs > now)
      .sort((a, b) => a.openAtMs - b.openAtMs)
      .slice(0, MAX_ITEMS);
  }, [data]);

  if (!isPending && shows.length === 0) return null;

  return (
    <section aria-labelledby="ticket-open-soon-title" className="mb-16">
      <h2 id="ticket-open-soon-title" className="mb-8 text-2xl font-bold">
        티켓 오픈 예정
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-36 w-full rounded-xl" />
              </li>
            ))
          : shows.map(({ show, openAtMs }) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="group flex h-full gap-4 rounded-xl border bg-white p-3 transition-colors hover:border-slate-400"
                >
                  <div className="bg-muted relative aspect-3/4 w-20 shrink-0 overflow-hidden rounded-md">
                    {show.posterUrl && (
                      <Image
                        src={show.posterUrl}
                        alt={show.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-1">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">{getGenreLabel(show.genre)}</p>
                      <p className="line-clamp-2 font-semibold group-hover:underline">
                        {show.title}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {show.location.venue} {show.location.hallName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                      <span className="whitespace-nowrap">
                        {dayjs(openAtMs).tz('Asia/Seoul').format('M월 D일 (ddd) HH:mm')} 오픈
                      </span>
                      <OpenBadge openAtMs={openAtMs} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
