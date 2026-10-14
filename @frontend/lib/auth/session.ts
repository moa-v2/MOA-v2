import { AUTH_COOKIE_KEYS } from '@/constants/common/auth';
import { BE_URL } from '@/constants/common/url';
import { HEADER_ROUTES } from '@/constants/route/userRoutes';
import type { UserRole } from '@shared/enums';

// ---------------------------------------------------------------------------
// 로그인 뒤 돌아갈 주소(returnTo)
// ---------------------------------------------------------------------------

export const RETURN_TO_PARAM = 'returnTo';
// 관리자 화면에 관리자가 아닌 계정으로 들어왔을 때 홈으로 보내며 붙이는 값(?error=)
export const ADMIN_ONLY_ERROR = 'admin-only';

const SAME_SITE_BASE = 'http://moa.invalid';

/** 같은 사이트의 화면 주소만 통과(외부 주소로 빼돌리는 오픈 리다이렉트 방지) */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value?.startsWith('/')) return null;
  let url: URL;
  try {
    // '//evil.com', '/\evil.com' 같은 값은 여기서 다른 출처로 해석됨
    url = new URL(value, SAME_SITE_BASE);
  } catch {
    return null;
  }
  if (url.origin !== SAME_SITE_BASE) return null;
  if (url.pathname === HEADER_ROUTES.LOGIN || url.pathname.startsWith('/api/')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginPath(returnTo?: string | null) {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe || safe === '/') return HEADER_ROUTES.LOGIN;
  return `${HEADER_ROUTES.LOGIN}?${new URLSearchParams({ [RETURN_TO_PARAM]: safe })}`;
}

/** 브라우저에서 지금 화면으로 돌아오는 로그인 주소 */
export const loginPathFromHere = () =>
  loginPath(`${window.location.pathname}${window.location.search}`);

// ---------------------------------------------------------------------------
// 토큰 쿠키
// ---------------------------------------------------------------------------

export const authCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

/** 백엔드는 만료 시간을 밀리초로 줌. 쿠키 maxAge 는 초 */
export const toMaxAge = (ms: number | null | undefined, fallbackSeconds: number) =>
  ms != null ? Math.floor(ms / 1000) : fallbackSeconds;

export interface AccessTokenClaims {
  role?: UserRole;
  exp?: number;
}

/** 로그인 토큰(JWT) 내용만 읽음. 서명 검증은 백엔드가 API 마다 함 */
export function readAccessToken(token: string | null | undefined): AccessTokenClaims | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** 만료까지 marginMs 넘게 남았는지 */
export const isTokenAlive = (claims: AccessTokenClaims | null, marginMs = 0) =>
  claims?.exp != null && claims.exp * 1000 > Date.now() + marginMs;

/** 요청 쿠키 헤더의 로그인 토큰만 새 값으로 바꿈(재발급 직후 같은 요청을 이어서 처리할 때) */
export function withAccessToken(cookieHeader: string | null, accessToken: string) {
  const others = (cookieHeader ?? '')
    .split(/;\s*/)
    .filter((pair) => pair && !pair.startsWith(`${AUTH_COOKIE_KEYS.ACCESS_TOKEN}=`));
  return [...others, `${AUTH_COOKIE_KEYS.ACCESS_TOKEN}=${accessToken}`].join('; ');
}

// ---------------------------------------------------------------------------
// 로그인 토큰 재발급(서버 전용: proxy.ts, API 중계 라우트)
// ---------------------------------------------------------------------------

export type RefreshResult =
  | { status: 'ok'; accessToken: string; maxAge: number }
  // 백엔드가 거절(로그아웃했거나 다른 기기에서 다시 로그인함) → 토큰 쿠키를 지움
  | { status: 'invalid' }
  // 백엔드 응답 없음 → 쿠키는 그대로 두고 다음에 다시 시도
  | { status: 'unavailable' };

const REFRESH_TIMEOUT_MS = 3_000;
// 백엔드가 꺼져 있으면 페이지 이동마다 기다리지 않도록 잠시 재발급을 쉼
const REFRESH_PAUSE_MS = 60_000;
let refreshPausedUntil = 0;

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  if (Date.now() < refreshPausedUntil) return { status: 'unavailable' };
  try {
    const response = await fetch(`${BE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `${AUTH_COOKIE_KEYS.REFRESH_TOKEN}=${refreshToken}` },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (response.status >= 400 && response.status < 500) return { status: 'invalid' };
    const body = response.ok ? await response.json() : null;
    const accessToken: string | undefined = body?.data?.accessToken;
    if (!accessToken) throw new Error(`refresh failed (${response.status})`);
    return {
      status: 'ok',
      accessToken,
      maxAge: toMaxAge(body.data.accessTokenExpiresIn, 30 * 60),
    };
  } catch {
    refreshPausedUntil = Date.now() + REFRESH_PAUSE_MS;
    return { status: 'unavailable' };
  }
}
