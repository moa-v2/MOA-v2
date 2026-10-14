'use client';

import { Skeleton } from '@/components/atoms';
import { useAlert } from '@/components/molecules/AlertContext';
import { PageCard } from '@/components/molecules/PageCard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cancelReservation, fetchReservationDetail } from '@/lib/api/reservation';
import { fetchShowReservationDetail } from '@/lib/api/admin/reservation';
import dayjs from '@/plugins/dayjs';
import { DATE_UNIT } from '@/constants/common/dateFormat';
import { MY_PAGE_ROUTES } from '@/constants/route/userRoutes';
import ReservationBasicInfo from './ReservationBasicInfo';
import ReservationPaymentInfo from './ReservationPaymentInfo';
import ReservationNotice from './ReservationNotice';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';

/** useQuery에 넘길 상세 조회 옵션 (문서용) */
export type ReservationDetailQueryOptions = {
  queryKey: unknown[];
  queryFn: () => Promise<Reservation.Detail | null | undefined>;
  enabled?: boolean;
};

export interface ReservationDetailProps {
  /** 예매 ID (URL 세그먼트) */
  id: string;
  /**
   * user: 마이페이지 예매 상세 API
   * admin: 어드민 예매 상세 API
   * (서버 컴포넌트에서 함수를 넘길 수 없어 문자열로 구분)
   */
  variant?: 'user' | 'admin';
}

/** 예매 상세 — 조회·취소·목록 이동 */
export default function ReservationDetail({ id, variant = 'user' }: ReservationDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reservationId = Number(id) || -1;
  const isAdmin = variant === 'admin';

  const { confirm } = useAlert();

  const detailQuery = useMemo(
    () =>
      isAdmin ? fetchShowReservationDetail(reservationId) : fetchReservationDetail(reservationId),
    [isAdmin, reservationId],
  );

  const { data, isFetching } = useQuery(detailQuery);
  const { mutateAsync: onCancelReservation, isPending } = useMutation(cancelReservation());

  const loading = isFetching || isPending;

  const cancelDeadline = dayjs(data?.schedule.showDate).subtract(1, DATE_UNIT.DAY);

  const canCancel = useMemo(() => {
    if (!data) return false;
    const notCancelled =
      data.reservationStatus !== 'CANCELLED' && data.payment.paymentStatus !== 'CANCELLED';
    const beforeDeadline = data.schedule?.showDate
      ? dayjs().isSameOrBefore(cancelDeadline, DATE_UNIT.DAY)
      : false;
    return data.canCancel || (notCancelled && beforeDeadline);
  }, [cancelDeadline, data]);

  const handleReservationCancel = async () => {
    if (!data || !canCancel) return;

    const confirmed = await confirm({
      title: '예매 취소',
      description: `${data.show.title} 예매를 취소하시겠습니까?`,
    });
    if (!confirmed) return;

    await onCancelReservation(reservationId);
    await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });

    // '예매 취소' 상태 반영을 위해 딜레이 적용
    setTimeout(() => {
      router.push(isAdmin ? ADMIN_ROUTES.SHOW : MY_PAGE_ROUTES.RESERVATIONS);
    }, 300);
  };

  if (!reservationId) return;

  const detailData = data as unknown as Reservation.Detail;
  return (
    <PageCard>
      {variant === 'admin' && <PageCard.Title useRouteBack={true}>예매내역 상세</PageCard.Title>}

      <PageCard.Content>
        {loading ? (
          <div className="space-y-8">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? (
          <p className="text-slate-500">데이터를 불러올 수 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ReservationBasicInfo data={detailData} />
            <ReservationPaymentInfo
              data={detailData}
              cancelDeadline={cancelDeadline}
              canCancel={canCancel}
              onCancel={handleReservationCancel}
            />
            <ReservationNotice />
          </div>
        )}
      </PageCard.Content>
    </PageCard>
  );
}
