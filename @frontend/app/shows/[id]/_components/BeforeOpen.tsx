'use client';

import { Button } from '@/components/atoms';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import dayjs from '@/plugins/dayjs';

export interface OpenCountdown {
  /** KST 날짜 기준 남은 일수, 오픈 시각을 모르면 null */
  dDay: number | null;
  /** 오픈 24시간 전부터 값이 있음 */
  remainingSeconds: number | null;
}

interface Props {
  saleOpenAt?: string;
  /** 서버 시계 동기화 전에는 null */
  countdown: OpenCountdown | null;
}

function formatDDay(dDay: number | null) {
  if (dDay === null) return '—';
  return dDay === 0 ? 'D-DAY' : `D-${dDay}`;
}

function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function BeforeOpen({ saleOpenAt, countdown }: Props) {
  const remainingSeconds = countdown?.remainingSeconds;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full flex-col items-center gap-6 rounded-xl border bg-white px-10 py-12">
        <div className="flex items-stretch gap-4">
          <div className="text-destructive flex min-h-10 flex-col justify-center text-2xl font-semibold">
            <span>{formatDDay(countdown?.dDay ?? null)}</span>
          </div>
          <div className="bg-border w-px shrink-0" aria-hidden />
          <div className="flex flex-col justify-center text-sm">
            <span className="font-medium">티켓 오픈</span>
            <span className="text-muted-foreground">
              {saleOpenAt ? dayjs(saleOpenAt).format(DATE_FORMAT.FULL) : '—'}
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          티켓 오픈 시간은 예고없이 변경될 수 있습니다.
        </p>
      </div>

      <Button className="w-full" disabled>
        {remainingSeconds ? `남은 시간 ${formatCountdown(remainingSeconds)}` : '예매하기'}
      </Button>
    </div>
  );
}
