export interface BaseTableFilterOption {
  value: string;
  label: string;
}

export interface DeriveFilterOptionsConfig<T> {
  key: string;
  getValue: (item: T) => string | undefined;
  getLabel?: (value: string) => string;
}

/**
 * data에서 중복 제외 후 컬럼별 필터 옵션 목록 추출
 */
export function deriveFilterOptions<T>(
  data: T[],
  config: DeriveFilterOptionsConfig<T>[],
): Record<string, BaseTableFilterOption[]> {
  const options: Record<string, BaseTableFilterOption[]> = {};

  for (const { key, getValue, getLabel } of config) {
    const valueToItem = new Map<string, T>();

    // 1. 중복 제거한 옵션 목록 추출
    for (const item of data) {
      const val = getValue(item);
      if (val != null && !valueToItem.has(val)) valueToItem.set(val, item);
    }

    // 2. 라벨이 있는 경우 적용, 없으면 그대로 표출
    const values = [...valueToItem.keys()].sort();
    options[key] = values
      .map((value) => ({ value, label: getLabel?.(value) || value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return options;
}

/** 라벨 상수 → 필터 선택지(상수에 적힌 순서대로) */
export const labelOptions = (labels: Record<string, string>): BaseTableFilterOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** 라벨 상수의 값 목록(주소 검증용) */
export const labelKeys = <K extends string>(labels: Record<K, string>) =>
  Object.keys(labels) as [K, ...K[]];

/** 필터 하나만 고르는 값 → BaseTable filterValues 형식 */
export const toFilterValues = (values: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ? [value] : []]));
