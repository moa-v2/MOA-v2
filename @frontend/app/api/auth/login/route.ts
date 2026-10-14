import { AUTH_COOKIE_KEYS } from '@/constants/common/auth';
import { BE_URL } from '@/constants/common/url';
import { HEADER_ROUTES } from '@/constants/route/userRoutes';
import { authCookieOptions, RETURN_TO_PARAM, sanitizeReturnTo } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';

const PROVIDERS = ['google', 'naver', 'kakao'];
// 백엔드가 로그인 뒤 돌려보낼 프론트 주소(로컬/배포)를 고르는 값
const ENV_PARAM = process.env.NODE_ENV === 'production' ? 'prod' : 'local';
const RETURN_TO_MAX_AGE = 10 * 60;

/**
 * 소셜 로그인 시작
 * - 백엔드는 로그인 뒤 항상 /api/auth/callback 으로만 돌려보내므로, 돌아갈 주소는 프론트 쿠키에 보관
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provider = searchParams.get('provider');
  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.redirect(new URL(HEADER_ROUTES.LOGIN, request.url));
  }

  const response = NextResponse.redirect(
    `${BE_URL}/oauth2/authorization/${provider}?env=${ENV_PARAM}`,
  );
  const returnTo = sanitizeReturnTo(searchParams.get(RETURN_TO_PARAM));
  if (returnTo) {
    response.cookies.set(
      AUTH_COOKIE_KEYS.RETURN_TO,
      returnTo,
      authCookieOptions(RETURN_TO_MAX_AGE),
    );
  } else {
    // 예전에 남은 주소로 돌아가지 않도록
    response.cookies.delete(AUTH_COOKIE_KEYS.RETURN_TO);
  }
  return response;
}
