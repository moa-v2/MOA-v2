import UserList from '@/app/admin/user/_components/UserList';
import { Suspense } from 'react';

export default function UserListPage() {
  // 목록 조건을 주소(useSearchParams)에서 읽어서 Suspense 로 감싸야 함
  return (
    <Suspense>
      <UserList />
    </Suspense>
  );
}
