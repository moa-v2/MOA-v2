import { getRegionLabel } from '@/lib/common/labels';

/**
 * 손으로 관리하는 화면 데이터
 * - 데모 공연: 백엔드에 연결할 수 없을 때 API 중계 라우트(app/api/[...path])와 공연 상세 서버 렌더링이 대신 내려줌(메인 배너·목록·상세에 그대로 나옴).
 *   날짜는 요청 시점 기준으로 계산해 기간 지난 공연이 나오지 않음. 조회 외 요청(로그인·예매 등)은 이용 불가(503)
 */

// 백엔드 대신 데모로 응답하는 기준(API 중계 라우트·공연 상세 서버 렌더링 공용)
// 조회는 이 시간 안에 응답이 없으면 백엔드가 꺼진 것으로 봄(저장 요청은 오래 걸릴 수 있어 그대로 기다림)
export const BACKEND_READ_TIMEOUT_MS = 5_000;
// 한 번 실패하면 이 시간 동안은 백엔드를 다시 기다리지 않고 바로 데모로 응답
export const BACKEND_DOWN_HOLD_MS = 3 * 60_000;
// 앞단(Nginx 등)은 살아 있고 앱 서버만 꺼진 경우
export const BACKEND_GATEWAY_ERRORS = new Set([502, 503, 504]);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const KST_OFFSET = 9 * HOUR;
const SCHEDULE_DAYS = 21;
const POSTER_BASE = 'https://d23ve22iivj7kg.cloudfront.net/posters/2026/0717';

type SeatGrade = [sectionName: string, price: number, totalSeats: number];

interface DemoShow {
  id: number;
  title: string;
  genre: ShowCatalog.Genre;
  venue: string;
  hallName: string;
  poster: string;
  viewCount: number;
  /** 다음 20시(KST)에 판매가 열리는 공연(카운트다운 시연용) */
  opensSoon?: boolean;
  grades: SeatGrade[];
}

// id 는 실제 카탈로그와 같게 맞춰 백엔드가 살았다 죽었다 해도 같은 공연을 가리키게 함
const DEMO_SHOWS: DemoShow[] = [
  {
    id: 1,
    title: '뮤지컬 <베토벤>',
    genre: 'MUSICAL',
    venue: '세종문화회관',
    hallName: '대극장',
    poster: '4975c3e8-51ab-4336-8989-414e38e0a647',
    viewCount: 9800,
    grades: [
      ['VIP', 170000, 300],
      ['R', 140000, 400],
      ['S', 110000, 300],
    ],
  },
  {
    id: 2,
    title: '뮤지컬 <엘리자벳>',
    genre: 'MUSICAL',
    venue: '블루스퀘어',
    hallName: '우리은행홀',
    poster: 'd651d7a7-c527-4d37-893d-7c523b091e76',
    viewCount: 12400,
    opensSoon: true,
    grades: [
      ['VIP', 180000, 300],
      ['R', 150000, 400],
      ['S', 120000, 300],
    ],
  },
  {
    id: 3,
    title: '뮤직드라마 <불편한 편의점2>',
    genre: 'THEATER',
    venue: '후암씨어터',
    hallName: '',
    poster: 'd7d1bde9-e335-4e30-86df-75172a92f4d1',
    viewCount: 7600,
    grades: [['전석', 55000, 150]],
  },
  {
    id: 4,
    title: '오페라 <투란토드>',
    genre: 'CLASSIC',
    venue: '예술의전당',
    hallName: '오페라극장',
    poster: 'bfff7d77-5520-48a6-9cca-475fcaf21973',
    viewCount: 6900,
    grades: [
      ['R', 150000, 500],
      ['S', 120000, 500],
      ['A', 80000, 400],
    ],
  },
  {
    id: 5,
    title: '연극 <베니스의 상인>',
    genre: 'THEATER',
    venue: '국립극장',
    hallName: '해오름극장',
    poster: '2a978d48-42a4-400b-913b-60548d221114',
    viewCount: 5300,
    grades: [
      ['R', 70000, 600],
      ['S', 50000, 600],
    ],
  },
];

/** 서버 LocalDateTime 형식(KST, 오프셋 없음) */
const toKstDateTime = (ms: number) => new Date(ms + KST_OFFSET).toISOString().slice(0, 19);
const toKstDate = (ms: number) => toKstDateTime(ms).slice(0, 10);
const startOfKstDay = (ms: number) => Math.floor((ms + KST_OFFSET) / DAY) * DAY - KST_OFFSET;

function buildSchedules(show: DemoShow, firstDay: number): ShowCatalog.Schedule[] {
  const days = Array.from({ length: SCHEDULE_DAYS }, (_, day) => firstDay + day * DAY);
  let keyId = show.id * 1000;
  return days.flatMap((dayMs) => {
    const weekday = new Date(dayMs + KST_OFFSET).getUTCDay();
    const times = weekday === 0 || weekday === 6 ? ['14:00', '19:00'] : ['19:30'];
    return times.map((time, index) => ({
      keyId: keyId++,
      date: toKstDate(dayMs),
      time,
      session: index + 1,
    }));
  });
}

function buildShow(show: DemoShow, now: number): ShowCatalog.Detail {
  const today = startOfKstDay(now);
  const openTonight = today + 20 * HOUR;
  const saleStart = show.opensSoon
    ? now < openTonight
      ? openTonight
      : openTonight + DAY
    : today - 14 * DAY + 10 * HOUR;
  const firstDay = show.opensSoon ? startOfKstDay(saleStart) + 14 * DAY : today + DAY;
  const lastDay = firstDay + (SCHEDULE_DAYS - 1) * DAY;
  const posterUrl = `${POSTER_BASE}/${show.poster}.gif`;

  return {
    id: show.id,
    title: show.title,
    genre: show.genre,
    status: show.opensSoon ? 'WAITING' : 'ON_SALE',
    saleStatus: 'ALLOWED',
    posterUrl,
    location: { region: 'SEOUL', venue: show.venue, hallName: show.hallName },
    salePeriod: { startDate: toKstDateTime(saleStart), endDate: toKstDateTime(lastDay + DAY) },
    createdAt: toKstDateTime(today - show.id * 3 * DAY),
    viewCount: show.viewCount,
    startDate: toKstDate(firstDay),
    endDate: toKstDate(lastDay),
    schedules: buildSchedules(show, firstDay),
    detailImageUrls: [posterUrl],
    runningTime: '-',
    cast: '-',
  };
}

function buildSeats(show: DemoShow, detail: ShowCatalog.Detail, date: string) {
  return detail.schedules
    .filter((schedule) => schedule.date === date)
    .map(({ keyId, time }): ShowCatalog.ScheduleByDate => {
      const seatGrades = show.grades.map(([sectionName, price, totalSeats], index) => ({
        sectionName,
        price,
        totalSeats,
        // 회차·등급마다 달라 보이도록 고정 규칙으로 잔여석을 만듦(10~100%)
        remainingSeats: Math.floor((totalSeats * (((keyId * 7 + index * 3) % 10) + 1)) / 10),
      }));
      const remainingSeats = seatGrades.reduce((sum, grade) => sum + grade.remainingSeats, 0);
      return {
        keyId,
        date,
        time: time as string,
        isSoldOut: remainingSeats === 0,
        totalSeats: seatGrades.reduce((sum, grade) => sum + grade.totalSeats, 0),
        remainingSeats,
        seatGrades,
      };
    });
}

function listShows(params: URLSearchParams, now: number): Api.ListResponse<ShowCatalog.List> {
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  const genre = params.get('genre');
  const region = params.get('region');
  const keyword = params.get('keyword')?.trim().toLowerCase();
  const from = params.get('startDate');
  const to = params.get('endDate');
  const orderBy = params.get('orderBy') ?? 'viewCount';
  const direction = params.get('orderDirection') === 'asc' ? 1 : -1;

  const shows = DEMO_SHOWS.map((show) => buildShow(show, now))
    .filter((show) => !genre || show.genre === genre)
    .filter((show) => !region || show.location.region === region)
    .filter(
      (show) =>
        !keyword ||
        `${show.title} ${show.location.venue} ${show.location.hallName} ${getRegionLabel(show.location.region)}`
          .toLowerCase()
          .includes(keyword),
    )
    .filter((show) => (!from || show.endDate >= from) && (!to || show.startDate <= to))
    .sort((a, b) => {
      if (orderBy === 'startDate') return a.startDate.localeCompare(b.startDate) * direction;
      if (orderBy === 'createdAt') return a.createdAt.localeCompare(b.createdAt) * direction;
      return (a.viewCount - b.viewCount) * direction;
    });

  const totalPages = Math.ceil(shows.length / size);
  return {
    content: shows.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: shows.length,
    totalPages,
    first: page === 0,
    last: page + 1 >= totalPages,
  };
}

const ok = (data: unknown) => ({ status: 200, body: { success: true, data, message: null } });
const fail = (status: number, message: string, code?: string) => ({
  status,
  body: { success: false, data: null, message, ...(code && { code }) },
});

/**
 * 중계 라우트 경로(api/ 뒤, 예: v1/shows/2)에 맞는 데모 응답
 * - 공연 목록·상세·잔여석 조회만 데모 데이터, 그 외는 이용 불가
 */
export function getDemoResponse(method: string, path: string, params: URLSearchParams) {
  const now = Date.now();
  if (method === 'GET') {
    if (path === 'v1/shows') return ok(listShows(params, now));

    const match = path.match(/^v1\/shows\/(\d+)(\/schedules)?$/);
    if (match) {
      const show = DEMO_SHOWS.find(({ id }) => id === Number(match[1]));
      if (!show) return fail(404, '공연을 찾을 수 없습니다.');
      const detail = buildShow(show, now);
      return ok(match[2] ? buildSeats(show, detail, params.get('date') ?? '') : detail);
    }

    // 로그인 안 된 상태로 응답해 헤더의 로그인 확인이 오류 없이 지나가게 함
    if (path === 'v1/users/me') return fail(401, '인증이 필요합니다.');
  }
  return fail(
    503,
    '현재 서버에 연결할 수 없어 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    'SERVICE_UNAVAILABLE',
  );
}
