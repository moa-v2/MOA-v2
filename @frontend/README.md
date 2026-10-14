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

테스트를 실행합니다. 테스트용 개발 서버를 3100 포트로 새로 띄우므로 그 포트는 비워 두세요(`E2E_PORT`로 변경 가능):

```bash
pnpm test:e2e
```

- 테스트용 서버는 가짜 백엔드(`e2e/mock-backend.mjs`, 59999 포트)에 붙어, 실제 백엔드 상태와 상관없이 항상 같은 결과가 나옵니다. 가짜 백엔드는 로그인 토큰 교환·재발급에만 응답하고, 그 밖의 요청은 502라 아래 데모 데이터로 응답합니다.
- Next 16은 한 폴더에서 개발 서버를 하나만 띄울 수 있어, 같은 폴더에서 `pnpm dev`가 떠 있으면 먼저 꺼야 합니다.
- 실패한 테스트는 `test-results/`에 영상·trace가 남습니다. `pnpm exec playwright show-trace <trace.zip>`으로 열어 볼 수 있습니다.
- 모든 테스트를 녹화하려면 `E2E_VIDEO=on pnpm test:e2e`로 실행합니다.

### 백엔드에 연결할 수 없을 때 (데모 데이터)

API 요청은 모두 `app/api/[...path]`를 거쳐 백엔드로 갑니다. 백엔드가 응답하지 않으면(연결 실패, 조회 5초 초과, 502·503·504) 이렇게 동작합니다.

- 공연 목록·상세·잔여석 조회는 `lib/static-content.ts`의 데모 데이터로 응답하고, 화면 위에 데모 안내가 표시됩니다.
- 로그인·예매 등 그 외 요청은 이용 불가(503)로 응답하고, 로그인 화면에 안내가 표시됩니다.
- 한 번 실패하면 3분 동안은 백엔드를 기다리지 않고 바로 데모 데이터로 응답합니다.

### 로그인 확인 (`proxy.ts`)

페이지 요청은 화면을 내려주기 전에 `proxy.ts`를 거칩니다.

- 마이페이지·예매 화면은 로그인하지 않았으면 `/login?returnTo=원래주소`로 보냅니다. 관리자 화면은 관리자 역할이 아니면 홈으로 보내고 안내합니다. 역할은 로그인 토큰 내용으로 판단하고, 토큰 서명 검증은 백엔드가 API마다 합니다.
- 로그인 토큰이 만료됐거나 곧 만료되면 갱신용 토큰으로 다시 발급합니다. API 호출 중에 만료돼 401이 오면 중계 라우트(`app/api/[...path]`)가 다시 발급받아 한 번 더 요청합니다.
- 백엔드는 소셜 로그인 뒤 항상 `/api/auth/callback`으로만 돌려보내므로, 로그인 버튼은 `/api/auth/login`을 거쳐 돌아갈 주소를 쿠키에 10분간 보관합니다. 같은 사이트의 화면 주소만 받습니다(`lib/auth/session.ts`의 `sanitizeReturnTo`).

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
