// 1:1 문의 내역 (기능명세서 3.4 / 피그마 「개발 배포용」 3.4 고객센터_1:1 문의 내역).
// 상단 탭(FAQ는 링크 복귀 · 문의 내역 활성) + 새 문의하기(r=12) + 문의 개별 카드 리스트(r=14, 10px 간격).
// 피그마 실측 반영(2026-08-14): 탭 바는 하단 헤어라인만·활성 탭 밑줄 2px, 칩·버튼 값은 아래 주석 참조.
// 새 문의 작성 화면은 스토리보드에 없어 준비 중 안내(아코디언)로 처리 — 접수 연동 시 교체 지점 (D7).
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { MyPageHeader } from '../../accordion';
import { INQUIRIES, type InquiryStatus } from '../inquiries-data';

const EMPTY_MESSAGE = '문의 내역이 없습니다';

/** 상태 칩 — 피그마 원색 채택(2026-08-14 사용자 지시 "피그마와 동일하게"): 답변대기 아웃라인(#E8E2DA)/회색,
 *  답변완료 민트(#DDF5EC)/sage. sage-on-민트는 대비 하한(4.5:1) 미달임을 인지하고 시안대로 적용. */
const STATUS_CHIP: Record<InquiryStatus, string> = {
  답변대기: 'border border-[#E8E2DA] text-[#7A7268]',
  답변완료: 'bg-[#DDF5EC] text-sage',
};

export default async function InquiriesPage(props: PageProps<'/my/support/inquiries'>) {
  // 아이 컨텍스트(?child=)는 GNB·탭·상세 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">고객센터</h2>

        {/* 상단 탭 — 문의 내역 활성, FAQ는 링크 복귀 (피그마: 비활성 탭 하단 헤어라인·활성 탭 밑줄 2px) */}
        <div className="mt-10 flex bg-white">
          <Link
            href={withChild('/my/support', childId)}
            className="flex h-[52px] flex-1 items-center justify-center border-b border-[#E8E2DA] text-[15px] text-[#7A7268] active:bg-background"
          >
            자주 묻는 질문(FAQ)
          </Link>
          <span
            aria-current="true"
            className="flex h-[52px] flex-1 items-center justify-center border-b-2 border-[#1E1A14] text-[15px] font-bold text-[#1E1A14]"
          >
            1:1 문의 내역
          </span>
        </div>

        {/* 새 문의하기 — 작성 화면은 스토리보드 미정의라 준비 중 안내 (MVP). 피그마: r=12·h44·ink.
            summary는 w-fit — details 폭이 안내문에 맞춰 늘어나면 블록 요소인 버튼도 같이 늘어났다 (QA 23) */}
        <details className="group mt-10 self-end">
          <summary className="ml-auto flex h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-xl bg-ink px-5 text-sm font-bold text-white active:opacity-80 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-lg leading-none">
              ＋
            </span>
            새 문의하기
          </summary>
          {/* 안내문 폭 제한 — 문구 길이만큼 details가 옆으로 늘어나 버튼까지 길어 보이던 문제 (피그마 코멘트 #113) */}
          <p className="mt-2 max-w-[300px] text-right text-[13px] text-[#7A7268]">
            새 문의 작성은 준비 중이에요. 곧 이곳에서 바로 남길 수 있어요.
          </p>
        </details>

        {INQUIRIES.length === 0 ? (
          <p className="mt-6 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>
        ) : (
          <section className="mt-4 flex flex-col gap-2.5">
            {INQUIRIES.map((inquiry) => (
              <Link
                key={inquiry.id}
                href={withChild(`/my/support/inquiries/${inquiry.id}`, childId)}
                className="flex min-h-[82px] items-center gap-4 rounded-[14px] border border-[#E8E2DA] bg-white px-[18px] py-4 active:bg-background"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#1E1A14]">{inquiry.title}</span>
                  <span className="mt-1 block text-[13px] text-[#7A7268]">{inquiry.date}</span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[13px] font-bold ${STATUS_CHIP[inquiry.status]}`}
                >
                  {inquiry.status}
                </span>
              </Link>
            ))}
          </section>
        )}
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
