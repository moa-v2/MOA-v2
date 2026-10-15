/**
 * 폼 임시저장(브라우저 localStorage)
 * - 글자 데이터만 담음. 첨부 파일은 다시 첨부해야 함
 * - 그 브라우저에만 남고, 저장할 수 없는 환경(용량 초과·저장소 차단)이면 조용히 건너뜀
 */

const PREFIX = 'moa:draft:';

export interface FormDraft<T> {
  savedAt: number;
  values: T;
}

/** 임시저장 불러오기. 기한(maxAgeMs)이 지났거나 깨진 값이면 지우고 null */
export function loadDraft<T>(key: string, maxAgeMs: number): FormDraft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<FormDraft<T>>;
    if (
      typeof draft.savedAt !== 'number' ||
      !draft.values ||
      Date.now() - draft.savedAt > maxAgeMs
    ) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return draft as FormDraft<T>;
  } catch {
    return null;
  }
}

/** 저장한 시각(ms), 저장하지 못하면 null */
export function saveDraft<T>(key: string, values: T): number | null {
  const savedAt = Date.now();
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt, values }));
    return savedAt;
  } catch {
    return null;
  }
}

export function removeDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 저장소를 쓸 수 없는 환경
  }
}
