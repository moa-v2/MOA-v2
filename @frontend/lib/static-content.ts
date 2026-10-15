import { getRegionLabel } from '@/lib/common/labels';

/**
 * 손으로 관리하는 화면 데이터
 * - 데모 공연: 백엔드에 연결할 수 없을 때 API 중계 라우트(app/api/[...path])와 공연 상세 서버 렌더링이 대신 내려줌(메인 배너·목록·상세에 그대로 나옴).
 *   날짜는 요청 시점 기준으로 계산해 언제 열어도 오픈 예정·판매 중·종료 구성이 그대로임. 조회 외 요청(로그인·예매 등)은 이용 불가(503)
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
const POSTER_BASE = '/demo-posters';

type SeatGrade = [sectionName: string, price: number, totalSeats: number];

interface DemoShow {
  id: number;
  title: string;
  genre: ShowCatalog.Genre;
  /** 없으면 서울 */
  region?: ShowCatalog.Region;
  venue: string;
  hallName: string;
  /** public/demo-posters 아래 파일 이름(확장자 제외) */
  poster?: string;
  viewCount: number;
  /** 판매 시작 전 공연: 오늘부터 며칠 뒤 몇 시(KST)에 판매가 열림(카운트다운·오픈 예정 시연용) */
  opensAt?: { inDays: number; hour: number };
  /** 끝난 공연: 며칠 전에 마지막 회차가 끝남(1 이상) */
  endedDaysAgo?: number;
  grades: SeatGrade[];
}

// id 는 실제 카탈로그와 겹치지 않게 101번부터(백엔드가 살아났을 때 다른 공연을 가리키지 않도록)
const DEMO_SHOWS: DemoShow[] = [
  {
    id: 101,
    title: '뮤지컬 <광화문연가>',
    genre: 'MUSICAL',
    venue: '디큐브 링크아트센터',
    hallName: '',
    poster: 'gwanghwamun-yeonga',
    viewCount: 4200,
    endedDaysAgo: 3,
    grades: [
      ['VIP', 170000, 400],
      ['R', 140000, 450],
      ['S', 110000, 350],
    ],
  },
  {
    id: 102,
    title: '뮤지컬 <오페라의 유령> (Phantom of The Opera)',
    genre: 'MUSICAL',
    venue: '블루스퀘어',
    hallName: '우리은행홀',
    poster: 'phantom-of-the-opera',
    viewCount: 15200,
    opensAt: { inDays: 0, hour: 20 },
    grades: [
      ['VIP', 190000, 500],
      ['R', 160000, 600],
      ['S', 130000, 400],
      ['A', 90000, 260],
    ],
  },
  {
    id: 103,
    title: '뮤지컬 스위니토드(SWEENEY TODD) - 10주년',
    genre: 'MUSICAL',
    venue: '디큐브 링크아트센터',
    hallName: '',
    poster: 'sweeney-todd',
    viewCount: 11800,
    grades: [
      ['VIP', 170000, 400],
      ['R', 140000, 450],
      ['S', 110000, 350],
    ],
  },
  {
    id: 104,
    title: '2026 유니버설발레단 <호두까기인형>',
    genre: 'DANCE',
    venue: '세종문화회관',
    hallName: '대극장',
    poster: 'nutcracker',
    viewCount: 8700,
    opensAt: { inDays: 3, hour: 11 },
    grades: [
      ['VIP', 120000, 600],
      ['R', 100000, 900],
      ['S', 70000, 900],
      ['A', 50000, 600],
    ],
  },
  {
    id: 105,
    title: '연극 <클로저>',
    genre: 'THEATER',
    venue: '예스24스테이지',
    hallName: '2관',
    poster: 'closer',
    viewCount: 2600,
    endedDaysAgo: 10,
    grades: [
      ['R', 66000, 200],
      ['S', 55000, 140],
    ],
  },
  {
    id: 106,
    title: '뮤지컬 <그날들> - 부산',
    genre: 'MUSICAL',
    region: 'BUSAN',
    venue: '드림씨어터',
    hallName: '',
    poster: 'geunaldeul',
    viewCount: 7300,
    grades: [
      ['VIP', 160000, 500],
      ['R', 130000, 600],
      ['S', 100000, 400],
      ['A', 70000, 200],
    ],
  },
  {
    id: 107,
    title: '뮤지컬 <캣츠> 내한공연 - 대구',
    genre: 'MUSICAL',
    region: 'DAEGU',
    venue: '계명아트센터',
    hallName: '',
    poster: 'cats',
    viewCount: 10400,
    opensAt: { inDays: 6, hour: 14 },
    grades: [
      ['VIP', 180000, 500],
      ['R', 150000, 600],
      ['S', 110000, 500],
      ['A', 80000, 350],
    ],
  },
  {
    id: 108,
    title: '뮤지컬 <사의 찬미> - 춘천',
    genre: 'MUSICAL',
    region: 'GANGWON',
    venue: '춘천문화예술회관',
    hallName: '',
    poster: 'gloomy-day',
    viewCount: 5100,
    grades: [
      ['R', 60000, 450],
      ['S', 45000, 350],
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

/** 판매 단계별 판매 시작 시각·첫 공연일(오늘 기준으로 계산해 언제 열어도 같은 단계로 보임) */
function getSalePlan(show: DemoShow, now: number) {
  const today = startOfKstDay(now);
  if (show.opensAt) {
    const openAt = today + show.opensAt.inDays * DAY + show.opensAt.hour * HOUR;
    // 오픈 시각이 이미 지났으면 하루 뒤로 미뤄 늘 오픈 예정으로 보이게 함
    const saleStart = now < openAt ? openAt : openAt + DAY;
    return { status: 'WAITING', saleStart, firstDay: startOfKstDay(saleStart) + 14 * DAY } as const;
  }
  if (show.endedDaysAgo) {
    const firstDay = today - (show.endedDaysAgo + SCHEDULE_DAYS - 1) * DAY;
    return { status: 'ENDED', saleStart: firstDay - 30 * DAY + 10 * HOUR, firstDay } as const;
  }
  return {
    status: 'ON_SALE',
    saleStart: today - 14 * DAY + 10 * HOUR,
    firstDay: today + DAY,
  } as const;
}

function buildShow(show: DemoShow, now: number): ShowCatalog.Detail {
  const { status, saleStart, firstDay } = getSalePlan(show, now);
  const lastDay = firstDay + (SCHEDULE_DAYS - 1) * DAY;
  const posterUrl = show.poster ? `${POSTER_BASE}/${show.poster}.gif` : '';

  return {
    id: show.id,
    title: show.title,
    genre: show.genre,
    status,
    saleStatus: 'ALLOWED',
    posterUrl,
    location: { region: show.region ?? 'SEOUL', venue: show.venue, hallName: show.hallName },
    salePeriod: { startDate: toKstDateTime(saleStart), endDate: toKstDateTime(lastDay + DAY) },
    // 판매 시작 일주일 전에 등록한 것으로(오늘을 넘지 않게)
    createdAt: toKstDateTime(Math.min(saleStart - 7 * DAY, startOfKstDay(now))),
    viewCount: show.viewCount,
    startDate: toKstDate(firstDay),
    endDate: toKstDate(lastDay),
    schedules: buildSchedules(show, firstDay),
    detailImageUrls: posterUrl ? [posterUrl] : [],
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
