import { Loader2 } from 'lucide-react';

// 서버가 공연 정보를 받는 동안 바로 보여줌(백엔드가 응답하지 않으면 최대 5초)
export default function ShowDetailLoading() {
  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center gap-3 px-5 sm:px-6 lg:px-8">
      <Loader2 className="text-muted-foreground h-7 w-7 animate-spin" />
      <p className="text-muted-foreground text-sm">공연 정보를 불러오는 중입니다.</p>
    </div>
  );
}
