import { AUTH_COOKIE_KEYS } from '@/constants/common/auth';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import { MY_PAGE_ROUTES, USER_ROUTES } from '@/constants/route/userRoutes';
import {
  ADMIN_ONLY_ERROR,
  type AccessTokenClaims,
  authCookieOptions,
  isTokenAlive,
  loginPath,
  readAccessToken,
  refreshAccessToken,
  type RefreshResult,
  withAccessToken,
} from '@/lib/auth/session';
import type { UserRole } from '@shared/enums';
import { NextRequest, NextResponse } from 'next/server';

// 로그인이 필요한 화면(경로 앞부분 일치). role 이 있으면 그 역할만 들어감
const GUARDED_ROUTES: { prefix: string; role?: UserRole }[] = [
  { prefix: ADMIN_ROUTES.DASHBOARD, role: 'ADMIN' },
  { prefix: MY_PAGE_ROUTES.HOME },
  { prefix: '/shows/reservation' },
];

// 만료가 이보다 가까우면 미리 재발급
const REFRESH_MARGIN_MS = 60_000;

interface Session {
  claims: AccessTokenClaims | null;
  refreshed?: Extract<RefreshResult, { status: 'ok' }>;
  rejected?: boolean;
}

async function resolveSession(request: NextRequest): Promise<Session> {
  const claims = readAccessToken(request.cookies.get(AUTH_COOKIE_KEYS.ACCESS_TOKEN)?.value);
  if (isTokenAlive(claims, REFRESH_MARGIN_MS)) return { claims };

  const refreshToken = request.cookies.get(AUTH_COOKIE_KEYS.REFRESH_TOKEN)?.value;
  const alive = isTokenAlive(claims) ? claims : null;
  if (!refreshToken) return { claims: alive };

  const result = await refreshAccessToken(refreshToken);
  if (result.status === 'ok') {
    return { claims: readAccessToken(result.accessToken), refreshed: result };
  }
  return { claims: alive, rejected: result.status === 'invalid' };
}

/**
 * 페이지 요청마다 서버에서 로그인을 확인
 * - 로그인이 필요한 화면은 화면을 내려주기 전에 로그인 화면으로(돌아올 주소 포함)
 * - 로그인 토큰이 만료됐거나 곧 만료되면 갱신용 토큰으로 재발급
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { claims, refreshed, rejected } = await resolveSession(request);
  const guard = GUARDED_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  let response: NextResponse;
  if (guard && !claims) {
    response = NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
  } else if (guard?.role && claims?.role !== guard.role) {
    const home = new URL(USER_ROUTES.HOME, request.url);
    home.searchParams.set('error', ADMIN_ONLY_ERROR);
    response = NextResponse.redirect(home);
  } else if (refreshed) {
    // 이어지는 서버 렌더링도 새 토큰으로 백엔드를 부르도록 요청 쿠키를 바꿔 넘김
    const headers = new Headers(request.headers);
    headers.set('cookie', withAccessToken(request.headers.get('cookie'), refreshed.accessToken));
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }

  if (refreshed) {
    response.cookies.set(
      AUTH_COOKIE_KEYS.ACCESS_TOKEN,
      refreshed.accessToken,
      authCookieOptions(refreshed.maxAge),
    );
  }
  if (rejected) {
    response.cookies.delete(AUTH_COOKIE_KEYS.ACCESS_TOKEN);
    response.cookies.delete(AUTH_COOKIE_KEYS.REFRESH_TOKEN);
  }
  return response;
}

export const config = {
  // API 중계 라우트·정적 파일·이미지는 거치지 않음
  matcher: ['/((?!api/|_next/static|_next/image|.*\\..*).*)'],
};
