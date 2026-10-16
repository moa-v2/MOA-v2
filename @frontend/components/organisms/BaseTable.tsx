'use client';

import * as React from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms';
import { SearchBar, SearchColumn } from '@/components/molecules/SearchBar';
import { Pagination } from '@/components/molecules/Pagination';
import type { BaseTableFilterOption } from '@/lib/admin/table-filter';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronsUpDown, ListFilter, FunnelX, RotateCcw } from 'lucide-react';

export type { BaseTableFilterOption };

/** 필터 드롭다운에서 '전체' 선택 시 사용하는 예약 값 (필터 해제) */
const ALL_FILTER_VALUE = '__all__';

export interface BaseTableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  search?: boolean; // 검색 컬럼 여부
  sorter?: boolean; // 정렬 컬럼 여부
  filter?: boolean; // 필터 컬럼 여부
  filterOptions?: BaseTableFilterOption[]; // 필터  옵션 목록
}

export interface BaseTableProps<T> {
  // 데이터
  data: T[];
  columns: BaseTableColumn<T>[];

  // 검색 기능 (적용된 검색어·검색 열은 밖에서 받음, 입력 중인 글자만 표 안에 둠)
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchKeyword?: string;
  searchColumn?: string;
  onSearch?: (keyword: string, searchColumn: string) => void;

  // 정렬 기능 (현재 정렬은 밖에서 받음)
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column?: string, order?: 'asc' | 'desc') => void;

  // 필터 기능 (컬럼별 선택값)
  filterValues?: Record<string, string[]>;
  onFilter?: (columnKey: string, selectedValues: string[]) => void;

  // 페이지네이션
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];

  // 조건 초기화 (canReset 일 때만 버튼이 보임)
  canReset?: boolean;
  onReset?: () => void;

  // 헤더 액션 영역 (우측 버튼 영역)
  headerActions?: React.ReactNode;

  // 로딩 상태
  isLoading?: boolean;

  // 커스터마이징
  className?: string;
  emptyMessage?: string;
}

export function BaseTable<T extends object>({
  data,
  columns,
  showSearch = true,
  searchPlaceholder = '검색어를 입력하세요',
  searchKeyword = '',
  searchColumn = 'all',
  onSearch,
  sortColumn,
  sortOrder,
  onSort,
  filterValues,
  onFilter,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  canReset = false,
  onReset,
  headerActions,
  isLoading = false,
  className,
  emptyMessage = '데이터가 없습니다.',
}: BaseTableProps<T>) {
  // columns에서 search: true만 필터링
  const searchColumns: SearchColumn[] = React.useMemo(() => {
    return columns.filter((col) => col.search).map((col) => ({ key: col.key, label: col.label }));
  }, [columns]);

  // 정렬 처리
  function handleSort(key: string) {
    let newSortColumn: string | undefined;
    let newSortOrder: 'asc' | 'desc' | undefined;

    if (sortColumn === key) {
      if (sortOrder === 'asc') {
        newSortColumn = key;
        newSortOrder = 'desc';
      } else if (sortOrder === 'desc') {
        // 정렬 취소
        newSortColumn = undefined;
        newSortOrder = undefined;
      }
    } else {
      newSortColumn = key;
      newSortOrder = 'asc';
    }

    onSort?.(newSortColumn, newSortOrder);
  }

  function handleFilterChange(columnKey: string, selectedVal: string, checked: boolean) {
    if (selectedVal === ALL_FILTER_VALUE) {
      // '전체' 선택 시 해당 컬럼 필터 해제
      onFilter?.(columnKey, []);
      return;
    }
    const current = filterValues?.[columnKey] ?? [];
    // TODO: 필터 다중 선택
    // const next = checked ? [...current, selectedVal] : current.filter((v) => v !== selectedVal);
    const next = checked ? [selectedVal] : current.filter((v) => v !== selectedVal);

    onFilter?.(columnKey, next);
  }

  // 정렬 아이콘 렌더링
  function renderSortIcon(columnKey: string) {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    }

    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  }

  // 필터 아이콘 + 체크박스 드롭다운 렌더링
  function renderFilter(column: BaseTableColumn<T>) {
    if (!column.filter) return null;

    const selectedValues = filterValues?.[column.key] ?? [];
    const isActive = selectedValues.length > 0;

    const options = column.filterOptions ?? [];
    const displayOptions: BaseTableFilterOption[] = [
      { value: ALL_FILTER_VALUE, label: '전체' },
      ...options,
    ];

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'focus-visible:ring-ring ml-2 inline-flex rounded transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              isActive && 'text-blue-600',
            )}
            aria-label={`${column.label} 필터`}
            aria-pressed={isActive}
          >
            {isActive ? <FunnelX className="h-4 w-4" /> : <ListFilter className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          {options.length === 0 ? (
            <DropdownMenuCheckboxItem
              disabled
              checked={false}
              className="text-muted-foreground cursor-default px-3 py-2 text-sm"
            >
              데이터가 없습니다.
            </DropdownMenuCheckboxItem>
          ) : (
            displayOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={
                  opt.value === ALL_FILTER_VALUE ? selectedValues.length === 0 : selectedValues.includes(opt.value)
                }
                onCheckedChange={(nextChecked) => handleFilterChange(column.key, opt.value, nextChecked)}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* 상단 컨트롤 영역 */}
      <div className="flex items-center justify-between gap-4">
        {/* 좌측: 검색 영역 + 초기화 */}
        <div className="flex items-center gap-2">
          {showSearch && (
            // 적용된 검색 조건이 바뀌면(뒤로 가기 등) 입력 중이던 값을 버리고 새로 맞춤
            <TableSearch
              key={`${searchColumn}:${searchKeyword}`}
              searchColumns={searchColumns}
              placeholder={searchPlaceholder}
              keyword={searchKeyword}
              column={searchColumn}
              onSearch={onSearch}
            />
          )}
          {canReset && onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              <RotateCcw className="size-4" />
              초기화
            </Button>
          )}
        </div>

        {/* 우측: 헤더 액션 영역 */}
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      {/* 테이블 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn('text-center', column.className)}
                >
                  <div className="flex items-center justify-center">
                    {/* 컬럼명 */}
                    {column.label}
                    {/* 정렬 아이콘 */}
                    {column.sorter && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="transition-colors hover:text-gray-900"
                      >
                        {renderSortIcon(column.key)}
                      </button>
                    )}
                    {/* 필터 아이콘 + 체크박스 드롭다운 */}
                    {renderFilter(column)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn('text-center', column.className)}>
                      {column.render
                        ? column.render(item)
                        : (item as Record<string, React.ReactNode>)[column.key] || '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 하단: 페이지네이션 */}
      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        disabled={isLoading}
      />
    </div>
  );
}

/** 검색창: 입력 중인 글자·고른 열은 여기만 두고, 검색할 때 밖으로 알림 */
function TableSearch({
  searchColumns,
  placeholder,
  keyword,
  column,
  onSearch,
}: {
  searchColumns: SearchColumn[];
  placeholder: string;
  keyword: string;
  column: string;
  onSearch?: (keyword: string, searchColumn: string) => void;
}) {
  const [draftKeyword, setDraftKeyword] = React.useState(keyword);
  const [draftColumn, setDraftColumn] = React.useState(column);

  return (
    <SearchBar
      searchColumns={searchColumns}
      placeholder={placeholder}
      value={draftKeyword}
      selectedColumn={draftColumn}
      onValueChange={setDraftKeyword}
      onColumnChange={setDraftColumn}
      onSearch={() => onSearch?.(draftKeyword, draftColumn)}
    />
  );
}
