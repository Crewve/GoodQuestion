// 공지사항 상세 (기능명세서 3.3 / 피그마 「개발 배포용」 3.3 공지사항_상세) — 목록에서 행 클릭 시 진입.
// 정적 콘텐츠(notices-data) 기준, 없는 id는 404. 하단 '목록으로'와 헤더 뒤로가기 모두 목록 복귀.
// 카드는 피그마 실측(2026-08-14)대로 테두리·라운드 없는 흰 박스(pad 24/32) — 제목 22 Bold·날짜 14·본문 15/1.8.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { MyPageHeader } from '../../accordion';
import { NOTICES } from '../notices-data';

export default async function NoticeDetailPage(props: PageProps<'/my/notices/[id]'>) {
  const { id } = await props.params;
  // 아이 컨텍스트(?child=)는 GNB·목록 복귀 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;
  const notice = NOTICES.find((n) => n.id === id);
  if (!notice) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my/notices', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">공지사항</h2>

        <article className="mt-10 bg-white px-6 py-8">
          <h3 className="text-[22px] font-bold leading-[1.4] text-[#1E1A14]">{notice.title}</h3>
          <p className="mt-2 text-sm text-[#7A7268]">{notice.date}</p>
          <hr className="mt-5 border-t border-[#E8E2DA]" />
          <p className="mt-7 whitespace-pre-line text-[15px] leading-[1.8] text-[#1E1A14]">{notice.body}</p>
        </article>

        <Link
          href={withChild('/my/notices', childId)}
          className="mt-5 flex h-[46px] w-[172px] items-center justify-center self-center rounded-full border border-[#C8D8D0] bg-white text-base font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.07)] active:bg-ink active:text-white"
        >
          목록으로
        </Link>
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
