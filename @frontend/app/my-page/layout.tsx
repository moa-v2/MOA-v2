import { MyPageSideBar } from '@/components/organisms/MyPageSideBar';

// 로그인 확인은 proxy.ts 가 화면을 내려주기 전에 함
export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="border-border flex overflow-hidden rounded-lg border">
          <MyPageSideBar />
          <main className="min-w-0 flex-1 p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
