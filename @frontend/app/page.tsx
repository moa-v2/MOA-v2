'use client';

import ShowList from './(home)/_components/ShowList';
import MainHeroBanner from '@/components/organisms/MainHeroBanner';

// 메인 홈
export default function Home() {
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
