import { DATE_FORMAT } from '@/constants/common/dateFormat';
import dayjs from '@/plugins/dayjs';

/**
 * 날짜 문자열을 ISO 문자열로 변환 (API 요청용)
 * 타임존 정보 없이 로컬 시간 그대로 전송 (YYYY-MM-DDTHH:mm:ss)
 *
 * @param dateStr - 날짜 문자열
 * @returns ISO 문자열 (타임존 없음)
 */
export function stringToDate(dateStr: string): string {
  let fullDateString: string;

  if (dateStr.includes('T')) {
    // 이미 시간 정보가 있는 경우
    const hasSeconds = dateStr.split('T')[1].split(':').length === 3;
    fullDateString = hasSeconds ? dateStr : `${dateStr}:00`;
  } else {
    // 날짜만 있는 경우 자정(00:00:00)으로 설정
    fullDateString = `${dateStr}T00:00:00`;
  }

  // ISO 문자열 그대로 반환 (타임존 변환 없음)
  return dayjs(fullDateString).format(DATE_FORMAT.FULL_TIMEZONE);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 서버 일시(오프셋 없는 KST)를 ms 로. 기기 타임존으로 읽으면 해외에서 시차만큼 틀어짐 */
export const kstToMs = (value: string) => dayjs.tz(value, 'Asia/Seoul').valueOf();

/** KST(UTC+9, 서머타임 없음) 달력 날짜 차이(D-day) */
export function getKstDayDiff(fromMs: number, toMs: number) {
  const toKstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
  return toKstDay(toMs) - toKstDay(fromMs);
}

/** 남은 초 → HH:MM:SS */
export function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}
