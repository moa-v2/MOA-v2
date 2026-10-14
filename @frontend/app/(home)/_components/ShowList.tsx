'use client';

import {
  Button,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/atoms';
import ShowListItemCard from '@/components/molecules/ShowListItemCard';
import { GENRE_OPTIONS } from '@/constants/common';
import { getShowCatalogList } from '@/lib/api/show';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ShowListProps {
  showRank?: boolean;
}

export default function ShowList({ showRank = false }: ShowListProps) {
  const CONTENT_MIN_HEIGHT_CLASS = 'min-h-[560px]';
  const [selectedGenre, setSelectedGenre] = useState<ShowCatalog.Genre | 'ALL'>('ALL');

  const params = useMemo<ShowCatalog.ListParams>(
    () => ({
      page: 0,
      size: 20,
      ...(selectedGenre !== 'ALL' && { genre: selectedGenre }),
      // 메인에서는 인기순 정렬
      orderBy: 'viewCount',
      orderDirection: 'desc',
    }),
    [selectedGenre],
  );

  const { data, isFetching } = useQuery(getShowCatalogList(params));
  const shows = data?.content ?? [];
  const displayedShows =
    selectedGenre === 'ALL' ? shows : shows.filter((show) => show.genre === selectedGenre);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={selectedGenre === 'ALL' ? 'default' : 'outline'}
          onClick={() => setSelectedGenre('ALL')}
        >
          전체
        </Button>
        {GENRE_OPTIONS.map((genre) => (
          <Button
            key={genre.value}
            type="button"
            size="sm"
            variant={selectedGenre === genre.value ? 'default' : 'outline'}
            onClick={() => setSelectedGenre(genre.value)}
          >
            {genre.label}
          </Button>
        ))}
      </div>

      {isFetching ? (
        <div
          className={`${CONTENT_MIN_HEIGHT_CLASS} flex flex-col items-center justify-center gap-3 rounded-lg border bg-white`}
        >
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500">공연 목록을 불러오는 중입니다.</p>
        </div>
      ) : displayedShows.length === 0 ? (
        <div
          className={`${CONTENT_MIN_HEIGHT_CLASS} flex items-center justify-center rounded-lg border border-dashed p-10 text-center text-sm text-slate-500`}
        >
          선택한 장르의 공연이 없습니다.
        </div>
      ) : (
        <div className={`${CONTENT_MIN_HEIGHT_CLASS} space-y-3`}>
          <Carousel
            opts={{
              align: 'start',
              loop: false,
            }}
            className="w-full px-8"
          >
          <CarouselContent>
            {displayedShows.map((show, index) => (
              <CarouselItem key={show.id} className="basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <ShowListItemCard
                  show={show}
                  href={`/shows/${show.id}`}
                  showRank={showRank}
                  rank={index + 1}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
          </Carousel>
        </div>
      )}
    </div>
  );
}
