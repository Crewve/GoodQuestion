// 1:1 문의 내역 (기능명세서 3.4 / 피그마 「개발 배포용」 3.4 고객센터_1:1 문의 내역).
// 상단 탭(FAQ는 링크 복귀 · 문의 내역 활성) + 새 문의하기 + 문의 행 리스트(제목 15·날짜 12.8·상태 칩 12.8).
// 새 문의 작성 화면은 스토리보드에 없어 준비 중 안내(아코디언)로 처리 — 접수 연동 시 교체 지점 (D7).
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { MyPageHeader } from '../../accordion';
import { INQUIRIES, type InquiryStatus } from '../inquiries-data';

const EMPTY_MESSAGE = '문의 내역이 없습니다';

/** 상태 칩 — 답변대기 피치 / 답변완료 민트 (배지 화면 칩과 동일 계열, 대비 하한 준수값) */
const STATUS_CHIP: Record<InquiryStatus, string> = {
  답변대기: 'bg-primary/15 text-[#B33D0D]',
  답변완료: 'bg-[#DDF5EC] text-[#177A4F]',
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

        {/* 상단 탭 — 문의 내역 활성, FAQ는 링크 복귀 (스토리보드 3.4) */}
        <div className="mt-10 flex overflow-hidden border border-[#E8E2DA] bg-white">
          <Link
            href={withChild('/my/support', childId)}
            className="flex h-[52px] flex-1 items-center justify-center text-[15px] text-[#7A7268] active:bg-background"
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

        {/* 새 문의하기 — 작성 화면은 스토리보드 미정의라 준비 중 안내 (MVP) */}
        <details className="group mt-6 self-end">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-bold text-white active:opacity-80 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-lg leading-none">
              ＋
            </span>
            새 문의하기
          </summary>
          <p className="mt-2 text-right text-[13px] text-[#7A7268]">
            새 문의 작성은 준비 중이에요. 곧 이곳에서 바로 남길 수 있어요.
          </p>
        </details>

        {INQUIRIES.length === 0 ? (
          <p className="mt-6 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>
        ) : (
          <section className="mt-4 overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">
            {INQUIRIES.map((inquiry) => (
              <Link
                key={inquiry.id}
                href={withChild(`/my/support/inquiries/${inquiry.id}`, childId)}
                className="flex min-h-14 items-center gap-4 border-b border-[#E8E2DA] px-5 py-[18px] last:border-b-0 active:bg-background"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#1E1A14]">{inquiry.title}</span>
                  <span className="mt-1 block text-[13px] text-[#7A7268]">{inquiry.date}</span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-bold ${STATUS_CHIP[inquiry.status]}`}
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
