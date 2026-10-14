import { BE_URL } from '@/constants/common/url';
import { getShowDetail } from '@/lib/api/show';
import { getGenreLabel } from '@/lib/common/labels';
import {
  BACKEND_DOWN_HOLD_MS,
  BACKEND_GATEWAY_ERRORS,
  BACKEND_READ_TIMEOUT_MS,
  getDemoResponse,
} from '@/lib/static-content';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import ShowDetailView from './_components/ShowDetailView';

type Props = { params: Promise<{ id: string }> };

// 공연 정보는 자주 바뀌지 않아 백엔드 응답을 1분간 재사용(200 응답만 캐시됨)
const REVALIDATE_SECONDS = 60;

// 연결 자체가 안 될 때만 잠시 기다리지 않음(502 같은 응답은 바로 와서 기다릴 일이 없음)
let backendDownUntil = 0;

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * 공연 상세(서버). 없는 공연이면 null
 * - 백엔드가 응답하지 않으면 API 중계 라우트처럼 데모 데이터
 * - generateMetadata 와 페이지가 같은 요청 안에서 한 번만 부르도록 cache
 */
const fetchShowDetail = cache(async (id: number): Promise<ShowCatalog.Detail | null> => {
  const path = `v1/shows/${id}`;
  const demo = () => {
    const { status, body } = getDemoResponse('GET', path, new URLSearchParams());
    return status === 200 ? (body.data as ShowCatalog.Detail) : null;
  };
  if (Date.now() < backendDownUntil) return demo();

  let response: Response;
  try {
    response = await fetch(`${BE_URL}/api/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(BACKEND_READ_TIMEOUT_MS),
    });
  } catch {
    backendDownUntil = Date.now() + BACKEND_DOWN_HOLD_MS;
    return demo();
  }
  if (BACKEND_GATEWAY_ERRORS.has(response.status)) return demo();
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`공연 상세 조회 실패 (${response.status})`);
  return ((await response.json()) as Api.Response<ShowCatalog.Detail>).data ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const show = id ? await fetchShowDetail(id) : null;
  if (!show) return { title: '존재하지 않는 공연' };

  const description = `${getGenreLabel(show.genre)} · ${show.startDate} ~ ${show.endDate} · ${show.location.venue} ${show.location.hallName}`;
  return {
    title: show.title,
    description,
    openGraph: {
      title: show.title,
      description,
      images: show.posterUrl ? [{ url: show.posterUrl, alt: show.title }] : undefined,
    },
  };
}

/** 브라우저 캐시에 넘길 공연 상세와 그 시각(사이드바 오픈 단계·카운트다운을 이 시각으로 그림) */
async function prefetchShowDetail(id: number) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: getShowDetail(id).queryKey,
    queryFn: () => fetchShowDetail(id),
  });
  return { state: dehydrate(queryClient), renderedAt: Date.now() };
}

/** 공연 상세: 서버에서 공연 정보를 받아 캐시에 채운 뒤 HTML 로 내려줌(브라우저는 다시 조회하지 않음) */
export default async function ShowDetailPage({ params }: Props) {
  // 서버 시각으로 그리므로 요청마다 렌더링(공연 정보는 위 fetch 캐시)
  await connection();
  const id = parseId((await params).id);
  if (!id || !(await fetchShowDetail(id))) notFound();

  const { state, renderedAt } = await prefetchShowDetail(id);
  return (
    <HydrationBoundary state={state}>
      <ShowDetailView id={id} renderedAt={renderedAt} />
    </HydrationBoundary>
  );
}
