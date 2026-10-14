'use client';

import { SidebarProvider } from '@/components/atoms/sidebar';
import { AdminSidebar } from '@/components/organisms/AdminSidebar';
import { AdminBreadcrumb } from '@/components/organisms/AdminBreadcrumb';
import React, { useEffect } from 'react';
import { useAlert } from '@/components/molecules/AlertContext';
import { setGlobalAlertHandler, setGlobalRouter } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

// 로그인·관리자 권한 확인은 proxy.ts 가 화면을 내려주기 전에 함
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { alert } = useAlert();

  useEffect(() => {
    setGlobalAlertHandler(alert);
    setGlobalRouter(router);
  }, [alert, router]);

  return (
    <SidebarProvider style={{ '--sidebar-width': '12rem' } as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <main className="bg-muted/40 flex-1">
          <div className="bg-background border-b px-6 py-4">
            <AdminBreadcrumb />
          </div>
          <div className="in-h-screen bg-slate-50 py-8">
            <div className="mr-8 ml-8">{children}</div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
