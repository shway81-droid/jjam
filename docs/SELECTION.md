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
## 🚫 사용자 삭제 23차 (재추가 금지)
직전 자동 추가분(2026-07-09, 139→143개) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- math: perimeter-quiz(둘레 구하기 — 정사각형·직사각형·삼각형의 변의 길이를 더해 둘레를 4지선다로 구하는 도형 둘레 계산)
- puzzle: one-stroke(한붓그리기 — 붓을 떼지 않고 도형의 모든 선을 한 번씩 이어 긋는 오일러 경로/한붓그리기)

비고: 같은 날 추가한 dino-quiz(공룡 퀴즈)·analogy-quiz(짝꿍 유추)는 유지.
→ 현재 141개. 분포: speed 23 / brain 23 / math 26 / knowledge 27 / coop 21 / puzzle 21

## 🚫 사용자 삭제 24차 (재추가 금지)
직전 자동 추가분(2026-07-10, 141→145개) 중 3종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- speed: arrow-trick(화살표 술래 — 방향 낱말(글자)은 함정, 화살표가 가리키는 방향을 누르는 방향 스트룹/Stroop·억제(inhibition) 반응)
- brain: reverse-tictactoe(거꾸로 삼목 — 같은 표식(✕)을 번갈아 놓다 가로·세로·대각선 세 칸을 먼저 이으면 지는 미제르(misère) 삼목 2인 전략)
- coop: midpoint-pair(수직선 짝꿍 — 목표가 두 수의 딱 한가운데(양쪽 거리가 같은 대칭점)에 오게 P1·P2가 수를 하나씩 고르는 수직선 중점/대칭 협력)

비고: 같은 날 추가한 block-pop(뭉치 터트리기 — 붙어있는 같은 색 뭉치를 터트려 없애는 SameGame형 격자 퍼즐)은 유지.
→ 현재 142개. 분포: speed 23 / brain 23 / math 26 / knowledge 27 / coop 21 / puzzle 22

## 🚫 사용자 삭제 25차 (재추가 금지)
자동 추가분 6종 삭제(직전 2026-07-13 추가분 3종 포함) — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- math: divisor-quiz(약수 콕 — 주어진 수의 약수가 아닌 수를 네 수 중 골라 가장 먼저 터치하는 약수 판별)
- math: decimal-size(소수 크기 — 네 소수 중 가장 큰(또는 가장 작은) 소수를 찾아 터치하는 소수 크기 비교)
- math: digit-sum(자릿수 합 — 수의 각 자리 숫자를 모두 더한 값을 4지선다로 고르는 자릿수 합 계산)
- math: missing-op(알맞은 기호 — 식의 빈칸에 들어갈 연산 기호(+·−·×·÷)를 4지선다로 고르는 빈칸 연산 기호 추론)
- knowledge: landmark-quiz(세계 명소 — 짧은 설명을 보고 세계의 유명한 명소 이름을 4지선다로 맞히는 명소 상식)
- brain: wrong-calc(틀린 셈 찾기 — 네 식 중 계산이 틀린(등식이 거짓인) 식을 찾아 가장 먼저 터치하는 계산 오류 판별)

비고: 같은 날 자동 추가한 unit-convert(단위 바꾸기 — 길이 단위 mm·cm·m 환산)는 유지.
→ 현재 144개. 분포: speed 23 / brain 23 / math 27 / knowledge 28 / coop 21 / puzzle 22

## 🚫 사용자 삭제 26차 (재추가 금지)
직전 자동 추가분(2026-07-13) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- speed: biggest-even(가장 큰 짝수 — 여러 수 중 가장 큰 '짝수'를 찾아 터치. **biggest-tap(가장 큰 수)의 중복 변형** — "여러 수 중 극값을 찾아 터치"라는 골격이 biggest-tap·smallest-tap·second-big·middle-tap·near-tap과 동일하고, 거기에 홀짝 필터만 얹은 것)

⚠️ **일반화 금지 규칙:** "여러 수 중 극값(가장 큰/작은/두 번째/가운데/가까운 수)을 찾아 터치"하는 계열은 이미
biggest-tap·smallest-tap·second-big·middle-tap·near-tap으로 포화됨. 여기에 **속성 필터(짝수/홀수/색/모양 등)만
얹은 변형**(예: 가장 큰 짝수, 가장 작은 홀수, 그 색 중 가장 큰 것=color-biggest 등)도 **같은 계열로 보고 재추가 금지**.

비고: 같은 날 자동 추가한 나눗셈 몫(division-quiz)·관용구 뜻(idiom-expr)은 유지.
→ 현재 147개.

## 🚫 사용자 삭제 27차 (재추가 금지)
직전 자동 추가분(2026-07-13) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- brain: who-lies(누가 거짓말? — 용의자 여러 명의 진술 중 "한 명만 거짓말" 전제로 거짓말쟁이/범인을 4지선다로 추리하는 진술 일관성·거짓말쟁이 논리 퍼즐. 진술 참거짓 추적형 논리 추리 전반이 이 축)

⚠️ **일반화:** "여러 진술 중 참/거짓을 따져 거짓말쟁이·범인을 추리"하는 논리 추리형(라이어/기사와 건달류)은 이 축으로 보고 재추가 금지.

비고: 같은 날 자동 추가한 나눗셈 몫(division-quiz)·관용구 뜻(idiom-expr)·악기 종류(instrument-quiz)는 유지.
→ 현재 146개. 분포: speed 23 / brain 23 / math 28 / knowledge 30 / coop 21 / puzzle 22

## 🚫 사용자 삭제 28차 (재추가 금지)
전체 게임 중복 감사(2026-07-13) 결과 near-duplicate 1쌍 정리 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- coop: place-combo(자릿값 합체 — P1이 십단위 값(10·20·…·90), P2가 일의 자리(0~9)를 골라 목표 두 자리 수를 만드는 협력. **place-value(두 자리 수 만들기)와 사실상 동일** — "P1 십의 자리 + P2 일의 자리 → 목표 두 자리 수"로 학습 목표·인터랙션·판정이 같고, P1 보기를 값('40')으로 보여주느냐 숫자('4')로 보여주느냐만 다름)

⚠️ **유지:** place-value(두 자리 수 만들기)는 남긴다. "P1 십의 자리 + P2 일의 자리 → 목표 두 자리 수" 자릿값 합성 협력은 place-value 하나로 충분 — 표현만 바꾼 변형(값/숫자 표시 등) 재추가 금지.

→ 현재 145개. 분포: speed 23 / brain 23 / math 28 / knowledge 30 / coop 20 / puzzle 22

## 🚫 사용자 삭제 29차 (재추가 금지)
직전 자동 추가분(2026-07-14) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- brain: carpet-duel(카펫 깔기 대결 — Domineering. 6×6 격자에서 P1은 빈 두 칸을 가로로, P2는 세로로 이어 1×2 카펫(도미노)을 번갈아 놓고, 자기 차례에 더 놓을 자리가 없는 사람이 지는 2인 배치 전략)

⚠️ **일반화:** "1×2 조각(카펫/도미노)을 격자에 번갈아 놓다 못 놓으면 지는" 배치형 조합게임(Domineering·Cram류) 및 그 회전/색 변형 전반이 이 축으로 보고 재추가 금지. `col-duel`(Col — 인접 제약 하에 번갈아 칠하다 못 두면 짐)도 같은 "번갈아 배치→못 두면 짐" 계열이므로 풀에서 재대조·신중.

비고: 같은 날 자동 추가한 우리 명절(holiday-quiz)·수 읽기(read-number)·몇째일까(ordinal-tap)는 유지.
→ 현재 144개. 분포: speed 23 / brain 22 / math 30 / knowledge 31 / coop 20 / puzzle 22

## 🚫 사용자 삭제 30차 (재추가 금지)
직전 자동 추가분(2026-07-15) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- brain: heavy-order(무거운 순서 — 저울로 잰 무게 힌트 A>B·B>C·C>D 를 이어 가장 무거운/가벼운 것을 고르는 이행추론)
- brain: fruit-code(과일 암호 — 과일마다 숨은 숫자를 대입해 식을 계산하는 대입/치환 연산)

⚠️ **일반화:** "여러 비교 힌트(무게·키·개수·나이 등 A>B>C)를 이어 가장 큰/작은 것을 고르는" 이행추론(transitive ordering) 계열, 그리고 "그림·기호=숫자 대입 후 식을 계산"하는 치환 연산(fruit/emoji algebra) 계열 전반이 이 축으로 보고 재추가 금지.

비고: 같은 날 자동 추가한 대칭 무늬 찾기(symmetry-find, puzzle)·점 세어 콕(dot-match, speed)은 유지.
→ 현재 151개. 분포: speed 24 / brain 23 / math 30 / knowledge 31 / coop 20 / puzzle 23

## 🚫 사용자 삭제 31차 (재추가 금지)
2026-07-15 대량 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- math: shape-name(무슨 도형? — 평면도형 그림을 보고 이름(원·삼각형·사각형·오각형·마름모 등)을 4지선다로 고르는 도형 이름 맞히기)

⚠️ **일반화:** "도형 그림을 보고 이름을 4지선다로 고르는" 도형 명칭 식별 계열(평면·입체 공통)은 이 축으로 보고 재추가 금지.

비고: 같은 날 추가한 지식 퀴즈(무슨 탈것?·무슨 먹거리?·무슨 식물?·위인 퀴즈·바다 친구·무슨 우리 음식?·무슨 동물?·무슨 곤충?·무슨 날씨?·우리나라 어디?·우리 문화·세계 위인)는 유지.

## 🚫 사용자 삭제 32차 (재추가 금지)
2026-07-15 추가분 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- knowledge: food-world(무슨 음식? — 세계 요리 이모지(🍕🍔🍣 등)를 보고 이름을 맞히는 그림 퀴즈)

⚠️ **비고:** food-name(과일채소 그림)·korean-food(한식 설명)·drink-snack(음료·간식 그림)은 유지. "요리 이모지 → 이름" 세계 음식 그림 퀴즈만 제외(음식 그림 퀴즈가 이미 여럿이라 중복 회피).

## 🚫 사용자 삭제 33차 (재추가 금지)
직전 자동 추가분(2026-07-17) 중 3종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- knowledge: body-part-quiz(무슨 몸의 부분? — 몸 부위 이모지(👀눈·👂귀·🦷이·🧠뇌 등)를 보고 이름을 맞히는 그림 퀴즈)
- knowledge: feeling-quiz(무슨 기분? — 표정 이모지(😄😢😡😨 등)를 보고 감정 이름을 맞히는 그림 퀴즈. 표정→감정 인식 계열 전반이 이 축)
- knowledge: kitchen-tool(무슨 주방 도구? — 조리도구·식기 이모지(🥄🍳🔪🫕 등)를 보고 이름을 맞히는 그림 퀴즈)

⚠️ **비고:** 같은 날 추가한 tech-device(무슨 기기? — 디지털 기기 그림 퀴즈)는 유지. "이모지 그림 → 이름" 그림 낱말 퀴즈가 이미 여럿(탈것·먹거리·동물·문구·도구·가전 등)이라 몸 부위·감정·주방도구 소재는 중복/저효용으로 제외.

## 🚫 사용자 삭제 34차 (재추가 금지)
직전 자동 추가분(2026-07-19) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- knowledge: gesture-quiz(무슨 손짓? — 손짓 이모지(👍👎👌✌️🤝 등)를 보고 뜻을 맞히는 그림 퀴즈. "이모지 손짓 → 뜻" 손짓 인식 계열 전반이 이 축)

⚠️ **비고:** 같은 날 추가한 economy-quiz(경제 퀴즈)·manner-quiz(예절 퀴즈)·landform-quiz(무슨 지형?) 설명형 퀴즈는 유지. "이모지 그림 → 이름/뜻" 그림 낱말 퀴즈가 이미 포화라 손짓 소재는 중복/저효용으로 제외.

## 🚫 사용자 삭제 35차 (재추가 금지)
직전 자동 추가분(2026-07-19, 200개 강행분) 중 2종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- knowledge: direction-quiz(방향 퀴즈 — 동서남북·상하좌우·앞뒤 등 방향과 위치를 4지선다로 맞히는 방향/위치 상식)
- knowledge: zodiac-quiz(무슨 띠? — 십이지 띠 동물의 순서(쥐·소·호랑이…)를 4지선다로 맞히는 십이지 순서 상식. 동물 소재 중복성으로 제외)

⚠️ **비고:** 같은 날 추가한 나머지(우리 문화재·식물의 부분·오감 퀴즈·무슨 날?·무슨 대륙?·문장부호 퀴즈·물의 상태·평균 구하기·곱셈 척척·무지개 퀴즈)는 유지. 우리 문화재(heritage-quiz)는 아이콘을 🏯(일본 성 인상)→🔭(첨성대=별 관측대)로 교체.

## 🚫 사용자 삭제 36차 (재추가 금지)
직전 자동 추가분(2026-07-19) 중 1종 삭제 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- knowledge: material-quiz(무슨 재료? — 물체가 무슨 재료(유리·나무·철·종이·천·플라스틱 등)로 만들어졌는지 4지선다로 맞히는 물질/재료 상식)

⚠️ **비고:** 같은 날 추가한 province-quiz(무슨 도?)·vertex-quiz(변과 꼭짓점)는 유지. province-quiz(무슨 도?)는 아이콘을 🗺️(세계지도)→🇰🇷(우리나라 상징)로 교체(우리나라 지형 모양 이모지는 유니코드에 없음).

> ⚠️ 자동 추가 루틴(`docs/AUTO_MODE.md`)은 이 문서의 1·2·3·4·5·6·7·8·9·10·11·12·13·14·15·16·17·18·19·20·21·22·23·24·25·26·27·28·29·30·31·32·33·34·35·36차 삭제 목록 + `GAME_ANTIPATTERNS.md` 0절을
> 후보 제외(avoid) 기준으로 읽는다. 게임을 삭제하면 여기에 반드시 기록할 것 — 누락 시 루틴이 재생성한다.
