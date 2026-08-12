// 개발 전용 UI 리허설 갤러리 (/dev/ui) — 세션 진행 없이 이야기 진행·활동 화면을 상태별로 즉시 확인.
// 프로덕션 빌드에서는 존재하지 않는 라우트로 취급한다(404).
import { notFound } from 'next/navigation';
import { UiRehearsalGallery } from './gallery';

export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiRehearsalGallery />;
}
