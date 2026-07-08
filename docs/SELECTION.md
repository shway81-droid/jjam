# 게임 선별 기록 (56 → 40)

원본 짬짬이 교실 56개 게임을 코드 분석(5개 그룹 병렬 분석)하여 메커니즘 중복 클러스터를 식별하고,
각 클러스터에서 더 재미있는(시각 피드백·교실 왁자지껄함·교육 가치 우위) 게임만 남김.

## 삭제된 16개와 사유

| 삭제 게임 | 중복 클러스터 | 남긴 대체 게임 | 사유 |
|---|---|---|---|
| synonym-quiz | 텍스트 4지선다 | opposite-word | 코드 99% 동일, 반대말이 저학년에 더 명확 |
| capital-quiz | 텍스트 4지선다 | flag-quiz | 같은 지리 주제, 국기 SVG가 시각적 압승 |
| unit-noun | 텍스트 4지선다 | animal-sort | 단위명사 개념이 어려움, 분류는 직관적 |
| more-or-less | 좌우 비교 | size-compare | 로직 100% 동일, 시각만 다름 |
| number-bond | 연산 빈칸 | quick-math | 같은 틀의 느린 변형 |
| coin-count | 합 계산 | dice-sum | dice-sum과 복붙 템플릿, 주사위가 더 시각적 |
| missing-piece | 시각 매칭 4지선다 | shadow-match | 동일 "대상→4선택" 반복 |
| mirror-match | 좌우 대칭 매칭 | fold-guess | 종이접기가 동적 생성 + 공간추론 상위호환 |
| shape-match | 같은 그림 찾기 | shadow-match | 그림자 추상화가 더 도전적·재밌음 |
| bomb-dodge | 움직이는 표적 탭 | balloon-pop, chase-tap | 파티클·피드백 열세 |
| arrow-tap | 자극→빠른 선택 | rps-react | 가위바위보가 웃음 + 논리 우위 |
| direction-relay | 순서 암기→말로 설명 | secret-code | 색 이름이 방향보다 명확, 25초 여유 |
| color-signal | 설명→9지선다 | word-chain | 끝말잇기가 한국 교실 친화 압승 |
| color-mix | 둘이 골라 조합 | sum-relay, jamo-merge | 색 혼합 규칙을 모르는 학생 많음 |
| arrow-rotate | 탭 회전 퍼즐 | pipe-connect | 단순 반복, 파이프가 시각·로직 상위호환 |
| one-stroke | 선 잇기 퍼즐 | dot-connect | 색 경로(Flow)가 시각·전략 우위 |

## 유지 40개 (카테고리 분포)

- speed (5): reaction-race, balloon-pop, rps-react, chase-tap, odd-color
- brain (8): color-touch, shadow-match, dots-and-boxes, memory-match, nim-game, odd-one-out, pattern-next, relation-match
- math (8): quick-math, size-compare, color-count, number-tap, clock-reading, math-sign, area-compare, dice-sum
- knowledge (8): ox-quiz, initial-quiz, flag-quiz, proverb-quiz, english-word, animal-sort, hangul-jamo, opposite-word
- coop (5): secret-code, sum-relay, jamo-merge, word-chain, memory-relay
- puzzle (6): slide-puzzle, maze-run, pipe-connect, dot-connect, fold-guess, hanoi

비고: english-word(유일한 영어 과목 게임), memory-match(검증된 고전)는
분석 에이전트가 삭제 후보로 올렸으나 콘텐츠 고유성을 이유로 유지.

## 신규 10개 추가 계획 (총 50)

카테고리 비율을 맞추기 위해: speed +2, brain +1, math +1, knowledge +1, coop +3, puzzle +2
→ 최종 분포: speed 7 / brain 9 / math 9 / knowledge 9 / coop 8 / puzzle 8 = 50

⚠️ 원본 사용자가 명시 삭제한 메커니즘 재추가 금지:
quick-sort, number-strike, assemble-shape, twin-find, find-pair-coop, whack-a-mole,
mirror-draw, rhythm-echo, turn-count, countdown-tap, flash-shape, clue-find, color-switch


## 🚫 사용자 삭제 (재추가 금지)

2026-06-11 사용자가 직접 삭제 지시 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- balance-scale (저울 균형 — 양팔저울 무게 합 비교)
- secret-code (비밀 암호 — 색 순서 암기해 말로 전달)
- word-chain (끝말잇기 협동)
- lights-out (불 끄기 — 십자 토글 라이츠아웃)

→ 46개 시점 분포: speed 7 / brain 9 / math 8 / knowledge 9 / coop 6 / puzzle 7

## ✅ 사용자 요청 복원 (2026-06-12)

사용자가 원작(jjamjjami-gyosil)에서 14개 게임 재추가를 직접 지시 —
위 "삭제된 16개" 표의 분석 사유보다 사용자 결정이 우선:

- speed: arrow-tap(방향 화살표)
- brain: missing-piece(빠진 조각), mirror-match(거울 대칭)
- math: skip-count(뛰어 세기), more-or-less(많다 적다), number-bond(수 가르기), coin-count(동전 세기)
- knowledge: job-tool(직업과 도구), unit-noun(단위 세기), synonym-quiz(비슷한 말), capital-quiz(수도 맞히기)
- coop: direction-relay(방향 따라하기), color-mix(색 섞기)
- puzzle: arrow-rotate(화살표 돌리기)

skip-count·job-tool은 선별 당시 원작에 없던 신규 게임. 나머지 12개는 중복 클러스터
정리분의 복원. "🚫 재추가 금지" 목록(balance-scale·secret-code·word-chain·lights-out)
과는 겹치지 않음.

→ 현재 60개. 분포: speed 8 / brain 11 / math 12 / knowledge 13 / coop 8 / puzzle 8

## 🚫 사용자 삭제 2차 (2026-06-12, 재추가 금지)

신규 45종 추가 직후 사용자가 24종 직접 삭제 지시 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- speed: tap-all(모두 잡아라 — 조건 수집 레이스), flag-updown(청기백기 — 깃발 상태 추적)
- brain: gear-spin(톱니바퀴 방향), line-up(줄서기 추리), cup-shuffle(컵 셔플 추적), rule-find(요술 상자 — 입출력 규칙 추론), block-view(위에서 본 모양)
- math: count-blocks(숨은 블록 세기)
- knowledge: animal-baby(아기 동물 이름), sign-quiz(표지판 뜻)
- coop: split-count(나눠 세기), updown-number(업다운 수 맞히기), coord-pass(좌표 전달), sync-tap(동시 터치 협응), fair-share(무게 균등 분배), word-relay(음절 분담 릴레이), sort-together(공동 정렬)
- puzzle: car-escape(러시아워 차 빼기), river-cross(강 건너기), word-search(낱말 찾기), mini-sudoku(미니 스도쿠), frog-swap(개구리 자리 교환), logic-grid(노노그램), code-break(마스터마인드)

→ 현재 81개. 분포: speed 15 / brain 13 / math 17 / knowledge 16 / coop 10 / puzzle 10

## 🚫 사용자 삭제 3차 (재추가 금지)

81종 이후 추가로 3종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- speed: emoji-zoom(점점 커져요 — 점점 커지는 이모지 관련 반응)
- brain: hidden-shapes(숨은 도형 세기 — 겹친 도형 개수 세기)
- coop: clock-pass(시계 맞추기 — 시각 정보 전달·맞히기)

→ 현재 78개. 분포: speed 14 / brain 12 / math 17 / knowledge 16 / coop 9 / puzzle 10

## 🚫 사용자 삭제 4차 (재추가 금지)

자동 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: num-merge(숫자 합치기 — 같은 수를 밀어 두 배로 합치는 2048형 타일 머지)

→ 현재 79개. 분포: speed 14 / brain 12 / math 17 / knowledge 16 / coop 10 / puzzle 10

## 🚫 사용자 삭제 5차 (재추가 금지)

자동 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: color-flood(색 번지기 — 왼쪽 위 칸에서 같은 색 영역을 번지게 해 판 전체를 한 색으로 만드는 Flood-It형)

→ 현재 80개. 분포: speed 14 / brain 12 / math 17 / knowledge 16 / coop 11 / puzzle 10

## 🚫 사용자 삭제 6차 (재추가 금지)

자동 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: peg-jump(콩콩 점프 — 콩을 인접한 콩 너머 빈 칸으로 뛰어넘어 잡으며 마지막 한 알만 남기는 페그 솔리테어)

→ 현재 85개. 분포: speed 15 / brain 13 / math 17 / knowledge 16 / coop 13 / puzzle 11

## 🚫 사용자 삭제 7차 (재추가 금지)

자동 추가분 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- brain: flip-over(뒤집기 — 돌을 놓아 8방향으로 끼인 상대 돌을 내 색으로 뒤집는 리버시/오델로형 영역 차지)
- coop: attr-combo(짝꿍 모으기 — P1은 색·P2는 모양을 골라 주문 카드의 색+모양 두 속성을 함께 맞춰 완성하는 속성 조합 협력)

→ 현재 87개. 분포: speed 16 / brain 13 / math 17 / knowledge 16 / coop 13 / puzzle 12

## 🚫 사용자 삭제 8차 (재추가 금지)

자동 추가분 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- brain: step-path(발자국 따라가기 — 격자 위 화살표 순서를 차례로 따라가 발자국이 도착하는 칸의 숫자를 가장 먼저 맞히는 경로 추적)
- puzzle: maze-steps(미로 몇 칸? — 시작에서 끝까지 외길 미로를 따라 이동해야 하는 칸 수를 세어 맞히는 경로 칸 수 세기)

→ 현재 97개. 분포: speed 17 / brain 16 / math 18 / knowledge 17 / coop 14 / puzzle 15

## 🚫 사용자 삭제 9차 (재추가 금지)

직전 추가분(97→101개) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: domino-fill(도미노 채우기 — 1×2 도미노로 빈 격자를 빈틈없이 덮는 도미노 타일링)

→ 현재 100개. 분포: speed 17 / brain 17 / math 18 / knowledge 18 / coop 15 / puzzle 15

## 🚫 사용자 삭제 10차 (재추가 금지)

직전 자동 추가분(2026-06-23, 104→107개) 중 3종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- speed: flip-arrow(거꾸로 화살표 — 화살표가 가리키는 반대 방향을 누르는 반대방향 반응)
- coop: skip-relay(뛰어 세기 짝꿍 — 규칙대로 다음 수를 둘이 번갈아 이어 세는 협력 뛰어세기 릴레이)
- puzzle: neighbor-color(이웃 다른 색 — 8방향 이웃과 다른 색이 되도록 4색으로 칠하는 격자 4색 제약 만족 퍼즐)

비고: 같은 날 추가한 decalco(데칼코마니 — 좌우 대칭 색칠)는 유지.

→ 현재 104개. 분포: speed 17 / brain 18 / math 18 / knowledge 18 / coop 17 / puzzle 16

## 🚫 사용자 삭제 11차 (재추가 금지)

직전 자동 추가분(2026-06-24, 104→108개) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- knowledge: sports-quiz(운동 종목 맞히기 — 운동 경기 이모지를 보고 종목 이름을 4지선다로 맞히기)
- speed: multiple-react(배수 반응 — 흐르는 수가 3의 배수/5의 배수/아님인지 빠르게 판단해 누르기)

비고: 같은 날 추가한 sum-pyramid(덧셈 피라미드 — 아래 두 칸 합이 위 칸인 빈칸 채우기 퍼즐)·
diff-pair(빼기 짝꿍 — 두 카드의 차가 목표가 되게 맞추는 협력)는 유지.

→ 현재 106개. 분포: speed 17 / brain 18 / math 18 / knowledge 18 / coop 18 / puzzle 17

## 🚫 사용자 삭제 12차 (재추가 금지)

직전 자동 추가분(2026-06-26, 110→114개) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- brain: pick-ends(양끝 집기 — 줄 양쪽 끝에서 동전을 번갈아 하나씩 가져가 합이 큰 사람이 이기는 2인 전략)
- puzzle: hop-path(징검다리 폴짝 — 칸에 적힌 수만큼 좌/우로 점프해 깃발까지 가장 먼저 도착하는 점프 경로 퍼즐)

비고: 같은 날 추가한 middle-tap(가운데 수 — 여러 수 중 중앙값을 빠르게 터치)·
ten-blocks(십 묶음 세기 — 십 모형과 낱개를 보고 두 자리 수 읽기)는 유지.

→ 현재 112개. 분포: speed 19 / brain 18 / math 20 / knowledge 19 / coop 19 / puzzle 17

## 🚫 사용자 삭제 13차 (재추가 금지)

직전 자동 추가분(2026-06-27) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- brain: trap-game(가두기 대결 — 격자에서 두 말이 번갈아 이웃 칸으로 이동하고 지나온 칸이 벽이 되어 상대를 먼저 가두는 Tron/Isolation형 2인 전략)

비고: 같은 날 추가한 hanja-quiz(한자 뜻 맞히기)·smallest-tap(가장 작은 수)·swap-sort(자리 바꿔 정렬)는 유지.

→ (이후 다른 루틴 추가분 반영 시점) 119개.

## 🚫 사용자 삭제 14차 (재추가 금지)

자동 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- brain: hex-link(맞은편 잇기 — 육각 인접 보드에서 양쪽 맞은편 변을 자기 색 돌로 끊김 없이 먼저 잇는 Hex형 2인 연결 전략)

→ 현재 118개. 분포: speed 20 / brain 18 / math 21 / knowledge 21 / coop 20 / puzzle 18

## 🚫 사용자 삭제 15차 (재추가 금지)

직전 자동 추가분(2026-06-29) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: spin-paint(빙글 색칠 — 왼쪽 단서를 보드 중심 기준 180°(점대칭/회전대칭)로 돌린 모습으로 오른쪽 격자를 색칠해 먼저 완성하는 대칭 채우기. decalco(좌우 거울 대칭 채우기)의 회전 변형)
- coop: decimal-build(소수 만들기 — P1은 일의 자리, P2는 소수 첫째 자리를 골라 목표 소수를 함께 만드는 협력. place-value(자릿값 합체)의 소수 변형)

비고: 같은 날 추가한 avoid-triangle(삼각형 피하기 — Sim 2인 전략)·second-big(두 번째로 큰 수)은 유지.

→ 현재 120개. 분포: speed 21 / brain 19 / math 21 / knowledge 21 / coop 20 / puzzle 18

## 🚫 사용자 삭제 16차 (재추가 금지)

직전 자동 추가분(2026-06-30, 120→124개) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- math: group-count(묶어 세기 — 똑같은 묶음이 K개, 한 묶음에 M개 → 모두 K×M개를 곱셈으로 세는 묶어 세기/곱셈 도입)
- coop: batchim-build(받침 합체 — P1은 받침 없는 기본 글자, P2는 받침을 골라 완성 글자를 함께 만드는 협력. place-value(자릿값 합체)·jamo-merge(자음+모음 합치기)의 받침 변형)

비고: 같은 날 추가한 lonely-find(외톨이 찾기 — 짝 없는 그림 찾기)·shape-overlay(겹쳐 보기 — 두 격자 합집합)는 유지.

→ 현재 122개. 분포: speed 21 / brain 20 / math 21 / knowledge 21 / coop 20 / puzzle 19

## 🚫 사용자 삭제 17차 (재추가 금지)

직전 자동 추가분(2026-07-02, 122→126개) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- speed: range-tap(사이 수 찾기 — 흐르는 가운데 수가 두 경계 수 사이(범위 안)에 있는지 「사이/밖」으로 판단하는 범위 포함 반응)

비고: 같은 날 추가한 time-add(시간 더하기 — 경과 시각 계산)·greeting-quiz(나라 인사말 — 인사말로 나라 맞히기)·num-rule(숫자 규칙 — 수 배열의 다음 수)은 유지.

→ 현재 125개. 분포: speed 21 / brain 21 / math 22 / knowledge 22 / coop 20 / puzzle 19

## 🚫 사용자 삭제 18차 (재추가 금지)

직전 자동 추가분(2026-07-03, 125→129개) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- coop: ones-pair(끝수 짝꿍 — P1·P2가 카드를 한 장씩 골라 두 수를 더한 값의 일의 자리(끝수)가 목표가 되게 맞추는 협력. sum-relay(합 만들기)·fill-exact(딱 맞게 채우기)의 「합의 끝수」 변형)

비고: 같은 날 추가한 ladder-climb(사다리 타기 — 아미다 경로 추적)·ten-friend(10 친구 — 10의 보수 반응)·num-riddle(숫자 수수께끼 — 조건 추리)는 유지.

→ 현재 128개. 분포: speed 22 / brain 22 / math 22 / knowledge 22 / coop 20 / puzzle 20

## 🚫 사용자 삭제 19차 (재추가 금지)

직전 자동 추가분(2026-07-05, PR #37로 4종 추가) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- coop: angle-pair(각도 짝꿍 — P1·P2가 각 조각을 하나씩 골라 두 각의 합이 목표 각도가 되게 맞추는 협력. sum-relay(합 만들기)의 「각도 합」 변형)
- brain: same-value(같은 값 찾기 — 주어진 수와 계산 결과가 같은 식을 4지선다로 고르는 수 동치 판단. quick-math(빠른 계산)의 「값이 같은 식」 변형)

비고: 같은 날 추가한 near-tap(가까운 수 — 목표에 가장 가까운 수를 빠르게 터치)·space-quiz(우주 퀴즈 — 행성·별·달 4지선다)는 유지.

→ 현재 134개. 분포: speed 23 / brain 22 / math 23 / knowledge 24 / coop 21 / puzzle 21

## 🚫 사용자 삭제 20차 (재추가 금지)

직전 자동 추가분(2026-07-06) 3종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- math: ruler-read(자로 재기 — 자 눈금 위 막대의 길이(cm)를 4지선다로 읽는 자·눈금 읽기 측정)
- brain: chomp(초콜릿 게임 — 한 칸을 고르면 그 칸의 오른쪽·아래가 모두 사라지고 왼쪽 위 독 초콜릿을 먹으면 지는 Chomp형 님류 2인 전략)
- math: calendar-read(달력 읽기 — 달력에서 표시된 날짜의 요일을 4지선다로 읽는 달력·요일 읽기)

비고: 「눈금/달력 읽기」 측정형과 Chomp 전략 모두 재추가 금지. 같은 눈금 읽기(온도계·저울 다이얼 등)도 이 축으로 간주해 신중할 것.

→ 현재 134개. 분포: speed 23 / brain 22 / math 23 / knowledge 24 / coop 21 / puzzle 21

## 🚫 사용자 삭제 21차 (재추가 금지)

직전 자동 추가분(2026-07-07, 134→138개) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- speed: calc-flash(번개 계산 — 존마다 떠오르는 풍선에 적힌 간단한 식을 계산해, 그 값이 수시로 바뀌는 목표 수와 같은 풍선만 골라 터트리고 오답 터치 시 -1점인 흐르는 연산 판단/go-no-go 반응)

비고: 같은 날 추가한 remainder-quiz(나머지 구하기)·world-quiz(세계 여러 나라)·angle-type(각의 종류)는 유지. 「흐르는 식을 계산해 목표값과 일치하면 터치」하는 연산 스트림 반응은 이 축으로 간주해 재추가 금지.

→ 현재 137개. 분포: speed 23 / brain 22 / math 25 / knowledge 25 / coop 21 / puzzle 21

## 🚫 사용자 삭제 22차 (재추가 금지)

직전 자동 추가분(2026-07-08, 137→141개) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:

- puzzle: dice-roll(주사위 굴리기 — 십자로 그린 주사위를 화살표 방향대로 굴렸을 때 마지막에 오는 윗면 수를 맞히는 주사위 굴림 방향 추적/공간 추론)
- brain: three-mill(세 알 고누 — 말 세 개를 놓은 뒤 이웃한 빈 칸으로 한 칸씩 옮겨 가로·세로·대각선 한 줄을 먼저 만드는 Three Men's Morris형 2인 놓기+이동 전략)

비고: 같은 날 추가한 science-quiz(과학 퀴즈)·times-quiz(구구단)는 유지. 「주사위를 굴려 윗면 추적」 공간 추론과 「놓고 옮겨 세 줄 잇기」 이동형 삼목 전략 모두 이 축으로 간주해 재추가 금지.

→ 현재 139개. 분포: speed 23 / brain 22 / math 26 / knowledge 26 / coop 21 / puzzle 21

> ⚠️ 자동 추가 루틴(`docs/AUTO_MODE.md`)은 이 문서의 1·2·3·4·5·6·7·8·9·10·11·12·13·14·15·16·17·18·19·20·21·22차 삭제 목록 + `GAME_ANTIPATTERNS.md` 0절을
> 후보 제외(avoid) 기준으로 읽는다. 게임을 삭제하면 여기에 반드시 기록할 것 — 누락 시 루틴이 재생성한다.
