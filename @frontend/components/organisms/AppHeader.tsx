'use client';

import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import { demoModeStore } from '@/lib/api-client';
import { usePathname } from 'next/navigation';
import { useStore } from 'zustand';
import { Header } from './Header';

const HIDE_HEADER_PREFIXES = [ADMIN_ROUTES.DASHBOARD, '/shows/reservation'] as const;

export function AppHeader() {
  const pathname = usePathname();
  const hidden = HIDE_HEADER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isDemo = useStore(demoModeStore, (state) => state.active);

  return (
    <>
      <Header hidden={hidden} />
      {isDemo && !hidden && (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          서버에 연결할 수 없어 데모 데이터를 보여주고 있습니다. 로그인과 예매는 이용할 수 없습니다.
        </p>
      )}
    </>
  );
}
