import { Region } from '@shared/enums';

export const REGION_LABELS: Record<Region, string> = {
  SEOUL: '서울',
  GYEONGGI: '경기',
  INCHEON: '인천',
  BUSAN: '부산',
  DAEGU: '대구',
  DAEJEON: '대전',
  GWANGJU: '광주',
  ULSAN: '울산',
  SEJONG: '세종',
  GANGWON: '강원',
  CHUNGBUK: '충북',
  CHUNGNAM: '충남',
  JEONBUK: '전북',
  JEONNAM: '전남',
  GYEONGBUK: '경북',
  GYEONGNAM: '경남',
  JEJU: '제주',
};

export const REGION_OPTIONS = (Object.keys(REGION_LABELS) as Region[]).map((key) => ({
  label: REGION_LABELS[key],
  value: key,
}));
