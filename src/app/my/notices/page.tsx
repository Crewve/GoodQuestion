// 공지사항 (T058, 기능명세서 3.3) — 등록된 공지 목록·항목 클릭 시 같은 화면에서 내용 표시(아코디언).
// MVP 정적 콘텐츠 — 목록이 비면 3.3 예외 원문 "등록된 공지사항이 없습니다" 노출 (데이터 연동 시 교체 지점).
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { AccordionItem, AccordionList } from '../accordion';

const EMPTY_MESSAGE = '등록된 공지사항이 없습니다'; // 기능명세서 3.3 원문

const NOTICES: { title: string; date: string; body: string }[] = [
  {
    title: '굿퀘스천 시연 버전 안내',
    date: '2026.08.10',
    body: '지금 보고 계신 굿퀘스천은 시연용 MVP 버전입니다.\n동화 「방귀 뀌는 며느리」로 대화 학습 전체 흐름(이야기 감상 → 캐릭터 대화 → 학습완료 활동)을 체험하실 수 있어요.\n정식 서비스에서는 더 많은 전래동화가 순차적으로 추가될 예정입니다.',
  },
  {
    title: '아이 프로필 등록 안내',
    date: '2026.08.03',
    body: '한 계정에 아이 프로필을 최대 3명까지 등록할 수 있습니다.\n내정보 > 프로필 관리에서 아이 프로필을 추가하거나 수정·삭제할 수 있어요.',
  },
];

export default function NoticesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <Link href="/my" className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-3xl text-ink">공지사항</h1>

        {NOTICES.length === 0 ? (
          <p className="text-lg text-ink/70">{EMPTY_MESSAGE}</p>
        ) : (
          <AccordionList>
            {NOTICES.map((notice) => (
              <AccordionItem key={notice.title} title={notice.title} meta={notice.date}>
                {notice.body}
              </AccordionItem>
            ))}
          </AccordionList>
        )}
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
