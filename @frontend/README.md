# MOA (Musical On Air) 🎭

Next.js를 기반으로 한 공연 예매 플랫폼 프론트엔드 프로젝트입니다.

## 시작하기

### 환경 설정

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
# 백엔드 API URL
NEXT_PUBLIC_BACKEND_URL=http://moa.hee-factory.com
```

## 🏗️ 아키텍처

이 프로젝트는 **Atomic Design** 원칙에 따라 컴포넌트를 구성합니다:

```
components/
├── atoms/           # 기본 UI 컴포넌트 (Button, Input, Card...)
├── molecules/       # 복합 UI 컴포넌트 (FormField, FormInput...)
├── organisms/       # 재사용 가능한 복합 컴포넌트 (AdminSidebar, AdminBreadcrumb)
└── pages/           # 도메인별 페이지 컴포넌트
app/
└── admin/shows/upsert/
    └── _components/ # 페이지별 컴포넌트 (ShowUpsertForm) - Next.js 라우팅 제외
```

### API 호출 방식

- **개발 환경** (`NODE_ENV=development`): 클라이언트가 직접 백엔드 API를 호출합니다. 네트워크 탭에서 API 요청을 확인할 수 있습니다.
- **프로덕션 환경** (`NODE_ENV=production`): Next.js API Routes를 통해 백엔드 API를 호출합니다. 백엔드 API가 네트워크 탭에 노출되지 않습니다.

### 개발 서버 실행

개발 서버를 실행합니다:

```bash
npm run dev
# 또는
yarn dev
# 또는
pnpm dev
# 또는
bun dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

`app/page.tsx` 파일을 수정하면 페이지가 자동으로 업데이트됩니다.

### E2E 테스트 (Playwright)

처음 한 번 테스트용 브라우저를 설치합니다:

```bash
pnpm exec playwright install chromium
```

테스트를 실행합니다. 3100 포트에 개발 서버가 없으면 자동으로 띄웁니다(`E2E_PORT`로 변경 가능):

```bash
pnpm test:e2e
```

- 백엔드 응답은 테스트 안에서 가짜로 채우므로 백엔드 서버 없이도 돕니다.
- 실패한 테스트는 `test-results/`에 영상·trace가 남습니다. `pnpm exec playwright show-trace <trace.zip>`으로 열어 볼 수 있습니다.
- 모든 테스트를 녹화하려면 `E2E_VIDEO=on pnpm test:e2e`로 실행합니다.

## 기술 스택

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form + Zod
- **UI Components**: Radix UI + Shadcn/ui
- **Font**: Inter, Noto Sans KR (next/font 사용)

## 배포

Vercel 플랫폼을 사용하여 손쉽게 배포할 수 있습니다:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=github&utm_campaign=github-readme)

Next.js 배포 문서를 확인하세요: [https://nextjs.org/docs/app/building-your-application/deploying](https://nextjs.org/docs/app/building-your-application/deploying)

## 더 알아보기

Next.js에 대해 더 자세히 알아보려면 다음 리소스를 확인하세요:

- [Next.js 문서](https://nextjs.org/docs) - Next.js 기능 및 API
- [Next.js 학습](https://nextjs.org/learn) - 대화형 Next.js 튜토리얼

[Next.js GitHub 저장소](https://github.com/vercel/next.js)를 확인하고 피드백이나 기여를 환영합니다!
