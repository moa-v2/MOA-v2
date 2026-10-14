import SeatList from '@/app/admin/seat/_components/SeatList';
import { Suspense } from 'react';

export default function SeatPage() {
  // 목록 조건을 주소(useSearchParams)에서 읽어서 Suspense 로 감싸야 함
  return (
    <Suspense>
      <SeatList />
    </Suspense>
  );
}
