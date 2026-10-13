'use client';

import { getShowDetail } from '@/lib/api/show';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import ShowDetailSidebar from './_components/ShowDetailSidebar';
import ShowDetailMain from './_components/ShowDetailMain';
import ShowDetailTabs from './_components/ShowDetailTabs';

export default function ShowDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const { data } = useQuery(getShowDetail(id));

  const showDetail = useMemo(() => data as ShowCatalog.Detail, [data]);

  if (!id || id < 0) {
    return (
      <div className="text-muted-foreground container mx-auto max-w-7xl px-5 py-10 text-center sm:px-6 lg:px-8">
        존재하지 않는 공연입니다.
      </div>
    );
  }

  // 재조회(isFetching) 때 로딩 화면으로 바꾸면 카운트다운이 언마운트됨
  if (!showDetail) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-5 sm:px-6 lg:px-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-6 pr-0 pl-5 sm:pl-6 lg:pl-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <ShowDetailMain show={showDetail} />
          <ShowDetailTabs show={showDetail} />
        </div>

        <ShowDetailSidebar salePeriod={showDetail.salePeriod} schedules={showDetail.schedules} />
      </div>
    </div>
  );
}
