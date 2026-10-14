'use client';

import ShowList from './(home)/_components/ShowList';
import MainHeroBanner from '@/components/organisms/MainHeroBanner';
import { useAlert } from '@/components/molecules/AlertContext';
import { ADMIN_ONLY_ERROR } from '@/lib/auth/session';
import { useEffect } from 'react';

// 메인 홈
export default function Home() {
  const { alert } = useAlert();

  // 관리자가 아닌 계정으로 관리자 화면에 들어오면 proxy.ts 가 여기로 보냄
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('error') !== ADMIN_ONLY_ERROR) return;
    url.searchParams.delete('error');
    window.history.replaceState(null, '', url);
    alert({ title: '접근 불가', description: '권한이 없습니다. 관리자만 접근 가능합니다.' });
  }, [alert]);

  return (
    <div className="min-h-screen">
      {/* Banner Section */}
      <section>
        <MainHeroBanner />
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Featured Shows */}
          <div className="mb-16">
            <h2 className="mb-8 text-2xl font-bold">장르별 인기공연</h2>

            <ShowList showRank />
          </div>
        </div>
      </section>
    </div>
  );
}
