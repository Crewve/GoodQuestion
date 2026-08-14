'use client';
// UI 리허설 갤러리 본체 — 실제 화면 컴포넌트를 픽스처 props로 마운트하고,
// 플로팅 버튼(좌하단)으로 여닫는 좌측 패널(구간별 아코디언)로 화면·상태를 전환한다.
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
import { NOTICES } from '../../my/notices/notices-data';
import { INQUIRIES } from '../../my/support/inquiries-data';
import story from '../../../../fixtures/story.banggui.json';
import charactersFixture from '../../../../fixtures/characters.banggui.json';

type FixtureScene = {
  external_id: string;
  scene_order: number;
  type?: string;
  label?: string;
  narration?: string;
  character?: string;
  character_opening?: string;
};
const scenes = story.scenes as FixtureScene[];
// 장면 선택기 — 이야기 진행 전 장면(도입→전개→대화, scene_order 순) 9개를 한 목록에서 검토 가능해야 한다
const orderedScenes = [...scenes].sort((a, b) => a.scene_order - b.scene_order);
// 진행 헤더 n/N — 실제 /play와 동일 규칙(도입 포함 5분할): N=대화 쌍 수+1, 도입=1, 전개k·대화k=k+1
const TOTAL_STEPS = orderedScenes.filter((s) => s.type === 'dialogue').length + 1;
const stepOf = (scene: FixtureScene) => {
  const pair = orderedScenes.filter((s) => s.label?.startsWith('전개') && s.scene_order <= scene.scene_order).length;
  return pair === 0 ? 1 : pair + 1;
};
// 표기는 fixtures display_name에서 파생 — 실제 /api/sessions의 characterName과 같은 값 (QA 11)
const CHARACTER_NAMES: Record<string, string> = Object.fromEntries(
  charactersFixture.characters.map((c) => [c.external_id, c.display_name]),
);

const noop = () => {};
const asyncNoop = async () => {};

/** 2.4.4/2.4.5 미리보기 — fixtures post_activity_config 파생(시드와 동일 SoT).
    하드코딩 샘플이던 시절 콘텐츠 개정(카드 라벨·키워드)이 갤러리에 반영 안 되는 혼선이 있어 실데이터 파생으로 교체 */
const activityConfig = story.story.post_activity_config;
const PREVIEW_CARDS: PostActivityCard[] = activityConfig.cards.map((card) => ({
  id: card.id,
  imageUrl: sceneImageUrl(card.id),
  label: card.label,
}));
const PREVIEW_KEYWORDS = activityConfig.keywords;

const VIEWS = [
  { key: 'm1', label: '미션1 진행' },
  { key: 'm1s', label: '미션1 성공' },
  { key: 'm2', label: '미션2 진행' },
  { key: 'm2s', label: '미션2 성공' },
  { key: 'cardA', label: '카드 2.4.4 (정답)' },
  { key: 'cardB', label: '카드 2.4.4 (오답)' },
  { key: 'retell', label: '문장 2.4.5' },
] as const;
// 'scene' = 이야기 진행 장면 뷰 — 어떤 장면인지는 sceneIdx가 정하고, 목록은 story 구간에 직접 렌더한다
type ViewKey = (typeof VIEWS)[number]['key'] | 'scene';

/** 구간별 아코디언 그룹 — 컴포넌트 리허설 뷰 묶음 (story 구간은 keys 대신 전 장면 목록을 직접 렌더) */
const VIEW_GROUPS: { key: string; title: string; keys: ViewKey[] }[] = [
  { key: 'story', title: '이야기 진행 2.4.1·2', keys: [] },
  { key: 'mission', title: '미션 팝업', keys: ['m1', 'm1s', 'm2', 'm2s'] },
  { key: 'post', title: '학습완료 활동 2.4.4·5', keys: ['cardA', 'cardB', 'retell'] },
];
/** 구간별 아코디언 그룹 — 실제 화면(iframe) 묶음. key는 routeViews 항목의 group과 매칭 */
const ROUTE_GROUPS = [
  { key: 'flow', title: '실제 화면 1·2 (iframe)' },
  { key: 'my', title: '실제 화면 3 마이 (iframe)' },
] as const;

/** 아코디언 섹션 헤더 — 클릭으로 구간 접기/펼치기 */
function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between gap-2 rounded-lg bg-[#F3EBDD] px-2 py-1.5 text-left font-bold text-[#75664F] active:bg-[#FFE8C9]"
    >
      <span>{title}</span>
      <span aria-hidden>{open ? '▾' : '▸'}</span>
    </button>
  );
}

/** 실제 라우트 미리보기 컨텍스트 — page.tsx(서버)가 조회해 내려준다 */
export type RouteContext = {
  loggedIn: boolean;
  childId: string | null;
  storyId: string;
  completedSessionId: string | null;
  /** 상태 무관 최신 세션 — 이야기 진행(2.4)·학습완료 활동 실제 라우트 미리보기용 */
  playSessionId: string | null;
};

/** 실제 라우트 화면 — iframe으로 마운트 (로그인 세션·데이터는 실제 것 사용). group은 ROUTE_GROUPS 아코디언 구간 */
function routeViews(
  ctx: RouteContext,
): { label: string; url: string | null; note?: string; group: (typeof ROUTE_GROUPS)[number]['key'] }[] {
  const child = ctx.childId ? `?child=${ctx.childId}` : null;
  return [
    { group: 'flow', label: '로그인 1.1', url: '/login' },
    { group: 'flow', label: '회원가입 1.2', url: '/signup' },
    { group: 'flow', label: '프로필 선택 2.1', url: ctx.loggedIn ? '/profiles' : null, note: '로그인 필요' },
    { group: 'flow', label: '홈 2.0', url: child ? `/home${child}` : null, note: '로그인+아이 필요' },
    { group: 'flow', label: '이야기 목록 2.2', url: child ? `/stories${child}` : null, note: '로그인+아이 필요' },
    { group: 'flow', label: '이야기 상세 2.3', url: child ? `/stories/${ctx.storyId}${child}` : null, note: '로그인+아이 필요' },
    // 이야기 진행·학습완료 활동은 실제 세션 데이터로 동작 — 진행 상태에 따라 재개 지점·분기가 달라진다
    {
      group: 'flow',
      label: '이야기 진행 2.4',
      url: ctx.playSessionId && child ? `/play/${ctx.playSessionId}${child}&story=${ctx.storyId}` : null,
      note: '세션 이력 필요',
    },
    {
      group: 'flow',
      label: '학습완료 활동 2.4.4·5',
      url: ctx.playSessionId ? `/play/${ctx.playSessionId}/activity` : null,
      note: '세션 이력 필요',
    },
    { group: 'flow', label: '학습 완료 2.5', url: ctx.completedSessionId ? `/complete/${ctx.completedSessionId}` : null, note: '완료 세션 필요' },
    { group: 'my', label: '내정보 3.1', url: ctx.loggedIn ? '/my' : null, note: '로그인 필요' },
    { group: 'my', label: '프로필 관리 3.2', url: ctx.loggedIn ? '/my/profiles' : null, note: '로그인 필요' },
    { group: 'my', label: '공지사항 3.3', url: ctx.loggedIn ? '/my/notices' : null, note: '로그인 필요' },
    { group: 'my', label: '공지 상세 3.3', url: ctx.loggedIn && NOTICES[0] ? `/my/notices/${NOTICES[0].id}` : null, note: '로그인 필요' },
    { group: 'my', label: '고객센터 3.4', url: ctx.loggedIn ? '/my/support' : null, note: '로그인 필요' },
    { group: 'my', label: '문의 목록 3.4', url: ctx.loggedIn ? '/my/support/inquiries' : null, note: '로그인 필요' },
    {
      group: 'my',
      label: '문의 상세 3.4',
      url: ctx.loggedIn && INQUIRIES[0] ? `/my/support/inquiries/${INQUIRIES[0].id}` : null,
      note: '로그인 필요',
    },
    { group: 'my', label: '이용안내 3.5', url: ctx.loggedIn ? '/my/guide' : null, note: '로그인 필요' },
    { group: 'my', label: '배지 3.6', url: ctx.loggedIn ? '/my/badges' : null, note: '로그인 필요' },
  ];
}

const DIALOGUE_PHASES: { phase: TurnPhase; label: string; sttText?: string }[] = [
  { phase: 'CHAR_SPEAKING', label: '듣는 중' },
  { phase: 'RECORDING', label: '녹음' },
  { phase: 'TRANSCRIBING', label: '변환 중' },
  { phase: 'REVIEW', label: 'REVIEW', sttText: '며느리가 방귀를 참느라 얼굴이 빨개진 것 같아요.' },
];

export function UiRehearsalGallery({ ctx }: { ctx: RouteContext }) {
  const [view, setView] = useState<ViewKey>('scene');
  const [route, setRoute] = useState<string | null>(null); // 실제 라우트 iframe 미리보기
  const [sceneIdx, setSceneIdx] = useState(0); // 이야기 진행 장면 선택 (도입→전개→대화 전 장면)
  const [navOpen, setNavOpen] = useState(true); // 내비 패널 전체 개폐 — 플로팅 버튼으로 토글
  // 구간별 아코디언 개폐 — 항목이 많아 패널이 잘리던 문제를 접기로 해결 (기본은 이야기 구간만 펼침)
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['story']));
  const toggleSection = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const phase = useTurnStore((s) => s.phase);
  // 리허설 기본 음소거 — dev 확인은 시각 중심(고정 안내음·응답 음성 불필요). 🔊 토글로 해제 가능
  const [rehearsalMuted, setRehearsalMuted] = useState(true);

  // 화면·장면 전환 시 턴 스토어 초기화 — 이전 뷰의 강제 상태가 남지 않게
  useEffect(() => {
    useTurnStore.getState().reset();
  }, [view, sceneIdx]);

  // 음소거 구현 — play 차단이 아니라 muted 재생: onended로 이어지는 진행 흐름(자동 녹음 전환 등)은 유지.
  // 이 문서의 프로토타입만 패치하므로 iframe(실제 화면)은 별도 문서라 영향 없음(실제 동작 확인용으로 소리 유지).
  useEffect(() => {
    if (!rehearsalMuted) return;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      this.muted = true;
      return original.call(this);
    };
    return () => {
      HTMLMediaElement.prototype.play = original;
      for (const el of document.querySelectorAll('audio, video')) (el as HTMLMediaElement).muted = false;
    };
  }, [rehearsalMuted]);

  const currentScene = orderedScenes[sceneIdx];

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {/* 내비 전체 토글 — 플로팅 버튼(z-[70]): 패널·모달(z-50)보다 위라 미션 팝업 중에도 개폐 가능.
          left-20: 로컬 dev에서 좌하단 Next.js 개발 배지와 겹치지 않게 오른쪽으로 비켜둠 */}
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        aria-label="dev 내비게이션 열기/닫기"
        className="fixed bottom-4 left-20 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white shadow-[0_4px_20px_rgba(58,44,30,0.35)] active:bg-ink"
      >
        {navOpen ? '✕' : '☰'}
      </button>

      {/* 좌측 컨트롤 패널 — 구간별 아코디언. z-[60]: 미션 팝업·카드 판정 오버레이(z-50) 위 */}
      {navOpen && (
        <aside className="fixed top-1/2 left-2 z-[60] flex max-h-[86dvh] w-52 -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-2xl bg-white/95 p-2 text-xs shadow-[0_4px_20px_rgba(58,44,30,0.25)]">
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="font-bold text-ink">UI 리허설 (dev)</p>
            <button
              type="button"
              onClick={() => setRehearsalMuted((m) => !m)}
              title={rehearsalMuted ? '리허설 음소거 중 (iframe 실제 화면 제외) — 눌러서 소리 켜기' : '리허설 소리 켜짐 — 눌러서 음소거'}
              aria-label="리허설 음소거 토글"
            >
              {rehearsalMuted ? '🔇' : '🔊'}
            </button>
          </div>
          {VIEW_GROUPS.map((g) => (
            <div key={g.key} className="flex flex-col gap-1">
              <SectionHeader title={g.title} open={openSections.has(g.key)} onToggle={() => toggleSection(g.key)} />
              {openSections.has(g.key) && (
                <>
                  {VIEWS.filter((v) => g.keys.includes(v.key)).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => {
                        setView(v.key);
                        setRoute(null);
                      }}
                      className={`rounded-lg px-2 py-1.5 text-left font-semibold ${
                        view === v.key && !route ? 'bg-primary text-white' : 'bg-background text-ink active:bg-[#FFE8C9]'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                  {g.key === 'story' && (
                    <>
                      {orderedScenes.map((s, i) => (
                        <button
                          key={s.external_id}
                          type="button"
                          onClick={() => {
                            setView('scene');
                            setSceneIdx(i);
                            setRoute(null);
                          }}
                          className={`rounded-lg px-2 py-1.5 text-left ${
                            view === 'scene' && !route && sceneIdx === i
                              ? 'bg-sunny text-ink'
                              : 'bg-background text-ink active:bg-[#FFE8C9]'
                          }`}
                        >
                          {s.scene_order}. {s.label}
                          {s.type === 'dialogue' && ` (${CHARACTER_NAMES[s.character ?? ''] ?? '?'})`}
                        </button>
                      ))}
                      {!route && view === 'scene' && currentScene.type === 'dialogue' && (
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
                                phase === p.phase ? 'bg-sage text-white' : 'bg-background text-ink active:bg-[#FFE8C9]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
          {ROUTE_GROUPS.map((g) => (
            <div key={g.key} className="flex flex-col gap-1">
              <SectionHeader title={g.title} open={openSections.has(g.key)} onToggle={() => toggleSection(g.key)} />
              {openSections.has(g.key) &&
                routeViews(ctx)
                  .filter((r) => r.group === g.key)
                  .map((r) => (
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
                            ? 'bg-background text-ink active:bg-[#FFE8C9]'
                            : 'bg-background text-ink/30'
                      }`}
                    >
                      {r.label}
                      {!r.url && <span className="block text-[10px] font-normal">{r.note}</span>}
                    </button>
                  ))}
            </div>
          ))}
        </aside>
      )}

      {/* 스테이지 — 실제 라우트 iframe 또는 컴포넌트 마운트 */}
      {route && <iframe src={route} title="실제 화면 미리보기" className="h-full w-full border-0" />}
      {!route && view === 'scene' && (
        <>
          <ProgressHeader title="방귀 뀌는 며느리" n={stepOf(currentScene)} N={TOTAL_STEPS} onExit={noop} />
          {currentScene.type === 'dialogue' ? (
            <DialogueScene
              key={currentScene.external_id}
              sessionId="dev-rehearsal"
              childName="진욱"
              childAvatarKey="boy-2"
              scene={{
                id: currentScene.external_id,
                order: currentScene.scene_order,
                characterName: CHARACTER_NAMES[currentScene.character ?? ''] ?? '캐릭터',
                characterImageUrl: characterImageUrl(currentScene.character ?? 'ch_banggui_daughter_in_law'),
                openingText: currentScene.character_opening,
                imageUrl: sceneImageUrl(currentScene.external_id),
              }}
              onSceneEnd={noop}
            />
          ) : (
            <NarrationScene
              key={currentScene.external_id}
              description={currentScene.narration ?? ''}
              imageUrl={sceneImageUrl(currentScene.external_id)}
              onProceed={noop}
            />
          )}
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
