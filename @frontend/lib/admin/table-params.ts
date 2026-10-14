import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

/**
 * 관리자 목록의 페이지·정렬·검색·필터를 주소(쿼리)에 두는 훅과 스키마 도우미
 * - 새로고침·뒤로 가기·링크 공유에도 조건이 유지됨
 * - 주소는 사용자가 고칠 수 있는 입력이라 스키마로 검증하고, 잘못된 값은 기본값으로 바꿈
 * - 주소는 방문 기록·접속 기록에 남으므로 개인정보(회원 검색어 등)는 넣지 않음
 */

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

export type SortOrder = 'asc' | 'desc';

/** 페이지(주소는 1부터, API 는 0부터) */
export const pageParam = z.coerce.number().int().min(1).catch(1);

export const pageSizeParam = z.coerce
  .number()
  .refine((size) => PAGE_SIZE_OPTIONS.includes(size))
  .catch(DEFAULT_PAGE_SIZE);

/** 검색어 등 자유 입력 */
export const textParam = z
  .string()
  .trim()
  .max(100)
  .optional()
  .catch(undefined)
  .transform((value) => value || undefined);

/** 정해진 값 중 하나(필터·검색 열) */
export const oneOfParam = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

/**
 * 정렬 'column.asc' 형식. 허용한 열만 받음
 * (백엔드가 정렬 필드 이름을 검증 없이 쓰므로 아무 값이나 넘기면 오류가 남)
 */
export const sortParam = (columns: readonly string[]) =>
  z
    .string()
    .refine((value) => {
      const [column, order] = value.split('.');
      return columns.includes(column) && (order === 'asc' || order === 'desc');
    })
    .optional()
    .catch(undefined);

export function parseSort(sort?: string) {
  if (!sort) return { column: undefined, order: undefined };
  const [column, order] = sort.split('.') as [string, SortOrder];
  return { column, order };
}

export const toSortParam = (column?: string, order?: SortOrder) =>
  column && order ? `${column}.${order}` : undefined;

type TableParams = { page: number; size: number } & Record<string, string | number | undefined>;

export function useTableParams<S extends z.ZodType<TableParams>>(schema: S) {
  type Params = z.output<S>;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults = useMemo(() => schema.parse({}) as Params, [schema]);
  const params = useMemo(
    () => schema.parse(Object.fromEntries(searchParams)) as Params,
    [schema, searchParams],
  );

  /**
   * 바꿀 값만 넘김. 페이지를 직접 바꾸는 경우가 아니면 1페이지로
   * (넘긴 값은 주소를 다시 읽을 때 스키마로 검증되므로 여기서는 문자열로 받음)
   */
  const setParams = useCallback(
    (patch: Partial<Record<keyof Params & string, string | number | undefined>>) => {
      const next: Record<string, unknown> = { ...params, page: 1, ...patch };
      const defaultValues: Record<string, unknown> = defaults;
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        // 기본값은 주소에서 빼 둠
        if (value === undefined || value === defaultValues[key]) continue;
        query.set(key, String(value));
      }
      const search = query.toString();
      if (search === searchParams.toString()) return;
      // 조건마다 기록을 남겨 뒤로 가기로 이전 조건에 돌아감
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, defaults, pathname, router, searchParams],
  );

  /** 모든 조건이 기본값인지(초기화 버튼을 보일지) */
  const isDefault = useMemo(() => {
    const defaultValues: Record<string, unknown> = defaults;
    return Object.entries(params).every(([key, value]) => value === defaultValues[key]);
  }, [params, defaults]);

  /** 모든 조건을 기본값으로. 기록이 남아 뒤로 가기로 직전 조건에 돌아갈 수 있음 */
  const resetParams = useCallback(() => {
    if (searchParams.toString()) router.push(pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return { params, setParams, isDefault, resetParams };
}
