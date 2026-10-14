/** 토큰 키 */
export const AUTH_COOKIE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  // 소셜 로그인을 다녀오는 동안 보관하는 '로그인 뒤 돌아갈 주소'
  RETURN_TO: 'returnTo',
} as const;
