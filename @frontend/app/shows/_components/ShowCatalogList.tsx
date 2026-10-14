'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms';
import { ShowListItemCard } from '@/components/molecules';
import { GENRE_OPTIONS, REGION_OPTIONS } from '@/constants/common';
import { fetchShowCatalogList } from '@/lib/api/show';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 20;
const DEFAULT_SORT: SortLabel = '인기순';

const SORT_OPTIONS = [
  { label: '인기순', orderBy: 'viewCount', orderDirection: 'desc' as const },
  { label: '공연임박순', orderBy: 'startDate', orderDirection: 'asc' as const },
  { label: '최신순', orderBy: 'createdAt', orderDirection: 'desc' as const },
];

type SortLabel = (typeof SORT_OPTIONS)[number]['label'];

const getTodayDateString = () => {
  const today = new Date();
  const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

export default function ShowCatalogList() {
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<ShowCatalog.Region | 'ALL'>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<ShowCatalog.Genre | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSort, setSelectedSort] = useState<SortLabel>(DEFAULT_SORT);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const todayDate = useMemo(() => getTodayDateString(), []);

  const sortConfig = useMemo(
    () => SORT_OPTIONS.find((option) => option.label === selectedSort) ?? SORT_OPTIONS[0],
    [selectedSort],
  );

  const baseParams = useMemo<Omit<ShowCatalog.ListParams, 'page' | 'size'>>(
    () => ({
      ...(keyword.trim() && { keyword: keyword.trim() }),
      ...(selectedRegion !== 'ALL' && { region: selectedRegion }),
      ...(selectedGenre !== 'ALL' && { genre: selectedGenre }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      orderBy: sortConfig.orderBy,
      orderDirection: sortConfig.orderDirection,
    }),
    [keyword, selectedRegion, selectedGenre, startDate, endDate, sortConfig],
  );

  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ['show', 'catalog', 'infinite', baseParams],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const requestParams = {
        ...baseParams,
        page: pageParam,
        size: PAGE_SIZE,
      };
      return fetchShowCatalogList(requestParams).catch(() => undefined);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.last) {
        return undefined;
      }
      return lastPage.page + 1;
    },
  });

  const shows = useMemo(() => data?.pages.flatMap((page) => page?.content ?? []) ?? [], [data]);
  const isInitialLoading = isFetching && shows.length === 0;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onSubmitSearch = () => setKeyword(searchInput);

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-white p-4">
        <div className="relative">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSubmitSearch();
              }
            }}
            placeholder="공연·전시명 또는 지역명을 입력하세요"
            className="pr-10"
          />
          <button
            type="button"
            onClick={onSubmitSearch}
            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedRegion} onValueChange={(value) => setSelectedRegion(value as ShowCatalog.Region | 'ALL')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="지역" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 지역</SelectItem>
              {REGION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedGenre} onValueChange={(value) => setSelectedGenre(value as ShowCatalog.Genre | 'ALL')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="장르" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 장르</SelectItem>
              {GENRE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            min={todayDate}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
          <span className="text-muted-foreground text-sm">~</span>
          <Input
            type="date"
            min={todayDate}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />

          <Select value={selectedSort} onValueChange={(value) => setSelectedSort(value as SortLabel)}>
            <SelectTrigger className="ml-auto w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const isAlreadyDefault =
                searchInput === '' &&
                keyword === '' &&
                selectedRegion === 'ALL' &&
                selectedGenre === 'ALL' &&
                startDate === '' &&
                endDate === '' &&
                selectedSort === DEFAULT_SORT;

              setSearchInput('');
              setKeyword('');
              setSelectedRegion('ALL');
              setSelectedGenre('ALL');
              setStartDate('');
              setEndDate('');
              setSelectedSort(DEFAULT_SORT);

              // 이미 기본값이면 queryKey 변화가 없으므로 강제 재요청
              if (isAlreadyDefault) {
                void refetch();
              }
            }}
          >
            초기화
          </Button>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="flex min-h-[380px] items-center justify-center rounded-lg border">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : shows.length === 0 ? (
        <div className="text-muted-foreground flex min-h-[380px] items-center justify-center rounded-lg border border-dashed text-sm">
          조건에 맞는 공연이 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {shows.map((show) => (
              <ShowListItemCard key={show.id} show={show} href={`/shows/${show.id}`} />
            ))}
          </div>

          <div ref={sentinelRef} className="flex h-12 items-center justify-center">
            {isFetchingNextPage ? <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" /> : null}
            {!hasNextPage && shows.length > 0 ? (
              <p className="text-muted-foreground text-sm">마지막 공연입니다.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
