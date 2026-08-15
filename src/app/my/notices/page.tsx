// 공지사항 목록 (T058, 기능명세서 3.3 / 피그마 「개발 배포용」 3.3 공지사항 목록·상세).
// 스토리보드 확인(2026-08-13)에 따라 아코디언에서 상세 페이지 이동 방식으로 변경 —
// 한 카드에 행 구분선(제목·날짜·화살표), 행 클릭 시 /my/notices/[id] 상세로 이동.
// 목록이 비면 3.3 예외 원문 "등록된 공지사항이 없습니다" 노출 (데이터 연동 시 교체 지점).
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { ChevronNextIcon } from '@/components/icons';
import { MyPageHeader } from '../accordion';
import { NOTICES } from './notices-data';

const EMPTY_MESSAGE = '등록된 공지사항이 없습니다'; // 기능명세서 3.3 원문

export default async function NoticesPage(props: PageProps<'/my/notices'>) {
  // 아이 컨텍스트(?child=)는 GNB·뒤로가기·상세 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">공지사항</h2>

        {NOTICES.length === 0 ? (
          <p className="mt-10 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>
        ) : (
          <section className="mt-10 overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">
            {NOTICES.map((notice) => (
              <Link
                key={notice.id}
                href={withChild(`/my/notices/${notice.id}`, childId)}
                className="flex min-h-14 items-center gap-4 border-b border-[#E8E2DA] px-5 py-[18px] last:border-b-0 active:bg-background"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#1E1A14]">{notice.title}</span>
                  <span className="mt-1 block text-[13px] text-[#7A7268]">{notice.date}</span>
                </span>
                {/* 행 진입 표시 — 텍스트 › 대신 에셋 chevron_next (내정보 목록과 통일, #161 계열) */}
                <ChevronNextIcon className="h-3.5 w-2 shrink-0 text-[#7A7268]" />
              </Link>
            ))}
          </section>
        )}
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
