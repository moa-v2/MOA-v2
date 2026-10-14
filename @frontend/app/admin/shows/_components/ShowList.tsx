'use client';

import { Button, Skeleton } from '@/components/atoms';
import { useAlert } from '@/components/molecules/AlertContext';
import { changeSaleStatus, deleteShow, getShowList } from '@/lib/api/admin/show';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { PageCard } from '@/components/molecules/PageCard';
import { BaseTable, type BaseTableColumn } from '@/components/organisms';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import StatusBadge from '@/components/molecules/StatusBadge';
import { GENRE_LABELS, SALE_STATUS_LABELS, SHOW_STATUS_LABELS } from '@/constants/common';
import dayjs from '@/plugins/dayjs';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import Link from 'next/link';
import { ToggleDropdown, ToggleItem } from '@/components/molecules/ToggleDropdown';
import { labelKeys, labelOptions, toFilterValues } from '@/lib/admin/table-filter';
import {
  oneOfParam,
  pageParam,
  pageSizeParam,
  parseSort,
  sortParam,
  textParam,
  toSortParam,
  useTableParams,
} from '@/lib/admin/table-params';

// 주소 쿼리 (예: /admin/shows?page=2&genre=MUSICAL&sort=title.asc)
const showListSchema = z.object({
  page: pageParam,
  size: pageSizeParam,
  sort: sortParam(['id', 'title', 'schedule', 'salePeriod']),
  q: textParam,
  field: oneOfParam(['title']),
  status: oneOfParam(labelKeys(SHOW_STATUS_LABELS)),
  saleStatus: oneOfParam(labelKeys(SALE_STATUS_LABELS)),
  genre: oneOfParam(labelKeys(GENRE_LABELS)),
});

const FILTER_OPTIONS = {
  status: labelOptions(SHOW_STATUS_LABELS),
  saleStatus: labelOptions(SALE_STATUS_LABELS),
  genre: labelOptions(GENRE_LABELS),
};

export default function ShowList() {
  const router = useRouter();
  const { confirm, alert } = useAlert();

  const [mounted, setMounted] = useState(false);

  const { params: query, setParams, isDefault, resetParams } = useTableParams(showListSchema);
  const sort = parseSort(query.sort);

  const params: Show.ListParams = useMemo(() => {
    const { column, order } = parseSort(query.sort);
    return {
      page: query.page - 1,
      size: query.size,
      ...(column && { sort: `${column},${order}` }),
      ...(query.q && { keyword: query.q }),
      ...(query.status && { showStatus: query.status }),
      ...(query.saleStatus && { saleStatus: query.saleStatus }),
      ...(query.genre && { genre: query.genre }),
    };
  }, [query]);

  const { data, isFetching, refetch } = useQuery(getShowList(params));
  const { mutateAsync: onDeleteShow, isPending: isDeletePending } = useMutation(deleteShow());
  const { mutateAsync: onChangeSaleStatus, isPending: isSaleStatusPending } =
    useMutation(changeSaleStatus());

  const loading = isFetching || isDeletePending || isSaleStatusPending;
  const showList = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  // 리액트 하이드레이션 무한 루프 방지용 마운트 플래그
  useEffect(() => {
    setMounted(true);
  }, []);

  // 컬럼 정의
  const columns: BaseTableColumn<Show.List>[] = [
    { key: 'id', label: '번호', sorter: true },
    {
      key: 'title',
      label: '제목',
      render: (show) => (
        <Link
          href={`${ADMIN_ROUTES.SHOW}/${show.id}`}
          className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 hover:underline"
        >
          {show.title}
        </Link>
      ),
      search: true,
      sorter: true,
    },
    {
      key: 'status',
      label: '상태',
      render: (show) => <StatusBadge type="show" status={show.status} />,
      filter: true,
      filterOptions: FILTER_OPTIONS.status,
    },
    {
      key: 'saleStatus',
      label: '판매허용',
      render: (show) => <StatusBadge type="sale" status={show.saleStatus} />,
      filter: true,
      filterOptions: FILTER_OPTIONS.saleStatus,
    },
    {
      key: 'genre',
      label: '장르',
      render: (show) => GENRE_LABELS[show.genre],
      filter: true,
      filterOptions: FILTER_OPTIONS.genre,
    },
    {
      key: 'schedule',
      label: '일정',
      sorter: true,
      render: (show) => renderSchedules(show),
    },
    {
      key: 'salePeriod',
      label: '예매 일정',
      sorter: true,
      render: (show) => renderSalePeriod(show),
    },
    {
      key: 'toggle',
      label: '',
      render: (show) => {
        const toggleItems: ToggleItem[] = [
          {
            label: '판매 설정',
            onClick: () => handleSaleStatusChange(show),
          },
          {
            label: '수정',
            onClick: () => router.push(`${ADMIN_ROUTES.SHOW_UPSERT}/${show.id}`),
          },
          {
            label: '삭제',
            onClick: () => handleDelete(show),
            variant: 'destructive',
          },
        ];

        return <ToggleDropdown items={toggleItems} />;
      },
    },
  ];

  // 일정 포맷
  function renderSchedules(show: Show.List) {
    if (!show.schedules || show.schedules.length === 0) {
      return '-';
    }

    const first = show.schedules[0] as Show.SchedulesList;
    const count = show.schedules.length - 1;
    const additional = count > 0 ? `외 ${count}건` : '';

    return `${first.date} ${first.time} ${additional}`;
  }

  // 판매 일정 포맷
  function renderSalePeriod(show: Show.List) {
    if (!show.salePeriod || !show.salePeriod.startDate || !show.salePeriod.endDate) {
      return '-';
    }

    const start = dayjs(show.salePeriod.startDate).format(DATE_FORMAT.DATE_ONLY);
    const end = dayjs(show.salePeriod.endDate).format(DATE_FORMAT.DATE_ONLY);
    return `${start} ~ ${end}`;
  }

  // 판매 설정 핸들러
  async function handleSaleStatusChange(show: Show.List) {
    const isCurrentAllowed = show.saleStatus === 'ALLOWED';
    const requestStatus = isCurrentAllowed ? ('SUSPENDED' as const) : ('ALLOWED' as const);
    const requestLabel = isCurrentAllowed ? '중지' : '허용';

    const confirmed = await confirm({
      title: '판매 설정',
      description: `${show.title} 공연을 [판매 ${requestLabel}] 설정하시겠습니까?`,
      confirmText: '설정',
    });
    if (confirmed) {
      await onChangeSaleStatus({ id: show.id, saleStatus: requestStatus });
      refetch();
    }
  }

  // 삭제 핸들러
  async function handleDelete(show: Show.List) {
    if (show.status !== 'WAITING') {
      await alert({
        title: '삭제 불가',
        description: `'예매 대기' 상태인 공연만 삭제할 수 있습니다.`,
      });
      return;
    }

    const confirmed = await confirm({
      title: '공연 삭제',
      description: `${show.title} 공연을 삭제하시겠습니까?`,
      confirmText: '삭제',
    });
    if (confirmed) {
      await onDeleteShow(show.id);
      refetch();
    }
  }

  return (
    <PageCard>
      <PageCard.Title useRouteBack={false}>공연 목록</PageCard.Title>
      <PageCard.Content>
        {!mounted ? (
          // 서버 사이드에서 렌더링 중에 로딩 화면 표시
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <BaseTable
            data={showList}
            columns={columns}
            searchKeyword={query.q}
            searchColumn={query.field}
            onSearch={(keyword, field) =>
              setParams({ q: keyword.trim(), field: field === 'all' ? undefined : field })
            }
            filterValues={toFilterValues({
              status: query.status,
              saleStatus: query.saleStatus,
              genre: query.genre,
            })}
            onFilter={(key, values) => setParams({ [key]: values[0] })}
            page={query.page - 1}
            canReset={!isDefault}
            onReset={resetParams}
            sortColumn={sort.column}
            sortOrder={sort.order}
            onSort={(column, order) => setParams({ sort: toSortParam(column, order) })}
            totalPages={totalPages}
            pageSize={query.size}
            onPageChange={(page) => setParams({ page: page + 1 })}
            onPageSizeChange={(size) => setParams({ size })}
            headerActions={
              <Button onClick={() => router.push(ADMIN_ROUTES.SHOW_UPSERT)} size="sm">
                공연 등록
              </Button>
            }
            isLoading={loading}
            emptyMessage="등록된 공연이 없습니다."
          />
        )}
      </PageCard.Content>
    </PageCard>
  );
}
