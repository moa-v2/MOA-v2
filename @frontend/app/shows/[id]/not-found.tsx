import { NotFoundView } from '@/components/organisms/NotFoundView';

export default function ShowNotFound() {
  return (
    <NotFoundView
      title="존재하지 않는 공연입니다"
      description="공연이 내려갔거나 주소가 잘못되었을 수 있습니다."
    />
  );
}
