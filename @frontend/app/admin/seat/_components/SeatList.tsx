'use client';

import { Button, Skeleton } from '@/components/atoms';
import { PageCard } from '@/components/molecules/PageCard';
import { BaseTable, type BaseTableColumn } from '@/components/organisms';
import { REGION_LABELS } from '@/constants/common';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import { labelKeys, labelOptions, toFilterValues } from '@/lib/admin/table-filter';
import {
  oneOfParam,
  pageParam,
  pageSizeParam,
  textParam,
  useTableParams,
} from '@/lib/admin/table-params';
import { getSeatMapList } from '@/lib/api/admin/seat';
import { useQuery } from '@tanstack/react-query';
import dayjs from '@/plugins/dayjs';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

// 주소 쿼리 (예: /admin/seat?region=SEOUL&q=예술의전당)
const seatListSchema = z.object({
  page: pageParam,
  size: pageSizeParam,
  q: textParam,
  field: oneOfParam(['venueName', 'hallName']),
  region: oneOfParam(labelKeys(REGION_LABELS)),
});

const FILTER_OPTIONS = { region: labelOptions(REGION_LABELS) };

export default function SeatList() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { params: query, setParams, isDefault, resetParams } = useTableParams(seatListSchema);

  const params: Seat.ListParams = useMemo(
    () => ({
      page: query.page - 1,
      size: query.size,
      ...(query.q && query.field === 'hallName' && { hallName: query.q }),
      ...(query.q && query.field !== 'hallName' && { venueName: query.q }),
      ...(query.region && { region: query.region }),
    }),
    [query],
  );

  const { data, isFetching } = useQuery(getSeatMapList(params));
  const seatList = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const columns: BaseTableColumn<Seat.List>[] = [
    { key: 'seatMapId', label: '번호' },
    {
      key: 'region',
      label: '지역',
      render: (seat) => REGION_LABELS[seat.region as keyof typeof REGION_LABELS] ?? seat.region,
      filter: true,
      filterOptions: FILTER_OPTIONS.region,
    },
    { key: 'venueName', label: '공연장명', search: true },
    { key: 'hallName', label: '홀명', search: true },
    {
      key: 'createdAt',
      label: '등록일',
      render: (seat) => dayjs(seat.createdAt).format(DATE_FORMAT.DATE_ONLY),
    },
    {
      key: 'updatedAt',
      label: '수정일',
      render: (seat) => dayjs(seat.updatedAt).format(DATE_FORMAT.DATE_ONLY),
    },
  ];

  return (
    <PageCard>
      <PageCard.Title useRouteBack={false}>좌석 목록</PageCard.Title>
      <PageCard.Content>
        {!mounted ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <BaseTable
            data={seatList}
            columns={columns}
            searchKeyword={query.q}
            searchColumn={query.field}
            onSearch={(keyword, field) =>
              setParams({ q: keyword.trim(), field: field === 'all' ? undefined : field })
            }
            filterValues={toFilterValues({ region: query.region })}
            onFilter={(key, values) => setParams({ [key]: values[0] })}
            page={query.page - 1}
            canReset={!isDefault}
            onReset={resetParams}
            totalPages={totalPages}
            pageSize={query.size}
            onPageChange={(page) => setParams({ page: page + 1 })}
            onPageSizeChange={(size) => setParams({ size })}
            isLoading={isFetching}
            headerActions={
              <Button onClick={() => router.push(ADMIN_ROUTES.SEAT + '/upsert')} size="sm">
                좌석 등록
              </Button>
            }
            emptyMessage="등록된 좌석 배치도가 없습니다."
          />
        )}
      </PageCard.Content>
    </PageCard>
  );
}
