# 자동 게임 추가 — 절차서 (AUTO_MODE)

> 매일 **10:00 KST** 데스크톱 루틴이 이 문서를 따라 새 게임을 자동 추가한다.
> **하루 목표 4개. 완전 자동(사용자 승인 단계 없음). 대상 브랜치 `main`.**
> 데스크톱에 붙여넣는 트리거 프롬프트: `docs/AUTO_ROUTINE_PROMPT.md`
> 골든 템플릿(복사 기준): `docs/PATTERNS.md`

## 핵심 원칙

1. **기존과 일치** — 새 디자인을 발명하지 않는다. `PATTERNS.md`의 골든 템플릿을 그대로
   복사하고 Level 3 Comic(크림 `#FFF8E1`·검정 3px 테두리·하드 그림자)을 고정한다.
2. **카테고리 균등 + 선제 보충** — 제작 전 게임 풀을 먼저 만들어 *가장 적은 카테고리부터* 채운다.
   풀 목표 크기는 **20개**이며, 후보가 **10개 이하**로 줄면 소진되기 전에 미리 20개까지 보충한다
   (풀이 절대 0이 되지 않게). **이미 삭제된 게임은 재생성하지 않는다.**
3. **전수 검증** — 만들면 검증하고, 오류가 있으면 통과할 때까지 고친다.

## 사용하는 헬퍼

```
node scripts/auto-add-game-helpers.js <command>
  preflight              실패차단 + 오늘 푸시 수 + pendingGames 통합 응답
  stats                  카테고리별 게임 수 (풀 생성 입력)
  list-existing-folders  등록된 폴더명 목록
  today-pushed-count     오늘 KST Auto-add 푸시 수 + 남은 수
  discard <folder>       실패 게임 폐기(폴더+registry+메타 재생성+실패로그)
  recent-failures        오늘 실패 횟수(3회 시 차단)
```

---

## 0. 사전 점검 (필수)

```bash
node scripts/auto-add-game-helpers.js preflight
git pull origin main      # 실패 시 그날 작업 중단
```

`preflight` 응답으로 분기:

| 조건 | 행동 |
|---|---|
| `shouldRun:false` + `blockedForToday:true` | 즉시 종료 (오늘 누적 실패 3회) |
| `shouldRun:false` + `alreadyComplete:true` | 즉시 종료 (오늘 이미 4개 푸시) |
| `shouldRun:true` | `pendingGames`(1~4) 개수만큼 제작 |

> ⚠️ `pendingGames`를 변수로 기억하라. = "오늘 추가로 만들어야 하는 게임 수".
> N이면 N개(1~4)를 서로 다른 카테고리로 연속 제작한다.

## 1. 게임 풀 생성·선택 (카테고리 균등)

게임 풀은 `.claude/game-pool.json`에 로컬 영구 저장한다(`.gitignore`되어 커밋 안 됨 —
같은 데스크톱에서 매일 이어 쓴다).

```bash
node scripts/auto-add-game-helpers.js stats
node scripts/auto-add-game-helpers.js list-existing-folders
```

**(A) 풀이 없거나 후보가 10개 이하면 20개까지 채운다(선제 보충):**

- 목표는 풀에 **항상 후보 20개**를 유지하는 것. 현재 풀에 남은 후보 수를 세어
  `20 - 남은수`만큼 **새 후보를 추가(top-up)**한다(기존에 남아 있는 후보는 버리지 않고 그대로 둔다).
- `stats`의 `byCategory`에서 **가장 적은 카테고리부터** 채운다. 균등을 강제하지는 않는다 —
  포화된 카테고리(speed/brain/coop/puzzle)에서 distinct·저삭제위험 후보가 부족하면
  콘텐츠형(knowledge·math)으로 채워서라도 20개를 맞춘다.
- 각 후보 = `{ folder, name, category, pattern, template }`
  (`pattern`=A~D, `template`=`PATTERNS.md`의 복사할 실존 게임 폴더).
- 새 후보는 **현재 풀에 남은 후보 + registry + 0절/삭제목록**과 모두 교차 대조해 중복·금지를 피한다.
- 갱신한 배열을 `.claude/game-pool.json`에 저장한다.
- 만약 거듭된 포화로 20개를 못 채우면 **만들 수 있는 만큼만** 채우고 그 사실을 로그에 남긴다
  (다음 보충 때 재시도). 그래도 풀이 비지 않도록 최소 1개 이상은 항상 남긴다.

> **⚠️ 풀 완전 소진 시(주제 고갈) 동작 — 중요:**
> 시드해 둔 후보를 다 쓰고 나면, 매 실행마다 (A)로 **새 후보를 새로 발상**해 보충한다.
> 그런데 registry가 커질수록 "깨끗한(중복 없고·모호하지 않고·삭제 이력 없는) 신규 주제"가
> 점점 귀해진다. 이때 규칙은:
> 1. **절대 금지 유지** — 삭제목록(SELECTION 1~N차)·0절 메커니즘은 재고갈이어도 **재생성 금지**.
>    숫자를 채우려고 삭제된 것/중복/모호한 것을 만들지 않는다(만들면 그날 지워져 헛수고).
> 2. **못 채우면 적게** — 그날 깨끗한 후보가 2개뿐이면 2개만 만들고 종료한다(4개 억지 금지).
>    `today-pushed-count`가 4 미만이어도 **blockedForToday가 아니고 더 만들 깨끗한 후보가 없으면**
>    그날은 거기서 끝낸다(다음 날 preflight가 부족분을 pendingGames로 재시도).
> 3. **완만한 정체 허용** — 이렇게 하면 하루 4개가 안 되는 날이 생겨 목표(예: 200개) 도달이
>    며칠 늦어질 수 있다. 그래도 **품질·비삭제가 수량보다 우선**이다. 정체는 실패가 아니라
>    "이 제품 콘셉트(30초·다인·객관식·한 화면)의 설계 공간이 그만큼 찼다"는 신호다.
> 4. **새 소재 발굴** — 매 실행 fresh 컨텍스트에서 새 그림 주제(생활 낱말)·설명 주제(상식)·
>    새 메커니즘을 탐색한다. 계절/행사 등 시의성 소재도 활용. 찾으면 풀에 시드해 이어 쓴다.

**(B) 오늘 만들 게임을 풀 앞에서 꺼낸다:**

- N번째 게임은 *오늘 이미 푸시된 게임 + 직전 게임*과 **다른 카테고리 우선**(다양성).
  `preflight` 응답 `todayPushed[].subject`의 `(카테고리, …)`에서 추출해 회피.
  후보가 그 카테고리에만 남았으면 같은 카테고리도 허용.
- 선택 항목은 풀에서 제거(소비)한다.
- **오늘치 소비를 마친 뒤** 풀에 후보가 **10개 이하**로 남았으면, 소진되기 전에
  **즉시 (A)로 20개까지 선제 보충**한다(풀이 절대 0이 되지 않게). 보충도 같은 데스크톱의
  `.claude/game-pool.json`에 누적 저장되어 다음 날로 이어진다.

### 재생성 금지(avoid) 기준 — 후보 생성 시 전부 교차 대조

- 현재 `games/registry.json`의 등록 폴더(중복 폴더·동일 메커니즘 금지)
- `docs/GAME_ANTIPATTERNS.md` 0절 — **삭제 확정 17종**
- `docs/SELECTION.md` — **사용자 삭제 1차·2차·3차** 전체
- 폴더명이 달라도 기존 게임과 *데이터 형식 + 인터랙션*이 같으면 금지

## 2. 제작 (게임마다)

`docs/PATTERNS.md`를 따른다:

1. 패턴에 맞는 골든 템플릿 폴더를 `games/<새폴더>/`로 통째 복사.
2. 4파일(`game.json`, `index.html`, `style.css`, `game.js`) 작성. 디자인은 템플릿 그대로.
3. `game.json`에 `category`·`players`·`icon`·`color` 정확히 기입(메타데이터 단일 소스).
4. `games/registry.json` 배열에 새 폴더명 추가.
5. 파생 메타 자동 생성:

```bash
npm run gen   # → index.html FALLBACK_GAMES + shared/engine.js _GAME_CATEGORY_MAP
```

## 3. 검증 (게임마다, 모두 통과해야 함)

```bash
node scripts/verify-game.js <폴더>   # 정적 21항목 전부 PASS
npm test                              # gen --check 동기화 + 전 게임 정합성 (CI와 동일 게이트)
node scripts/browser-verify.js <폴더> # 실브라우저 자동 플레이 → 결과화면 도달 + 실 JS에러 0
```

- **브라우저 검증(필수·자동):** `scripts/browser-verify.js`가 사전설치 Chromium(Playwright)으로
  인트로→PLAY→카운트다운→매 라운드 응답→**결과화면 도달**까지 자동 플레이하고, 자원로딩 노이즈를
  제외한 **실 JS 에러 0**을 확인한다(결과 스크린샷도 저장). 게임당 ~25초.
  - **사전 준비(세션 1회):** `npm i -D playwright` (브라우저는 `PLAYWRIGHT_BROWSERS_PATH`에 이미 있음).
  - Preview MCP가 있으면 그것도 가능하나, **기본은 browser-verify**를 쓴다. 둘 다 없으면 정적까지만 하고
    그 사실을 커밋/로그에 남긴다.
- **자가 품질 게이트 6개:**
  - (a) 데이터 30개 이상 (패턴 A 한정)
  - (b) 보기 정답 중복 없음
  - (c) 인트로 일러스트 존재
  - (d) `shared/style.css` 미수정 (engine.js `_GAME_CATEGORY_MAP`은 `npm run gen`이 갱신 → 허용)
  - (e) 콘솔 에러 0
  - (f) 결과 화면 도달 성공

## 4. 통과 시 (게임마다) — 커밋·푸시

```bash
git add games/<폴더>/ games/registry.json index.html shared/engine.js
git commit -m "Auto-add: <이름> (<카테고리>, 패턴 <A|B|C|D>)"
git push origin main
```

> **커밋 제목은 반드시 `Auto-add:`로 시작**한다 — 헬퍼의 `today-pushed-count`/`preflight`가
> 이 프리픽스로 오늘 푸시 수를 집계한다. 형식이 깨지면 진행도 추적이 망가진다.

푸시 실패(네트워크)는 로컬 커밋을 유지하고 다음 게임으로 계속한다.

## 5. 실패 시

```bash
node scripts/auto-add-game-helpers.js discard <폴더>
node scripts/auto-add-game-helpers.js recent-failures
```

- 실패 후보는 `.claude/game-pool.json`에서도 제거하고 다음 후보로.
- `blockedForToday:true`(오늘 누적 3회) → 그날 작업 중단. 아니면 다음 후보 시도.

## 6. 종료 전 자가 점검 (필수)

```bash
node scripts/auto-add-game-helpers.js today-pushed-count
```

- `todayPushedCount`가 `dailyTarget`(=4)에 도달했는가?
- 부족 + `blockedForToday` 아님 → **다음 게임 제작 계속(절대 종료 금지)**.
- 도달 또는 차단 → 종료.

---

## 실행 흐름 (요약)

```
[preflight] →
  blockedForToday → 종료
  alreadyComplete → 종료
  else (pendingGames = 1~4):
    풀 보충 점검: 풀이 없거나 후보 ≤10개면 (A)로 20개까지 선제 보충
    반복: [풀 선택 → 제작 → 검증(verify + npm test + 브라우저) → 커밋 → push origin main]
    종료 직전:
      ① today-pushed-count 재확인
         → 부족 + 미차단 → 다음 게임 계속
         → 충족 또는 차단 → ②로
      ② 풀 보충 점검: 소비 후 후보 ≤10개면 (A)로 20개까지 선제 보충 → 종료
```

## 부록: 남은 저위험 후보 힌트 (2026-07-15 기준)

`.claude/game-pool.json`은 데스크톱마다 로컬(gitignore)이라 세션 간 공유가 안 되므로,
**깨끗한 신규 후보가 귀해진 현 시점**의 힌트를 여기(커밋되는 문서)에 남긴다. 풀 보충 시 참고:

- **아직 만들 만한 것(그림형·큰 이모지 규칙 적용):**
  - `body-part-quiz` "무슨 몸의 부분?" — 👀눈·👂귀·👃코·👄입·🦷이·🦶발·🦵다리·🧠뇌·💪팔 등 몸 부위 이름.
    (body-quiz는 '몸 상식 설명'이라 소재 겹치되 과제가 다름 — 그림 낱말 인지)
  - `tech-device` "무슨 기기?" — 💻노트북·🖥️컴퓨터·⌨️키보드·🖱️마우스·📱스마트폰·🎧이어폰·🖨️프린터·📷카메라 등
    디지털 기기 이름. (household는 가전, 이건 디지털 기기 — 소재 구분)
- **주의:** 위 둘도 문항 ~10개대라 얇다. 이후로는 **깨끗한 신규 주제가 거의 없다.**
  §1의 "풀 완전 소진 시 동작"을 따라 **하루 4개를 억지로 채우지 말고**, 그날 나오는 만큼만 만들고
  삭제 이력/중복/모호 후보는 절대 만들지 않는다. 목표(200 등) 도달이 며칠 늦어지는 것은 정상이다.
- **탐색 권장 방향:** 새 그림 주제(생활 낱말)·설명 상식·시의성(계절/행사) 소재, 그리고 포화되지 않은
  카테고리(coop 20·brain·puzzle)에서 **삭제 이력과 겹치지 않는** 신 메커니즘.

## 절대 금지

- `shared/style.css` 수정 (engine.js `_GAME_CATEGORY_MAP` 갱신은 `npm run gen` 경유만 허용)
- 사용자 승인 단계 (완전 자동 모드)
- 디자인 새로 만들기 (골든 템플릿 그대로)
- **PR(풀 리퀘스트)로만 올리고 끝내기** — 결과는 항상 `main`에 직접 커밋·푸시한다
  (`git push origin main`). 드래프트 PR로 대체하지 말 것.
- `GAME_ANTIPATTERNS.md`(0절)·`SELECTION.md`(삭제 1·2·3차)의 게임/메커니즘 재생성
- 사용자가 중간에 질문해도 `pendingGames`가 0이 될 때까지 작업 중단 금지
  (짧게 답하고 즉시 재개)
- 자가 점검(6단계) 생략 금지 — 게임 1개 푸시하고 끝내지 말 것

## 종료

별도 메시지 없이 끝낸다. 결과는 git 커밋 로그로만 확인:
`git log --oneline | grep Auto-add` 의 오늘 자 커밋 수.
일부 성공(4건 미만)이면 다음날 `preflight`가 모자란 수만큼 `pendingGames`로 자동 보강한다.
