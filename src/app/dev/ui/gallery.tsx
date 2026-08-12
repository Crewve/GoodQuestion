'use client';
// UI 리허설 갤러리 본체 — 실제 화면 컴포넌트를 픽스처 props로 마운트하고, 좌측 레일로 화면·상태를 전환한다.
// 저장/판정 콜백은 전부 목(mock): DB·API 부작용 없음. 대화 상태는 turn 스토어를 직접 세팅해 강제한다.
// 주의: '녹음' 상태로 전환하면 실제 MediaRecorder가 시작돼 마이크 권한을 요청할 수 있다(시각 확인에는 지장 없음).
import { useEffect, useState } from 'react';
import { CardOrdering, type PostActivityCard } from '@/components/card-ordering';
import { DialogueScene } from '@/components/dialogue-scene';
import { MissionPopup } from '@/components/mission-popup';
import { NarrationScene } from '@/components/narration-scene';
import { ProgressHeader } from '@/components/progress-header';
import { Retelling } from '@/components/retelling';
import { characterImageUrl, sceneImageUrl } from '@/lib/assets';
import { useTurnStore, type TurnPhase } from '@/store/turn';
import story from '../../../../fixtures/story.banggui.json';

type FixtureScene = {
  external_id: string;
  scene_order: number;
  label?: string;
  narration?: string;
  character?: string;
  character_opening?: string;
};
const scenes = story.scenes as FixtureScene[];
const sceneByOrder = (order: number) => scenes.find((s) => s.scene_order === order)!;

const noop = () => {};
const asyncNoop = async () => {};

/** 2.4.4/2.4.5 미리보기용 카드 4세트 — 실데이터는 DB post_activity_config(R-09), 여기서는 장면 이미지 재사용 예시 */
const PREVIEW_CARDS: PostActivityCard[] = [1, 3, 7, 9].map((order) => {
  const s = sceneByOrder(order);
  return { id: s.external_id, imageUrl: sceneImageUrl(s.external_id), label: s.label ?? s.external_id };
});
const PREVIEW_KEYWORDS = ['방귀', '걱정', '배나무', '웃음'];

const VIEWS = [
  { key: 'intro', label: '도입 2.4.1' },
  { key: 'develop', label: '전개 2.4.1' },
  { key: 'dialogue', label: '대화 2.4.2' },
  { key: 'm1', label: '미션1 진행' },
  { key: 'm1s', label: '미션1 성공' },
  { key: 'm2', label: '미션2 진행' },
  { key: 'm2s', label: '미션2 성공' },
  { key: 'cardA', label: '카드 2.4.4 (정답)' },
  { key: 'cardB', label: '카드 2.4.4 (오답)' },
  { key: 'retell', label: '문장 2.4.5' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

/** 실제 라우트 미리보기 컨텍스트 — page.tsx(서버)가 조회해 내려준다 */
export type RouteContext = {
  loggedIn: boolean;
  childId: string | null;
  storyId: string;
  completedSessionId: string | null;
};

/** 실제 라우트 화면 — iframe으로 마운트 (로그인 세션·데이터는 실제 것 사용) */
function routeViews(ctx: RouteContext): { label: string; url: string | null; note?: string }[] {
  const child = ctx.childId ? `?child=${ctx.childId}` : null;
  return [
    { label: '로그인 1.1', url: '/login' },
    { label: '회원가입 1.2', url: '/signup' },
    { label: '프로필 선택 2.1', url: ctx.loggedIn ? '/profiles' : null, note: '로그인 필요' },
    { label: '홈 2.0', url: child ? `/home${child}` : null, note: '로그인+아이 필요' },
    { label: '이야기 목록 2.2', url: child ? `/stories${child}` : null, note: '로그인+아이 필요' },
    { label: '이야기 상세 2.3', url: child ? `/stories/${ctx.storyId}${child}` : null, note: '로그인+아이 필요' },
    { label: '학습 완료 2.5', url: ctx.completedSessionId ? `/complete/${ctx.completedSessionId}` : null, note: '완료 세션 필요' },
    { label: '내정보 3.1', url: ctx.loggedIn ? '/my' : null, note: '로그인 필요' },
    { label: '프로필 관리 3.2', url: ctx.loggedIn ? '/my/profiles' : null, note: '로그인 필요' },
    { label: '공지사항 3.3', url: ctx.loggedIn ? '/my/notices' : null, note: '로그인 필요' },
    { label: '고객센터 3.4', url: ctx.loggedIn ? '/my/support' : null, note: '로그인 필요' },
    { label: '이용안내 3.5', url: ctx.loggedIn ? '/my/guide' : null, note: '로그인 필요' },
    { label: '배지 3.6', url: ctx.loggedIn ? '/my/badges' : null, note: '로그인 필요' },
  ];
}

const DIALOGUE_PHASES: { phase: TurnPhase; label: string; sttText?: string }[] = [
  { phase: 'CHAR_SPEAKING', label: '듣는 중' },
  { phase: 'RECORDING', label: '녹음' },
  { phase: 'TRANSCRIBING', label: '변환 중' },
  { phase: 'REVIEW', label: 'REVIEW', sttText: '며느리가 방귀를 참느라 얼굴이 빨개진 것 같아요.' },
];

export function UiRehearsalGallery({ ctx }: { ctx: RouteContext }) {
  const [view, setView] = useState<ViewKey>('intro');
  const [route, setRoute] = useState<string | null>(null); // 실제 라우트 iframe 미리보기
  const phase = useTurnStore((s) => s.phase);

  // 화면 전환 시 턴 스토어 초기화 — 이전 뷰의 강제 상태가 남지 않게
  useEffect(() => {
    useTurnStore.getState().reset();
  }, [view]);

  const dialogueScene = sceneByOrder(3);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-base">
      {/* 좌측 컨트롤 레일 */}
      <aside className="fixed top-1/2 left-2 z-50 flex max-h-[92dvh] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-2xl bg-white/95 p-2 text-xs shadow-[0_4px_20px_rgba(58,44,30,0.25)]">
        <p className="px-1 pb-1 font-bold text-ink">UI 리허설 (dev)</p>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              setView(v.key);
              setRoute(null);
            }}
            className={`rounded-lg px-2 py-1.5 text-left font-semibold ${
              view === v.key && !route ? 'bg-primary text-white' : 'bg-base text-ink active:bg-[#FFE8C9]'
            }`}
          >
            {v.label}
          </button>
        ))}
        <p className="px-1 pt-2 pb-1 font-bold text-[#75664F]">실제 화면 (iframe)</p>
        {routeViews(ctx).map((r) => (
          <button
            key={r.label}
            type="button"
            disabled={!r.url}
            onClick={() => r.url && setRoute(r.url)}
            title={r.url ? undefined : r.note}
            className={`rounded-lg px-2 py-1.5 text-left font-semibold ${
              route === r.url && route
                ? 'bg-sky text-white'
                : r.url
                  ? 'bg-base text-ink active:bg-[#FFE8C9]'
                  : 'bg-base text-ink/30'
            }`}
          >
            {r.label}
            {!r.url && <span className="block text-[10px] font-normal">{r.note}</span>}
          </button>
        ))}
        {!route && view === 'dialogue' && (
          <>
            <p className="px-1 pt-2 pb-1 font-bold text-[#75664F]">대화 상태</p>
            {DIALOGUE_PHASES.map((p) => (
              <button
                key={p.phase}
                type="button"
                onClick={() =>
                  useTurnStore.setState({
                    phase: p.phase,
                    sttText: p.sttText ?? null,
                    sttRawText: p.sttText ?? null,
                  })
                }
                className={`rounded-lg px-2 py-1.5 text-left ${
                  phase === p.phase ? 'bg-sage text-white' : 'bg-base text-ink active:bg-[#FFE8C9]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </>
        )}
      </aside>

      {/* 스테이지 — 실제 라우트 iframe 또는 컴포넌트 마운트 */}
      {route && <iframe src={route} title="실제 화면 미리보기" className="h-full w-full border-0" />}
      {!route && (view === 'intro' || view === 'develop') && (
        <>
          <ProgressHeader title="방귀 뀌는 며느리" n={view === 'intro' ? 1 : 2} N={4} onExit={noop} />
          <NarrationScene
            key={view}
            description={sceneByOrder(view === 'intro' ? 1 : 2).narration ?? ''}
            imageUrl={sceneImageUrl(view === 'intro' ? 'sc_banggui_01' : 'sc_banggui_02')}
            onProceed={noop}
          />
        </>
      )}

      {!route && view === 'dialogue' && (
        <>
          <ProgressHeader title="방귀 뀌는 며느리" n={3} N={4} onExit={noop} />
          <DialogueScene
            sessionId="dev-rehearsal"
            childName="진욱"
            scene={{
              id: dialogueScene.external_id,
              order: 3,
              characterName: '방귀 며느리',
              characterImageUrl: characterImageUrl(dialogueScene.character ?? 'ch_banggui_daughter_in_law'),
              openingText: dialogueScene.character_opening,
              imageUrl: sceneImageUrl(dialogueScene.external_id),
            }}
            onSceneEnd={noop}
          />
        </>
      )}

      {!route && (view === 'm1' || view === 'm1s' || view === 'm2' || view === 'm2s') && (
        <MissionPopup
          key={view}
          missionId={view.startsWith('m1') ? 'mission_1' : 'mission_2'}
          sceneId={view.startsWith('m1') ? 'sc_banggui_07' : 'sc_banggui_08'}
          devInitialPhase={view.endsWith('s') ? 'SUCCESS' : 'IDLE'}
          onSubmit={asyncNoop}
          onContinue={noop}
        />
      )}

      {!route && (view === 'cardA' || view === 'cardB') && (
        <CardOrdering
          key={view}
          cards={PREVIEW_CARDS}
          onSubmit={async () => ({ isOrderCorrect: view === 'cardA' })}
          onProceed={noop}
        />
      )}

      {!route && view === 'retell' && (
        <Retelling cards={PREVIEW_CARDS} keywords={PREVIEW_KEYWORDS} onSubmit={asyncNoop} />
      )}
    </div>
  );
}
