'use client';

import { getShowDetail } from '@/lib/api/show';
import { ServerRenderTimeProvider } from '@/lib/server-clock';
import { useQuery } from '@tanstack/react-query';
import ShowDetailMain from './ShowDetailMain';
import ShowDetailSidebar from './ShowDetailSidebar';
import ShowDetailTabs from './ShowDetailTabs';

interface Props {
  id: number;
  /** 서버가 화면을 그린 시각(ms) */
  renderedAt: number;
}

/** 서버(page.tsx)가 미리 채워 둔 공연 상세 캐시를 읽어 그림 */
export default function ShowDetailView({ id, renderedAt }: Props) {
  const { data: showDetail } = useQuery(getShowDetail(id));
  if (!showDetail) return null;

  return (
    <ServerRenderTimeProvider renderedAt={renderedAt}>
      <div className="container mx-auto max-w-7xl py-6 pr-0 pl-5 sm:pl-6 lg:pl-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            <ShowDetailMain show={showDetail} />
            <ShowDetailTabs show={showDetail} />
          </div>

          <ShowDetailSidebar salePeriod={showDetail.salePeriod} schedules={showDetail.schedules} />
        </div>
      </div>
    </ServerRenderTimeProvider>
  );
}
