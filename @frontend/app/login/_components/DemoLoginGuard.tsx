'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/atoms';
import { demoModeStore } from '@/lib/api-client';
import { AlertCircleIcon } from 'lucide-react';
import { useStore } from 'zustand';

/** 백엔드에 연결할 수 없으면 로그인 버튼을 막고 안내를 보여줌(버튼이 꺼진 백엔드 주소로 이동함) */
export default function DemoLoginGuard({ children }: { children: React.ReactNode }) {
  const isDemo = useStore(demoModeStore, (state) => state.active);
  if (!isDemo) return children;

  return (
    <>
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>지금은 로그인할 수 없습니다</AlertTitle>
        <AlertDescription>
          서버에 연결할 수 없어 로그인과 예매를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.
        </AlertDescription>
      </Alert>
      <div inert className="opacity-50">
        {children}
      </div>
    </>
  );
}
