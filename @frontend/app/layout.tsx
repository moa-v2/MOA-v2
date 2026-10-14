import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR, Sansation } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/client-providers';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { AlertProvider } from '@/components/molecules/AlertContext';
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
    <html lang="ko">
      <body className={`${inter.variable} ${notoSansKr.variable} ${sansation.variable} font-sans`}>
        <Providers>
          <AuthProvider>
            <AlertProvider>
              <AppHeader />
              <main>{children}</main>
            </AlertProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
