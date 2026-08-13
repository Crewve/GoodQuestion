// 공지사항 상세 (기능명세서 3.3 / 피그마 3.3 공지사항 상세) — 목록에서 행 클릭 시 진입.
// 정적 콘텐츠(notices-data) 기준, 없는 id는 404. 하단 '목록으로 돌아가기'와 헤더 뒤로가기 모두 목록 복귀.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { MyPageHeader } from '../../accordion';
import { NOTICES } from '../notices-data';

export default async function NoticeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const notice = NOTICES.find((n) => n.id === id);
  if (!notice) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref="/my/notices" />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">공지사항</h2>

        <article className="mt-10 overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">
          <header className="border-b border-[#E8E2DA] px-5 py-[18px]">
            <h3 className="text-[15px] font-bold text-[#1E1A14]">{notice.title}</h3>
            <p className="mt-1 text-[13px] text-[#7A7268]">{notice.date}</p>
          </header>
          <p className="whitespace-pre-line px-5 py-5 text-[15px] leading-[1.8] text-[#1E1A14]">{notice.body}</p>
        </article>

        <Link
          href="/my/notices"
          className="mt-8 flex h-12 items-center justify-center gap-2 self-center rounded-full bg-primary px-6 text-[15px] font-bold text-white active:bg-ink"
        >
          <span aria-hidden>←</span> 목록으로 돌아가기
        </Link>
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
