'use client';
// 이야기 진행 컨테이너 (T036) — /api/sessions 응답(contracts/api-routes.md)을 소비해 장면 시퀀스를 진행한다.
// 진입: /play/[sessionId]?child=<childId>&story=<storyId> — POST /api/sessions는 멱등(기존 세션 반환)이라
// 새로고침해도 서버 계산 재개 지점으로 복원된다. US3 T050(시작하기 연결)이 이 경로로 라우팅할 예정.
// 대화 장면 UI는 파트2 T037(dialogue-scene) 합류 지점 — T038 공동 배선 전까지 자리표시자를 렌더한다.
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Attribution } from '@/components/attribution';
import { DialogueScene } from '@/components/dialogue-scene';
import { NarrationScene } from '@/components/narration-scene';
import { ProgressHeader } from '@/components/progress-header';
import { useAudioUnlock } from '@/hooks/useAudioUnlock';
import story from '../../../../fixtures/story.banggui.json';

type ScenePayload = {
  id: string;
  order: number;
  type: '도입' | '전개' | '대화';
  description?: string;
  characterName?: string;
  characterImageUrl?: string;
  /** 대화 오프닝 표시 텍스트 — 서버가 openingAudioUrl과 표기를 맞춰 내려줌 (R-07) */
  openingText?: string;
  openingAudioUrl?: string;
  imageUrl?: string;
};

type SessionPayload = {
  sessionId: string;
  /** 실명 호출(R-07) — 대화 화면 텍스트 치환 폴백용 */
  childName: string | null;
  resumeSceneId: string | null;
  resumeSceneOrder: number;
  scenes: ScenePayload[];
  progress: { n: number; N: number; percent: number };
};

const STORY_TITLE = (story as { story: { title: string } }).story.title; // MVP 단일 이야기 — 다중화 시 세션 페이로드로 이관

export default function PlayPage(props: PageProps<'/play/[sessionId]'>) {
  const { sessionId } = use(props.params);
  const router = useRouter();
  const search = useSearchParams();
  const childId = search.get('child');
  const storyId = search.get('story');
  useAudioUnlock(); // 첫 제스처에서 오디오 언락 (iPad)

  const [data, setData] = useState<SessionPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<number | null>(null);
  // 컨텍스트 결측은 상태가 아니라 파생값 — effect 내 동기 setState 금지(react-hooks/set-state-in-effect)
  const error =
    !childId || !storyId ? '세션 정보가 없어요. 이야기 상세에서 다시 시작해 주세요.' : fetchError;

  useEffect(() => {
    if (!childId || !storyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, storyId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `세션을 불러오지 못했어요 (HTTP ${res.status})`);
        }
        const payload = (await res.json()) as SessionPayload;
        if (cancelled) return;
        setData(payload);
        setCurrentOrder(payload.resumeSceneOrder);
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : '세션을 불러오지 못했어요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, storyId, sessionId]);

  const scenes = useMemo(() => data?.scenes ?? [], [data]);
  const lastOrder = scenes.length > 0 ? scenes[scenes.length - 1].order : 0;
  const currentScene = useMemo(
    () => scenes.find((s) => s.order === currentOrder) ?? null,
    [scenes, currentOrder],
  );

  // 헤더 n: 도입 동안 1 고정, 이후 현재 속한 전개·대화 쌍의 번호 (문장 진행과 무관 — 2.4.1·2.4.2)
  const totalPairs = scenes.filter((s) => s.type === '대화').length;
  const currentPair = useMemo(() => {
    if (!currentScene || currentScene.type === '도입') return 1;
    return Math.max(1, scenes.filter((s) => s.type === '전개' && s.order <= currentScene.order).length);
  }, [currentScene, scenes]);

  const exitToDetail = useCallback(() => {
    // X 나가기 — 이야기 상세 복귀 (진행 상태는 서버 세션에 이미 반영된 만큼만 유지)
    if (storyId) router.push(`/stories/${storyId}`);
    else router.back();
  }, [router, storyId]);

  const proceed = useCallback(() => {
    setCurrentOrder((order) => (order === null ? order : order + 1));
  }, []);

  // 모든 장면 완료(재개 시 resumeSceneId=null 포함) — 학습완료 활동으로 이동 (T055 배선).
  // 재진입 라우팅(2.4.4/2.4.5/2.5 분기)은 activity 서버 컨테이너가 저장값 기준으로 판정한다.
  const finished = data !== null && currentOrder !== null && currentOrder > lastOrder;
  useEffect(() => {
    if (finished) router.replace(`/play/${sessionId}/activity`);
  }, [finished, router, sessionId]);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-base px-6 text-center">
        <p className="font-display text-xl text-ink">{error}</p>
        <button
          type="button"
          onClick={exitToDetail}
          className="h-14 rounded-full bg-primary px-8 font-display text-xl text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:bg-ink"
        >
          돌아가기
        </button>
      </main>
    );
  }

  if (!data || currentOrder === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-base">
        <p className="font-display text-xl text-ink">이야기를 준비하고 있어요…</p>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base px-6 text-center">
        <p className="font-display text-3xl text-ink">이야기를 끝까지 들었어요! 🎉</p>
        <p className="font-display text-xl text-ink">학습완료 활동으로 이동하고 있어요…</p>
      </main>
    );
  }

  return (
    // h-dvh 고정 — min-h면 대화 내역이 쌓일 때 페이지가 자라 화면 스크롤 발생 (T071, 핸드오프 §2.2 아이 화면 스크롤 미허용)
    <main className="flex h-dvh flex-col overflow-hidden bg-base">
      <ProgressHeader title={STORY_TITLE} n={currentPair} N={totalPairs} onExit={exitToDetail} />
      {currentScene && currentScene.type !== '대화' ? (
        <NarrationScene
          key={currentScene.id} // 장면 전환 시 문장 인덱스 초기화
          description={currentScene.description ?? ''}
          imageUrl={currentScene.imageUrl}
          narrationAudioUrl={currentScene.openingAudioUrl}
          onProceed={proceed}
        />
      ) : currentScene ? (
        // T038 배선 — 턴 사이클은 DialogueScene 내부(T037), CLOSING 오디오 종료 시 onSceneEnd로 진행
        <DialogueScene
          key={currentScene.id} // 장면 전환 시 턴 상태·대화 내역 초기화
          sessionId={data.sessionId}
          scene={currentScene}
          childName={data.childName}
          onSceneEnd={proceed} // 다음 장면 또는(마지막 대화) 학습완료 지점으로 — 선형 진행이라 order+1과 동치
        />
      ) : null}
      <Attribution /> {/* 타입캐스트 출처 표기 (T061, FR-013) — TTS 재생 화면 공통 크레딧 */}
    </main>
  );
}
