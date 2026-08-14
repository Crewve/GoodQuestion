// 이용안내 (T058, 기능명세서 3.5 / 피그마 「개발 배포용」 3.5 이용약관·이용 가이드).
// 스토리보드 확인(2026-08-13)에 따라 앵커 아코디언 → 탭 전환 방식으로 변경: ?tab=terms 쿼리로
// 약관 전문 뷰 / 기본은 이용 가이드 카드 4종(아이콘 타일 + 제목 15 + 본문 14 + 💡 팁 12.8) 뷰.
// 약관 전문·가이드 문구는 시안 원문(약관은 "법무 확인 전 가정" 자기 명시) — 단어장·리포트·구독
// 언급은 MVP 미구현 기능이라 문구 확정은 기획 확인 필요 (수정사항 체크리스트 D7 연계).
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { BulbIcon, ChartIcon, MicStandIcon, NoteIcon, TargetIcon } from '@/components/icons';
import { MyPageHeader } from '../accordion';

// 서비스 이용 가이드 4종 (스토리보드 원문 — 크기 실측: 제목 15·본문 14·팁 12.8).
// 시안은 타일·팁에 이모지(🎙️🎯📝📊·💡)를 썼지만 기기마다 다른 컬러 폰트로 렌더돼 공용 SVG로 교체 (C1 / QA 4)
const GUIDES: { title: string; Icon: (props: { className?: string }) => React.ReactElement; body: string; tip: string }[] = [
  {
    title: '말하기 대화 방법',
    Icon: MicStandIcon,
    body: '이야기 화면에서 마이크 버튼을 누르면 녹음이 시작됩니다. 말하기가 끝나면 자동으로 인식하거나, 보내기 버튼을 눌러주세요.',
    tip: '조용한 환경에서 또렷하게 말하면 인식률이 올라가요!',
  },
  {
    title: '미션 활동',
    Icon: TargetIcon,
    body: '각 이야기에는 1~2개의 미션이 포함되어 있어요. 미션은 이야기 속 상황을 다른 관점에서 생각해보는 활동이에요.',
    tip: '미션 화면에서는 자유롭게 생각을 말해도 돼요.',
  },
  {
    title: '단어장 사용법',
    Icon: NoteIcon,
    body: '대화 중 어려운 단어는 단어장에 자동으로 추가됩니다. 단어장 탭에서 뜻과 예문을 확인할 수 있어요.',
    tip: '단어 카드를 탭하면 발음을 들을 수 있어요.',
  },
  {
    title: '보호자 리포트',
    Icon: ChartIcon,
    body: '이야기를 완료하면 마이페이지 > 보호자 리포트에서 아이의 역량 분석 결과를 확인할 수 있습니다.',
    tip: '이번 주 활동 요약은 홈 화면에서도 바로 확인할 수 있어요.',
  },
];

// 서비스 이용약관 전문 (스토리보드 원문 — 문서 스스로 "법무 확인 전 가정"을 명시)
const TERMS_TITLE = '굿퀘스천 모바일 아동 서비스 이용약관';
const TERMS_ARTICLES: string[] = [
  '제 1조 (목적) 본 약관은 굿퀘스천 주식회사(이하 "회사")가 제공하는 이야기 기반 AI 말하기 학습 플랫폼 서비스(이하 "서비스")를 보호자 및 아동이 이용함에 있어, 회사와 보호자 간의 권리, 의무 및 책임 사항, 서비스 이용 조건 등을 규정함을 목적으로 합니다.',
  '제 2조 (보호자 동의) 본 서비스는 만 14세 미만의 아동을 교육 대상으로 하고 있으므로, 아동의 안전한 개인정보 처리를 위해 보호자(법정대리인)의 승인 및 계정 생성을 필수로 요구합니다. 회사는 보호자 동의 없는 아동의 가입 시도를 거부하거나 삭제할 권리를 가집니다.',
  '제 3조 (서비스 이용) 서비스는 AI 음성 인식 기술을 활용하여 아동의 말하기 능력 향상을 목적으로 설계되었습니다. 서비스 내 수집되는 음성 데이터는 STT(음성→텍스트) 변환 후 즉시 파기되며, 별도로 저장되지 않습니다.',
  '제 4조 (구독 및 결제) 월간 구독 서비스는 매월 자동 갱신됩니다. 구독 해지를 원하시면 다음 결제일 24시간 전까지 고객센터를 통해 요청하시기 바랍니다.',
  '제 5조 (개인정보 보호) 회사는 관련 법령에 따라 이용자의 개인정보를 보호합니다. 자세한 내용은 개인정보처리방침을 참고해 주세요.',
];
const TERMS_FOOTNOTE = '최종 수정일: 2026.01.01 · ⚠ 법무 확인 전 가정 내용으로 추후 변경될 수 있습니다.';

export default async function GuidePage(props: PageProps<'/my/guide'>) {
  // 아이 컨텍스트(?child=)는 GNB·뒤로가기·탭 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const sp = await props.searchParams;
  const childId = typeof sp.child === 'string' ? sp.child : null;
  const showTerms = sp.tab === 'terms';

  // 탭 전환 링크 — child 쿼리를 함께 유지
  const tabHref = (terms: boolean) => {
    const params = new URLSearchParams();
    if (terms) params.set('tab', 'terms');
    if (childId) params.set('child', childId);
    const query = params.toString();
    return query ? `/my/guide?${query}` : '/my/guide';
  };

  // 피그마 실측(2026-08-14): 탭 바는 하단 헤어라인만, 활성 탭은 밑줄 2px(#1E1A14)
  const tabClass = (active: boolean) =>
    active
      ? 'flex h-[52px] flex-1 items-center justify-center border-b-2 border-[#1E1A14] text-[15px] font-bold text-[#1E1A14]'
      : 'flex h-[52px] flex-1 items-center justify-center border-b border-[#E8E2DA] text-[15px] text-[#7A7268] active:bg-background';

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">이용안내</h2>

        {/* 상단 탭 — 같은 라우트에서 ?tab= 쿼리로 약관/가이드 전환 (스토리보드 3.5) */}
        <div className="mt-10 flex bg-white">
          {showTerms ? (
            <span aria-current="true" className={tabClass(true)}>
              서비스 이용약관
            </span>
          ) : (
            <Link href={tabHref(true)} replace className={tabClass(false)}>
              서비스 이용약관
            </Link>
          )}
          {showTerms ? (
            <Link href={tabHref(false)} replace className={tabClass(false)}>
              서비스 이용 가이드
            </Link>
          ) : (
            <span aria-current="true" className={tabClass(true)}>
              서비스 이용 가이드
            </span>
          )}
        </div>

        {showTerms ? (
          // 약관 전문 — 피그마 실측 카드(r=14): 테두리 헤더 행(제목 15 + sky 링크) / 조항 14.4 Bold lh 1.75 /
          // 하단 각주 밴드(#F7F6F3, 12.8 중앙 정렬)
          <section className="mt-10 overflow-hidden rounded-[14px] border border-[#E8E2DA] bg-white">
            <h3 className="sr-only">서비스 이용약관</h3>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2DA] px-5 py-4">
              <p className="text-[15px] font-bold text-[#1E1A14]">{TERMS_TITLE}</p>
              {/* 처리방침 전문 화면은 미제공(MVP) — 스토리보드 표기만 유지 */}
              <p className="text-sm text-sky">개인정보처리방침 바로가기 ›</p>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {TERMS_ARTICLES.map((article) => (
                <p key={article.slice(0, 12)} className="text-sm font-bold leading-[1.75] text-[#1E1A14]">
                  {article}
                </p>
              ))}
            </div>
            <p className="border-t border-[#E8E2DA] bg-[#F7F6F3] px-5 py-3 text-center text-[13px] text-[#7A7268]">
              {TERMS_FOOTNOTE}
            </p>
          </section>
        ) : (
          // 이용 가이드 — 카드 4종 상시 펼침 (아코디언 아님). 피그마 실측: 좌우 24 인셋·카드 간 14·pad 20·
          // 팁 칩 #FFF5D4/r8/#7C4A00
          <section className="mt-10 flex flex-col gap-3.5 px-6">
            <h3 className="sr-only">서비스 이용 가이드</h3>
            {GUIDES.map(({ title, Icon, body, tip }) => (
              <article key={title} className="flex gap-4 rounded-[14px] border border-[#E8E2DA] bg-white p-5">
                <span
                  aria-hidden
                  className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#FFEDE3] text-primary"
                >
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[#1E1A14]">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#7A7268]">{body}</p>
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-[#FFF5D4] px-2.5 py-1 text-[13px] text-[#7C4A00]">
                    <BulbIcon className="mt-0.5 size-3.5 shrink-0" />
                    {tip}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
