// E2E 용 가짜 백엔드: 로그인 토큰 교환·재발급과 테스트가 등록한 공연 상세만 응답하고, 나머지는 502(→ 데모 데이터로 응답)
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_BACKEND_PORT ?? 59999);
const ACCESS_TTL_MS = 30 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 교환 코드·갱신용 토큰 → 역할. 목록에 없는 갱신용 토큰은 로그아웃된 것으로 보고 거절
const ROLE_BY_CODE = { 'code-user': 'USER', 'code-admin': 'ADMIN' };
const ROLE_BY_REFRESH = { 'refresh-user': 'USER', 'refresh-admin': 'ADMIN' };

const b64url = (value) => Buffer.from(value).toString('base64url');
// 프론트는 토큰 내용만 읽으므로(서명 검증은 백엔드 몫) 형식만 맞춤
const accessToken = (role) =>
  `${b64url('{"alg":"HS256"}')}.${b64url(
    JSON.stringify({
      sub: `${role.toLowerCase()}@moa.test`,
      role,
      exp: Math.floor((Date.now() + ACCESS_TTL_MS) / 1000),
    }),
  )}.signature`;

const tokens = (role) => ({
  accessToken: accessToken(role),
  refreshToken: `refresh-${role.toLowerCase()}`,
  accessTokenExpiresIn: ACCESS_TTL_MS,
  refreshTokenExpiresIn: REFRESH_TTL_MS,
});

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

// 테스트가 등록한 공연 상세(서버 렌더링이 받아 감). 등록 안 된 공연은 502 → 데모 데이터
const shows = new Map();

createServer(async (req, res) => {
  const showPath = /^\/(?:__e2e|api\/v1)\/shows\/(\d+)$/.exec(req.url);
  if (req.method === 'PUT' && req.url.startsWith('/__e2e/') && showPath) {
    shows.set(showPath[1], await readBody(req));
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && showPath && shows.has(showPath[1])) {
    return send(res, 200, { success: true, data: shows.get(showPath[1]), message: null });
  }
  if (req.method === 'POST' && req.url === '/api/auth/exchange-code') {
    const role = ROLE_BY_CODE[(await readBody(req)).code];
    return role
      ? send(res, 200, { success: true, data: tokens(role) })
      : send(res, 400, { success: false, message: '유효하지 않은 코드' });
  }
  if (req.method === 'POST' && req.url === '/api/auth/refresh') {
    const refresh = /(?:^|;\s*)refreshToken=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const role = ROLE_BY_REFRESH[refresh];
    return role
      ? send(res, 200, { success: true, data: tokens(role) })
      : send(res, 401, { success: false, message: '다시 로그인해주세요.' });
  }
  send(res, 502, { message: 'mock backend: not implemented' });
}).listen(PORT, '127.0.0.1');
