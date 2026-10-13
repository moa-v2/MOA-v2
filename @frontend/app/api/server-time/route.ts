// 빌드 시 정적 응답으로 굳으면 Date 헤더가 고정됨
export const dynamic = 'force-dynamic';

/**
 * 서버 시계 동기화용
 * - 클라이언트는 응답 Date 헤더만 읽으므로 본문 없음
 * - 오픈 직전 요청이 몰려도 백엔드까지 가지 않도록 Next 서버에서 바로 응답
 */
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
