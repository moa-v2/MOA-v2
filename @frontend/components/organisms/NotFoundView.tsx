import { Button } from '@/components/atoms';
import { USER_ROUTES } from '@/constants/route/userRoutes';
import Link from 'next/link';

interface NotFoundViewProps {
  title: string;
  description: string;
}

/** 404 화면(사이트 전체·공연 상세 공용) */
export function NotFoundView({ title, description }: NotFoundViewProps) {
  return (
    <section className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex w-full max-w-md overflow-hidden rounded-2xl text-left shadow-xl">
        <div className="bg-primary text-primary-foreground flex flex-1 flex-col gap-5 p-6">
          <span className="text-[11px] font-semibold tracking-[0.3em] opacity-50">
            MOA PLACE · ADMISSION
          </span>
          <p className="font-logo text-7xl leading-none font-bold tracking-tight">404</p>
          <span className="border-t border-white/15 pt-3 text-xs font-medium tracking-[0.2em] opacity-70">
            PAGE NOT FOUND
          </span>
        </div>
        {/* 절취선 위아래를 반원으로 파냄 */}
        <div className="relative flex w-20 shrink-0 items-center justify-center border-l-2 border-dashed border-slate-300 bg-slate-100 sm:w-24">
          <span className="bg-background absolute -top-3 -left-3 size-6 rounded-full" />
          <span className="bg-background absolute -bottom-3 -left-3 size-6 rounded-full" />
          <span className="text-xs font-semibold tracking-[0.3em] text-slate-400 [writing-mode:vertical-rl]">
            NO ENTRY
          </span>
        </div>
      </div>

      <h1 className="mt-10 text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-balance">
        {description}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild size="lg">
          <Link href={USER_ROUTES.HOME}>메인으로</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={USER_ROUTES.SHOW}>공연 둘러보기</Link>
        </Button>
      </div>
    </section>
  );
}
