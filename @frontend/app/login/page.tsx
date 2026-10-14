import Image from 'next/image';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_KEYS } from '@/constants/common/auth';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms';
import { AlertCircleIcon } from 'lucide-react';
import DemoLoginGuard from './_components/DemoLoginGuard';
import { RETURN_TO_PARAM } from '@/lib/auth/session';

const SOCIAL_PROVIDERS = [
  {
    id: 'google',
    name: '구글',
    bgClass: 'bg-white border border-input hover:bg-muted',
    textClass: 'text-foreground',
    icon: (
      <svg className="size-6 shrink-0" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'naver',
    name: '네이버',
    bgClass: 'bg-[#03C75A] hover:bg-[#02b350]',
    textClass: 'text-white',
    icon: (
      <Image
        src="/naver_icon.png"
        alt=""
        width={0}
        height={0}
        className="size-6 shrink-0 object-contain"
        unoptimized
      />
    ),
  },
  {
    id: 'kakao',
    name: '카카오',
    bgClass: 'bg-[#FEE500] hover:bg-[#f5dc00]',
    textClass: 'text-[#191919]',
    icon: (
      <Image
        src="/kakao_icon.png"
        alt=""
        width={0}
        height={0}
        className="size-7 shrink-0 object-contain"
      />
    ),
  },
] as const;

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string | string[];
    returnTo?: string | string[];
  }>;
};

const AUTH_CALLBACK_MESSAGES: Record<string, string> = {
  invalid: '인증 코드가 없거나 유효하지 않습니다. 다시 시도해 주세요.',
  failed: '로그인 실패했습니다. 다시 시도해 주세요.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawMessage = params?.message;
  const messageKey =
    rawMessage == null ? null : Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
  const errorMessage = messageKey ? (AUTH_CALLBACK_MESSAGES[messageKey] ?? messageKey) : null;
  // 로그인에 실패해 돌아왔으면(백엔드는 돌아갈 주소를 모름) 보관해 둔 주소를 이어 씀
  const returnTo =
    [params?.returnTo].flat()[0] ??
    (params?.error || messageKey
      ? (await cookies()).get(AUTH_COOKIE_KEYS.RETURN_TO)?.value
      : undefined);
  // 로그인 시작 라우트가 돌아갈 주소를 쿠키에 보관한 뒤 백엔드 소셜 로그인으로 보냄
  const loginStartHref = (provider: string) => {
    const query = new URLSearchParams({ provider });
    if (returnTo) query.set(RETURN_TO_PARAM, returnTo);
    return `/api/auth/login?${query}`;
  };

  return (
    <div className="bg-muted/30 flex h-[calc(100vh-3.75rem)] flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md -translate-y-7.5 flex-col items-stretch gap-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>로그인 실패</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">MOA Place</CardTitle>
            <CardDescription>소셜 계정으로 로그인하거나 회원가입할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DemoLoginGuard>
              <div className="grid gap-3">
                {SOCIAL_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    size="lg"
                    className={`h-12 min-h-12 w-full py-0 ${provider.bgClass} ${provider.textClass}`}
                    asChild
                  >
                    <a
                      href={loginStartHref(provider.id)}
                      className="relative flex h-12 min-h-12 w-full items-center justify-start px-4 py-0"
                    >
                      <span className="flex h-5 w-8 shrink-0 items-center justify-center">
                        {provider.icon}
                      </span>
                      <span className="absolute right-0 left-0 flex justify-center text-sm leading-none">
                        {provider.name}로 계속하기
                      </span>
                    </a>
                  </Button>
                ))}
              </div>
            </DemoLoginGuard>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
