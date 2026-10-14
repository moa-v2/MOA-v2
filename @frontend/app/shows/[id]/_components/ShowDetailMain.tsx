'use client';

import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@/components/atoms';
import { getGenreLabel, getRegionLabel } from '@/lib/common/labels';
import Image from 'next/image';
import { Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StatusBadge from '@/components/molecules/StatusBadge';
import { ShowStatus } from '@shared/enums';
import dayjs from '@/plugins/dayjs';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import { usePathname } from 'next/navigation';

interface Props {
  show: ShowCatalog.Detail;
}

export default function ShowDetailMain({ show }: Props) {
  const { title, genre, posterUrl, location, startDate, endDate, runningTime, cast, status } = show;
  const pathname = usePathname();
  const [shareUrl, setShareUrl] = useState('');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setShareUrl(`${window.location.origin}${pathname}`);
  }, [pathname]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMessage('주소가 복사되었습니다.\n원하는 곳에 붙여넣기(Ctrl+V)해주세요.');
    } catch {
      setCopyMessage('복사에 실패했습니다. 다시 시도해주세요.');
    }
  }, [shareUrl]);

  const renderSharePopover = () => (
    <Popover onOpenChange={(open) => !open && setCopyMessage(null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hover:text-foreground flex items-center gap-1 pr-2"
          aria-label="공유"
        >
          <Share2 className="h-4 w-4" />
          공유
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(340px,calc(100vw-2rem))]">
        <div className="space-y-3">
          {!copyMessage ? (
            <div className="flex items-center gap-2">
              <p
                className="bg-muted min-w-0 flex-1 rounded px-2 py-2 text-sm break-all"
                title={shareUrl}
              >
                {shareUrl || '…'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleCopy}
              >
                복사
              </Button>
            </div>
          ) : (
            <p className={'text-muted-foreground text-center text-sm whitespace-pre-line'}>
              {copyMessage}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  const detailRows = useMemo(
    () =>
      [
        { label: '장르', value: getGenreLabel(genre) },
        { label: '지역', value: getRegionLabel(location.region) },
        { label: '장소', value: location.venue },
        { label: '공연장', value: location.hallName },
        {
          label: '공연기간',
          value: `${dayjs(startDate).format(DATE_FORMAT.DATE_ONLY)} - ${dayjs(endDate).format(DATE_FORMAT.DATE_ONLY)}`,
        },
        { label: '관람시간', value: runningTime },
        { label: '출연진', value: cast },
      ].filter(
        (row): row is { label: string; value: string } => row.value != null && row.value !== '',
      ),
    [genre, location, startDate, endDate, runningTime, cast],
  );

  return (
    <section className="space-y-6">
      {/* 상단: 제목 영역 */}
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{getGenreLabel(genre)}</Badge>
          <StatusBadge type="show" status={status as ShowStatus} />
        </div>
        <h1 className="mt-4 text-xl leading-tight font-bold md:text-2xl">{title}</h1>
      </div>

      {/* 좌측 포스터 | 우측 상세정보 */}
      <div className="grid w-full gap-6 lg:grid-cols-[380px_1fr]">
        {/* 좌측 포스터 */}
        <div className="min-w-0 space-y-3">
          <div className="bg-muted relative aspect-3/4 w-full overflow-hidden rounded-lg">
            {posterUrl ? (
              // 화면에서 가장 큰 요소(LCP)라 지연 로딩하지 않고 먼저 받음
              <Image
                src={posterUrl}
                alt={title}
                fill
                preload
                fetchPriority="high"
                className="object-cover"
                sizes="380px"
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                포스터 없음
              </div>
            )}
          </div>
          <div className="text-muted-foreground flex items-center justify-end gap-2">
            {renderSharePopover()}
          </div>
        </div>

        {/* 우측 공연 상세 정보 */}
        <div className="min-w-0 space-y-4 rounded-lg bg-white p-4">
          <dl className="grid gap-5 text-base leading-relaxed">
            {detailRows.map(({ label, value }) => (
              <div key={label} className="flex gap-3">
                <dt className="text-muted-foreground w-28 shrink-0 font-medium">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
