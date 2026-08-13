// 1:1 문의 상세 (기능명세서 3.4 / 피그마 「개발 배포용」 3.4 고객센터_문의 상세).
// 카테고리·상태 칩 → 제목 20 → 날짜 12.8 → 내 문의 본문 15 → 답변 영역(대기: ⏳ 안내 / 완료: 답변 본문) → 목록으로.
// 정적 콘텐츠(inquiries-data) 기준, 없는 id는 404. 목록 복귀는 공지 상세와 동일 패턴.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { MyPageHeader } from '../../../accordion';
import { INQUIRIES } from '../../inquiries-data';

export default async function InquiryDetailPage(props: PageProps<'/my/support/inquiries/[id]'>) {
  const { id } = await props.params;
  const inquiry = INQUIRIES.find((item) => item.id === id);
  if (!inquiry) notFound();

  // 아이 컨텍스트(?child=)는 GNB·목록 복귀 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  const waiting = inquiry.status === '답변대기';

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my/support/inquiries', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">고객센터</h2>

        <article className="mt-10 overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">
          <header className="border-b border-[#E8E2DA] px-5 py-[18px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-[#F5EDE0] px-2.5 py-1 text-[13px] font-bold text-[#6F6152]">
                {inquiry.category}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-bold ${
                  waiting ? 'bg-primary/15 text-[#B33D0D]' : 'bg-[#DDF5EC] text-[#177A4F]'
                }`}
              >
                {inquiry.status}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-[#1E1A14]">{inquiry.title}</h3>
            <p className="mt-1 text-[13px] text-[#7A7268]">{inquiry.date}</p>
          </header>
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-[#7A7268]">내 문의</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.7] text-[#1E1A14]">{inquiry.body}</p>
          </div>
        </article>

        {waiting ? (
          // 답변 대기 — 스토리보드: 모래시계 + 안내 2줄 중앙 정렬 박스
          <section className="mt-4 rounded-2xl border border-dashed border-[#E8E2DA] bg-white px-5 py-8">
            <p className="text-center text-sm font-bold text-[#7A7268]">답변 대기 중</p>
            <p aria-hidden className="mt-3 text-center text-2xl">
              ⏳
            </p>
            <p className="mt-3 text-center text-sm font-semibold text-[#1E1A14]">아직 답변이 등록되지 않았어요</p>
            <p className="mt-1 text-center text-[13px] text-[#7A7268]">영업일 기준 1~2일 이내 답변드릴게요</p>
          </section>
        ) : (
          <section className="mt-4 overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">
            <p className="border-b border-[#E8E2DA] px-5 py-[14px] text-xs font-bold text-[#7A7268]">답변</p>
            <p className="whitespace-pre-line px-5 py-4 text-[15px] leading-[1.7] text-[#1E1A14]">{inquiry.answer}</p>
          </section>
        )}

        <Link
          href={withChild('/my/support/inquiries', childId)}
          className="mt-8 flex h-12 items-center justify-center gap-2 self-center rounded-full bg-primary px-6 text-base font-bold text-white active:bg-ink"
        >
          <span aria-hidden>←</span> 목록으로
        </Link>
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
