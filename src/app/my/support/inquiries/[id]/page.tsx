// 1:1 문의 상세 (기능명세서 3.4 / 피그마 「개발 배포용」 3.4 고객센터_문의 상세).
// 피그마 실측(2026-08-14) 반영: 전체가 단일 흰 카드(테두리·라운드 없음, pad 24/32) — 칩 행(카테고리 피치/상태
// 아웃라인) → 제목 20 → 날짜 → '내 문의' 회색 박스(#F7F6F3 r14) → 상단 헤어라인 답변 영역(6px 도트 + 라벨,
// 대기: ⏳ 회색 박스 / 완료: 답변 본문 박스) → 카드 밖 '목록으로' 흰 필(172×46, 공지 상세와 동일).
// 정적 콘텐츠(inquiries-data) 기준, 없는 id는 404. 답변완료 상세는 시안 미제공 — 대기 시안 구조에 준용.
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

        <article className="mt-10 bg-white px-6 py-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#FFEDE3] px-2.5 py-0.5 text-[13px] font-bold text-primary">
              {inquiry.category}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${
                waiting ? 'border border-[#E8E2DA] text-[#7A7268]' : 'bg-[#DDF5EC] text-sage'
              }`}
            >
              {inquiry.status}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-bold leading-[1.5] text-[#1E1A14]">{inquiry.title}</h3>
          <p className="mt-1.5 text-[13px] text-[#7A7268]">{inquiry.date}</p>

          <div className="mt-6 rounded-[14px] bg-[#F7F6F3] p-5">
            <p className="text-xs font-bold text-[#7A7268]">내 문의</p>
            <p className="mt-2.5 whitespace-pre-line text-[15px] leading-[1.7] text-[#1E1A14]">{inquiry.body}</p>
          </div>

          <div className="mt-6 border-t border-[#E8E2DA] pt-6">
            <p className="flex items-center gap-2 text-sm font-bold text-[#7A7268]">
              <span aria-hidden className={`size-1.5 rounded-full ${waiting ? 'bg-[#E8E2DA]' : 'bg-sage'}`} />
              {waiting ? '답변 대기 중' : '답변 완료'}
            </p>
            {waiting ? (
              <div className="mt-3.5 rounded-[14px] bg-[#F7F6F3] p-6">
                <p aria-hidden className="text-center text-2xl">
                  ⏳
                </p>
                <p className="mt-2 text-center text-sm text-[#7A7268]">아직 답변이 등록되지 않았어요</p>
                <p className="mt-1 text-center text-[13px] text-[#7A7268]">영업일 기준 1~2일 이내 답변드릴게요</p>
              </div>
            ) : (
              <div className="mt-3.5 rounded-[14px] bg-[#F7F6F3] p-5">
                <p className="whitespace-pre-line text-[15px] leading-[1.7] text-[#1E1A14]">{inquiry.answer}</p>
              </div>
            )}
          </div>
        </article>

        <Link
          href={withChild('/my/support/inquiries', childId)}
          className="mt-5 flex h-[46px] w-[172px] items-center justify-center self-center rounded-full border border-[#C8D8D0] bg-white text-base font-bold text-ink shadow-[0_1px_4px_rgba(0,0,0,0.07)] active:bg-ink active:text-white"
        >
          목록으로
        </Link>
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
