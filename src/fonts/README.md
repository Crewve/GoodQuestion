# 폰트 파일

`next/font/local`로 연결해 사용한다 (연결 코드는 개발 착수 시 `src/app/layout.tsx`에 추가).

| 파일 | 용도 | 출처·라이선스 |
|---|---|---|
| `PretendardGOV-*.subset.woff2` (400/500/600/700) | 본문 | PretendardGOV 1.3.9 서브셋판 — SIL OFL 1.1 |
| `Cafe24Ssurround-v2.0.woff2` | 헤드라인(라운드체) | Cafe24 Ssurround v2.0 — 무료 상업용 (라이선스 PDF: design/폰트 원본 참조) |

- 서브셋판은 상용 한글 글리프만 포함한 경량판(웨이트당 ~260KB). 다른 웨이트·전체판이 필요하면 `design/폰트/PretendardGOV-1.3.9/web/static/`에서 추가로 복사.
- 헤드라인 폰트는 피그마 텍스트 스타일(Jua)과 전달본(Cafe24Ssurround)이 달라 기획 확인 대기 중 — 확정되면 이 표를 갱신할 것.
