import { NotFoundView } from '@/components/organisms/NotFoundView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '페이지를 찾을 수 없음' };

export default function NotFound() {
  return (
    <NotFoundView
      title="페이지를 찾을 수 없습니다"
      description="주소가 잘못 입력되었거나, 페이지가 이동 또는 삭제되었을 수 있습니다."
    />
  );
}
