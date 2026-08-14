// 1:1 문의 정적 콘텐츠 (기능명세서 3.4 / 피그마 3.4 문의 내역·상세) — 목록·상세 페이지 공용.
// 스토리보드 시연 데이터 원문 유지(구독 결제 문의 등) — 실제 문의 접수 연동 시 교체 지점.
export type InquiryStatus = '답변대기' | '답변완료';

export type Inquiry = {
  id: string;
  /** 상세 상단 카테고리 칩 (스토리보드: '결제') */
  category: string;
  title: string;
  date: string;
  status: InquiryStatus;
  body: string;
  /** 답변완료일 때만 존재 */
  answer?: string;
};

export const INQUIRIES: Inquiry[] = [
  {
    id: '1',
    category: '결제',
    title: '구독 결제 문의',
    date: '2026.08.01',
    status: '답변대기',
    body: '안녕하세요. 구독 갱신 후 결제가 두 번 진행된 것 같습니다. 확인 부탁드립니다.',
  },
  {
    id: '2',
    category: '음성 대화',
    title: '말하기 대화가 자꾸 끊겨요',
    date: '2026.07.28',
    status: '답변완료',
    body: '아이가 대화하는 중에 캐릭터 응답이 늦거나 대화가 끊길 때가 있어요. 해결 방법이 있을까요?',
    answer:
      '안녕하세요, 굿퀘스천입니다.\n네트워크가 불안정하면 캐릭터 응답이 늦어질 수 있어요. Wi-Fi 연결 상태를 확인해 주시고, 같은 문제가 계속되면 앱을 완전히 종료 후 다시 실행해 주세요.\n이용에 불편을 드려 죄송합니다. 감사합니다.',
  },
];
