import { AUTH_COOKIE_KEYS } from '@/constants/common/auth';
import { BE_URL } from '@/constants/common/url';
import { authCookieOptions, refreshAccessToken, withAccessToken } from '@/lib/auth/session';
import { getDemoResponse } from '@/lib/static-content';
import { NextRequest, NextResponse } from 'next/server';

type Props = { params: Promise<{ path: string[] }> };

// 조회는 이 시간 안에 응답이 없으면 백엔드가 꺼진 것으로 봄(저장 요청은 오래 걸릴 수 있어 그대로 기다림)
const READ_TIMEOUT_MS = 5_000;
// 한 번 실패하면 이 시간 동안은 백엔드를 다시 기다리지 않고 바로 데모로 응답
const DOWN_HOLD_MS = 3 * 60_000;
// 앞단(Nginx 등)은 살아 있고 앱 서버만 꺼진 경우
const GATEWAY_ERRORS = new Set([502, 503, 504]);

let backendDownUntil = 0;

/** 백엔드 대신 데모 데이터(공연 조회) 또는 이용 불가(그 외)로 응답 */
function respondWithDemo(method: string, path: string, searchParams: URLSearchParams) {
  const { status, body } = getDemoResponse(method, path, searchParams);
  return NextResponse.json(body, { status, headers: { 'x-demo-data': '1' } });
}

/** API Set-Cookie 모두 전달 (로그아웃 등)
 *  getSetCookie 없으면 단일 헤더만 */
function appendSetCookieFromBackend(source: Headers, target: Headers) {
  const withGetter = source as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    for (const c of withGetter.getSetCookie()) {
      target.append('set-cookie', c);
    }
    return;
  }
  const single = source.get('set-cookie');
  if (single) {
    target.append('set-cookie', single);
  }
}

async function proxyRequest(request: NextRequest, { params }: Props) {
  try {
    const { path } = await params;
    const pathString = path.join('/');
    const url = new URL(request.url);

    if (Date.now() < backendDownUntil) {
      return respondWithDemo(request.method, pathString, url.searchParams);
    }

    const contentType = request.headers.get('content-type') ?? 'application/json';
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    const authHeader = request.headers.get('authorization');
    const cookie = request.headers.get('cookie');
    const queueToken = request.headers.get('x-queue-token');
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookie) headers['Cookie'] = cookie;
    if (queueToken) headers['X-Queue-Token'] = queueToken;

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      // multipart는 문자열로 읽으면 이미지 바이너리 손상되므로 raw bytes로 전달
      const isMultipartFormData = contentType.includes('multipart/form-data');
      if (isMultipartFormData) {
        const bodyBuffer = await request.arrayBuffer();
        if (bodyBuffer.byteLength > 0) {
          const mb = (bodyBuffer.byteLength / 1024 / 1024).toFixed(2);
          console.log(
            `[Proxy] ${request.method} /api/${pathString} size: ${bodyBuffer.byteLength.toLocaleString()} bytes (${mb} MB) / type: multipart/form-data`,
          );
          fetchOptions.body = bodyBuffer;
        }
      } else {
        const body = await request.text();
        if (body) {
          const bodySizeBytes = Buffer.byteLength(body, 'utf8');
          const mb = (bodySizeBytes / 1024 / 1024).toFixed(2);
          console.log(
            `[Proxy] ${request.method} /api/${pathString} size: ${bodySizeBytes.toLocaleString()} bytes (${mb} MB) / type: ${contentType.slice(0, 30)} ...`,
          );
          fetchOptions.body = body;
        }
      }
    }

    const backendUrl = `${BE_URL}/api/${pathString}${url.search}`;
    const callBackend = () =>
      fetch(backendUrl, {
        ...fetchOptions,
        signal: request.method === 'GET' ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined,
      });
    const refreshToken = request.cookies.get(AUTH_COOKIE_KEYS.REFRESH_TOKEN)?.value;
    let refreshedAccess: { token: string; maxAge: number } | null = null;
    let sessionRejected = false;
    let response: Response;
    try {
      response = await callBackend();
      // 한 화면에 오래 머물다 로그인 토큰이 만료된 경우: 재발급 받아 한 번만 다시 요청
      if (response.status === 401 && refreshToken && !pathString.startsWith('auth/')) {
        const refreshed = await refreshAccessToken(refreshToken);
        if (refreshed.status === 'ok') {
          refreshedAccess = { token: refreshed.accessToken, maxAge: refreshed.maxAge };
          headers['Cookie'] = withAccessToken(cookie, refreshed.accessToken);
          response = await callBackend();
        } else {
          sessionRejected = refreshed.status === 'invalid';
        }
      }
    } catch (error) {
      console.error('Proxy Error:', error);
      backendDownUntil = Date.now() + DOWN_HOLD_MS;
      return respondWithDemo(request.method, pathString, url.searchParams);
    }
    if (GATEWAY_ERRORS.has(response.status)) {
      backendDownUntil = Date.now() + DOWN_HOLD_MS;
      return respondWithDemo(request.method, pathString, url.searchParams);
    }
    const data = await response.text();

    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('Content-Type');
    if (responseContentType) {
      responseHeaders.set('Content-Type', responseContentType);
    }

    appendSetCookieFromBackend(response.headers, responseHeaders);

    const proxied = new NextResponse(data, {
      status: response.status,
      headers: responseHeaders,
    });
    if (refreshedAccess) {
      proxied.cookies.set(
        AUTH_COOKIE_KEYS.ACCESS_TOKEN,
        refreshedAccess.token,
        authCookieOptions(refreshedAccess.maxAge),
      );
    }
    if (sessionRejected) {
      proxied.cookies.delete(AUTH_COOKIE_KEYS.ACCESS_TOKEN);
      proxied.cookies.delete(AUTH_COOKIE_KEYS.REFRESH_TOKEN);
    }
    return proxied;
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to proxy request' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: Props) {
  return proxyRequest(request, props);
}

export async function POST(request: NextRequest, props: Props) {
  return proxyRequest(request, props);
}

export async function PUT(request: NextRequest, props: Props) {
  return proxyRequest(request, props);
}

export async function DELETE(request: NextRequest, props: Props) {
  return proxyRequest(request, props);
}

export async function PATCH(request: NextRequest, props: Props) {
  return proxyRequest(request, props);
}
