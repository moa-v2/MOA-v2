'use client';

import { Button } from '@/components/atoms';
import { getShowCatalogList } from '@/lib/api/show';
import { getServerNow, useServerClock } from '@/lib/server-clock';
import dayjs from '@/plugins/dayjs';
import { useQuery } from '@tanstack/react-query';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

// 아래 '장르별 인기공연'과 같은 조회라 요청은 한 번만 나감
const POPULAR_PARAMS: ShowCatalog.ListParams = {
  page: 0,
  size: 20,
  orderBy: 'viewCount',
  orderDirection: 'desc',
};
const SLIDE_COUNT = 3;

const toKstMs = (value: string) => dayjs.tz(value, 'Asia/Seoul').valueOf();

function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}

function HeroSlide({
  show,
  openAtMs,
  priority,
}: {
  show: ShowCatalog.List;
  openAtMs: number;
  priority: boolean;
}) {
  const selectRemaining = useCallback(
    (nowMs: number) => Math.max(0, Math.ceil((openAtMs - nowMs) / 1000)),
    [openAtMs],
  );
  const remaining = useServerClock(selectRemaining);
  // 서버 시계를 맞추기 전에는 기기 시계로 대략 판단
  const isUpcoming = remaining === null ? openAtMs > getServerNow() : remaining > 0;

  return (
    <section className="relative h-120 min-w-full overflow-hidden bg-slate-950">
      {show.posterUrl && (
        <Image
          src={show.posterUrl}
          alt=""
          fill
          sizes="100vw"
          priority={priority}
          className="scale-110 object-cover opacity-60 blur-2xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
      <div className="relative container mx-auto flex h-full items-center justify-between gap-12 px-6 lg:px-16">
        <div className="max-w-xl space-y-5 text-white">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            {isUpcoming
              ? `티켓 오픈 ${dayjs(openAtMs).tz('Asia/Seoul').format('M월 D일 (ddd) HH:mm')}`
              : '지금 예매 중'}
          </span>
          <h2 className="text-3xl leading-tight font-bold md:text-5xl">{show.title}</h2>
          <p className="text-white/80">
            {show.startDate} ~ {show.endDate} · {show.location.venue} {show.location.hallName}
          </p>
          {isUpcoming && remaining !== null && (
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-white/70">티켓 오픈까지</span>
              <span className="text-4xl font-bold tabular-nums">{formatCountdown(remaining)}</span>
            </div>
          )}
          <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-white/90">
            <Link href={`/shows/${show.id}`}>
              {isUpcoming ? '공연 정보 보기' : '예매하러 가기'}
            </Link>
          </Button>
        </div>
        {show.posterUrl && (
          <div className="relative hidden aspect-3/4 h-96 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 md:block">
            <Image
              src={show.posterUrl}
              alt={show.title}
              fill
              sizes="288px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** 메인 배너: 판매 시작 전 공연(카운트다운)을 먼저, 남는 자리는 인기 공연으로 채움 */
export default function MainHeroBanner() {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);
  const { data, isPending } = useQuery(getShowCatalogList(POPULAR_PARAMS));

  const slides = useMemo(() => {
    const now = getServerNow();
    return (data?.content ?? [])
      .map((show) => ({ show, openAtMs: toKstMs(show.salePeriod.startDate) }))
      .sort((a, b) => Number(b.openAtMs > now) - Number(a.openAtMs > now))
      .slice(0, SLIDE_COUNT);
  }, [data]);

  // 백엔드가 꺼져 있으면 데모 응답으로 넘어가기까지 몇 초 걸림
  if (isPending) {
    return (
      <div className="flex h-120 flex-col items-center justify-center gap-3 bg-slate-900">
        <Loader2 className="h-7 w-7 animate-spin text-white/60" />
        <p className="text-sm text-white/60">공연 정보를 불러오는 중입니다.</p>
      </div>
    );
  }
  if (slides.length === 0) return null;

  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {slides.map(({ show, openAtMs }, index) => (
          <HeroSlide key={show.id} show={show} openAtMs={openAtMs} priority={index === 0} />
        ))}
      </div>
    </div>
  );
}
