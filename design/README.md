# design/ — 디자인 원본 (git 미추적)

이 폴더의 파일들은 대용량 바이너리라 git에 올리지 않는다 (`.gitignore`에서 `/design/*` 제외, 이 README만 커밋됨).
clone 후에는 팀 공유 채널에서 아래 파일들을 전달받아 이 구조대로 배치할 것.

```
design/
├── GoodQuestion.fig                  # 피그마 원본 (89MB) — 일러스트 에셋 116개 내장
├── 디자인시스템/
│   └── 굿퀘스천_디자인시스템_V1.svg   # 컬러 7종 hex·타이포·컴포넌트 규칙 (내용은 V2)
├── 이미지/                           # 총 35장 PNG (장면 1448×1086, 프로필 1254×1254)
│   ├── 대표 이야기/                  # 썸네일 2, 도입_전개 5, 대화 5, 미션 2, 캐릭터 프로필 3
│   ├── 아이 프로필 캐릭터/            # 4종 × 배경 유/무 + 보호자
│   └── 추천 이야기/                  # 추천 썸네일 6
└── 폰트/                             # 압축 해제본 (원본 zip은 삭제됨)
    ├── Cafe24Ssurround-v2.0/         # 헤드라인용 라운드체 — otf·ttf·webfont(woff/woff2)·라이선스 PDF
    └── PretendardGOV-1.3.9/          # 본문용 — public/=OS 설치용 otf·ttf(93MB), web/=웹용 woff·woff2·서브셋(52MB)
```

## 참조

- 피그마 (구현 기준은 `개발 배포용` 페이지): https://www.figma.com/design/2QVzNfJldLCvRK7teKCRWX/GoodQuestion_Free?node-id=244-3134
- 디자인 토큰: Base `#FFF8EE` · Primary `#FF7A3D` · Sunny `#FFC93C` · Sage+ `#3DBE8B` · Sky `#4FA9E8` · Berry `#F262A0` · Text `#3A2C1E`
- 미확정: 헤드라인 폰트 — 피그마 텍스트 스타일은 Jua, 전달받은 폰트는 Cafe24Ssurround (기획 확인 대기)

앱에서 실제 사용할 에셋은 여기서 골라 옮겨 쓴다: 웹폰트 woff2는 `src/fonts/`로 추출 완료(커밋됨), 이야기 콘텐츠 이미지는 Supabase Storage, 소량 UI 에셋은 `public/` 예정.
