import ShowList from '@/app/admin/shows/_components/ShowList';
import { Suspense } from 'react';

export default function ShowListPage() {
  // 목록 조건을 주소(useSearchParams)에서 읽어서 Suspense 로 감싸야 함
  return (
    <Suspense>
      <ShowList />
    </Suspense>
  );
}
