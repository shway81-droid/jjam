# jjam — 작업 규칙 (Claude용)

## PR 워크플로 — 생성 후 자동 머지 (사용자 기본 지시, 2026-06-16)

- **내가 PR을 만들면, 별도 지시가 없는 한 CI(`verify` = `npm test`)가 통과하는 즉시
  squash 머지한다.** 매번 "머지할까요?"라고 다시 묻지 않는다.
- **예외:** 사용자가 그 PR에 대해 "머지하지 마 / 먼저 확인 / 보류" 등 **특별한 말을 한 경우**
  — 그땐 머지하지 말고 묻고 기다린다.
- CI가 **실패하면 머지하지 않는다.** 원인을 고쳐 다시 통과시킨 뒤 머지한다.
- 드래프트로 생성했다면 머지 직전 ready(드래프트 해제)로 전환한다.
- 머지 방식은 저장소 관례대로 **squash**.

## 프로젝트 메모

- 순수 **정적 사이트**(HTML/CSS/JS). 빌드 단계 없음. 로컬 실행은 `python -m http.server`.
- **`npm test`** = `gen --check`(파생 메타 동기화) + 전 게임 정적 검증. PR CI 게이트와 동일.
- 게임 추가/수정 시 **`shared/style.css`·`shared/engine.js` 수정 금지**.
  메타데이터는 `game.json` **단일 소스** → `npm run gen`이 `index.html`(FALLBACK_GAMES·meta.json)과
  `engine.js`(_GAME_CATEGORY_MAP)를 자동 생성.
- 자동 게임 추가 루틴 절차서: `docs/AUTO_MODE.md` (이 루틴은 `main`에 직접 푸시).
