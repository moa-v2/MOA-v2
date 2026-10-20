import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR, Sansation } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/client-providers';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { AlertProvider } from '@/components/molecules/AlertContext';
import { AppFooter } from '@/components/organisms/AppFooter';
import { AppHeader } from '@/components/organisms/AppHeader';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-noto-kr',
});

// 로고 글꼴. 외부 CSS 로 받으면 첫 화면을 그리기 전에 기다려야 해서 직접 내려줌
const sansation = Sansation({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-sansation-face',
});

// 화면별 제목은 'OOO | MOA Place' 로 붙음(공연 상세 generateMetadata)
export const metadata: Metadata = {
  title: { default: 'MOA Place', template: '%s | MOA Place' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 글꼴 변수는 html 에 둬야 :root 에 정의된 --font-sansation 이 풀림(body 에 두면 로고 글꼴이 빠짐)
    <html lang="ko" className={`${inter.variable} ${notoSansKr.variable} ${sansation.variable}`}>
      {/* 브라우저 확장(ColorZilla 등)이 body 에 넣는 속성으로 나는 하이드레이션 경고만 끔(이 태그 속성만, 안쪽은 계속 검사) */}
      <body className="font-sans" suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            <AlertProvider>
              <AppHeader />
              <main>{children}</main>
              <AppFooter />
            </AlertProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
