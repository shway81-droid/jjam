/* games/peg-jump/game.js — 콩콩 점프 (페그 솔리테어 병렬 경쟁)
   패턴 D(퍼즐 병렬 경쟁) — slide-puzzle 골든 템플릿 구조를 따름.
   각 플레이어는 동일한 시작 보드를 자기 zone에서 풀고, 먼저 한 알로 줄이면 라운드 승.
   보드는 역방향 점프로 생성되어 반드시 1알까지 풀 수 있음(데드엔드 좌절 방지). */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 90;        // seconds (퍼즐 풀이라 넉넉)
const RESULT_PAUSE_MS = getAutoplayPauseMs(2400);

// 보드: 5×5 격자 위의 십자(plus) 모양 — 네 모서리 2×2 블록 제거(=21칸)
const BOARD_SIZE = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE; // 25
// 라운드별 역점프 횟수(=시작 콩 수 - 1). 점증 난이도.
const ROUND_REVERSE_MOVES = [4, 5, 6];

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 셀 상태값
const VOID = -1;  // 보드 밖(구멍 없음)
const EMPTY = 0;  // 빈 구멍
const PEG = 1;    // 콩

// 십자 마스크: 모서리 2×2 제외한 칸만 유효(구멍 존재)
function isOnBoard(r, c) {
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
  const cornerR = (r < 2 || r > 2);
  const cornerC = (c < 2 || c > 2);
  // 양쪽 다 가장자리(0,1 또는 3,4)면 모서리 2×2 블록 → 보드 밖
  return !(cornerR && cornerC);
}
const ON_BOARD = []; // idx -> bool
for (let i = 0; i < CELL_COUNT; i++) {
  ON_BOARD.push(isOnBoard(Math.floor(i / BOARD_SIZE), i % BOARD_SIZE));
}
const CENTER_IDX = 2 * BOARD_SIZE + 2; // (2,2)

const DIRS = [
  { dr: -1, dc: 0 }, // 위
  { dr: 1, dc: 0 },  // 아래
  { dr: 0, dc: -1 }, // 왼쪽
  { dr: 0, dc: 1 },  // 오른쪽
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  hop(ctx) {
    // 콩이 톡 뛰어넘는 소리 (짧은 상승 블립)
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(380, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.16);
  },
  wrong(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.2);
  },
  // win(라운드 클리어) / tick / timeout / fanfare 는 DEFAULT_SOUNDS 활용
  win(ctx) {
    [659, 784, 988, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.08;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];                 // round wins per player
let roundResults = [];           // [{winnerIdx, timedOut}]
let zoneBoards = [];             // 각 플레이어의 현재 보드(길이 25 배열)
let zonePegs = [];               // 각 플레이어 남은 콩 수
let zoneSelected = [];           // 각 플레이어 선택된 콩 idx (없으면 -1)
let zoneSolved = [];             // boolean
let startBoardForRound = null;   // 이번 라운드 모두가 공유하는 시작 보드
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;

// ── DOM refs ─────────────────────────────────────────────────
const introScreen = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn = document.getElementById('backBtn');
const playBtn = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');

const zonesWrap = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer = document.getElementById('problemTimer');
const problemStatus = document.getElementById('problemStatus');
const scoreBar = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle = document.getElementById('resultTitle');
const resultWinner = document.getElementById('resultWinner');
const totalRow = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; }
}

// ── Peg-solitaire pure helpers ───────────────────────────────
function idxOf(r, c) { return r * BOARD_SIZE + c; }

function countPegs(board) {
  let n = 0;
  for (let i = 0; i < board.length; i++) if (board[i] === PEG) n++;
  return n;
}

// 전방 점프 합법성: from(콩)이 dir 방향으로 over(콩)를 넘어 land(빈칸)로 이동.
// 반환: 합법이면 { over, land }, 아니면 null.
function forwardJump(board, fromIdx, dir) {
  const r = Math.floor(fromIdx / BOARD_SIZE), c = fromIdx % BOARD_SIZE;
  const or = r + dir.dr, oc = c + dir.dc;       // 넘는 콩
  const lr = r + dir.dr * 2, lc = c + dir.dc * 2; // 착지 칸
  if (!isOnBoard(or, oc) || !isOnBoard(lr, lc)) return null;
  const overIdx = idxOf(or, oc), landIdx = idxOf(lr, lc);
  if (board[fromIdx] !== PEG) return null;
  if (board[overIdx] !== PEG) return null;
  if (board[landIdx] !== EMPTY) return null;
  return { over: overIdx, land: landIdx };
}

// 한 콩이 갈 수 있는 모든 착지 칸 목록 (합법 이동만)
function legalTargetsFor(board, fromIdx) {
  const targets = [];
  for (const dir of DIRS) {
    const mv = forwardJump(board, fromIdx, dir);
    if (mv) targets.push(mv);  // { over, land }
  }
  return targets;
}

// 보드에 합법 이동이 하나라도 있는가
function hasAnyMove(board) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== PEG) continue;
    for (const dir of DIRS) {
      if (forwardJump(board, i, dir)) return true;
    }
  }
  return false;
}

// 역방향 생성: 콩 1개에서 시작해 reverseMoves번 역점프.
// 역점프: 콩 P가 dir 방향으로 두 칸 뒤로 물러나며(P가 왔던 자리로 복귀),
//   사이 칸(over)에 콩을 새로 채움 = 전방 점프의 정확한 역연산.
//   조건: over와 land(=P-2칸)가 둘 다 보드 위 + 비어 있어야 함.
function generateBoard(reverseMoves) {
  const board = new Array(CELL_COUNT).fill(VOID);
  for (let i = 0; i < CELL_COUNT; i++) if (ON_BOARD[i]) board[i] = EMPTY;
  board[CENTER_IDX] = PEG; // 중앙 한 알에서 시작

  let placed = 0;
  let guard = 0;
  while (placed < reverseMoves && guard < 4000) {
    guard++;
    // 현재 콩들 중 무작위 하나 선택
    const pegs = [];
    for (let i = 0; i < CELL_COUNT; i++) if (board[i] === PEG) pegs.push(i);
    const fromIdx = pegs[Math.floor(Math.random() * pegs.length)];
    const r = Math.floor(fromIdx / BOARD_SIZE), c = fromIdx % BOARD_SIZE;
    // 방향 무작위
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const or = r + dir.dr, oc = c + dir.dc;        // 새로 채울 사이 콩
    const lr = r + dir.dr * 2, lc = c + dir.dc * 2; // P가 물러날 자리
    if (!isOnBoard(or, oc) || !isOnBoard(lr, lc)) continue;
    const overIdx = idxOf(or, oc), landIdx = idxOf(lr, lc);
    if (board[overIdx] !== EMPTY || board[landIdx] !== EMPTY) continue;
    // 역점프 실행
    board[fromIdx] = EMPTY;
    board[overIdx] = PEG;
    board[landIdx] = PEG;
    placed++;
  }

  // 안전장치: 역점프가 충분히 안 됐거나(극히 드묾) 이미 풀린 상태면 재시도
  if (countPegs(board) < 2 || !hasAnyMove(board)) {
    return generateBoard(reverseMoves);
  }
  return board;
}

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-pegs" id="pegs-${i}">콩 0</span>
      <button class="zone-redo" id="redo-${i}" type="button">다시</button>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'peg-board';
    board.id = `peg-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);

    const redoBtn = header.querySelector(`#redo-${i}`);
    onTap(redoBtn, () => handleRedo(i));
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const boardEl = document.getElementById(`peg-board-${playerIdx}`);
  if (!boardEl) return;
  const board = zoneBoards[playerIdx];
  const selected = zoneSelected[playerIdx];
  // 선택된 콩이 있으면 그 콩의 합법 착지 칸 집합
  let targetLands = [];
  if (selected >= 0) {
    targetLands = legalTargetsFor(board, selected).map(m => m.land);
  }

  boardEl.innerHTML = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'peg-cell';
    if (board[i] === VOID) {
      cell.classList.add('void');
      boardEl.appendChild(cell);
      continue;
    }
    const hole = document.createElement('div');
    hole.className = 'peg-hole';
    if (board[i] === PEG) cell.classList.add('filled');
    else cell.classList.add('empty');
    if (i === selected) cell.classList.add('selected');
    if (targetLands.indexOf(i) !== -1) cell.classList.add('target');
    cell.appendChild(hole);

    const cellIdx = i;
    onTap(hole, () => handleTap(playerIdx, cellIdx));
    boardEl.appendChild(cell);
  }
}

function updatePegsChip(playerIdx) {
  const el = document.getElementById(`pegs-${playerIdx}`);
  if (el) el.textContent = `콩 ${zonePegs[playerIdx]}`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Tap handler (two-tap: 콩 선택 → 목표 빈 칸 선택) ──────────
function handleTap(playerIdx, cellIdx) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const board = zoneBoards[playerIdx];
  const selected = zoneSelected[playerIdx];

  // 1) 콩을 탭한 경우
  if (board[cellIdx] === PEG) {
    if (cellIdx === selected) {
      // 같은 콩 다시 탭 → 선택 해제
      zoneSelected[playerIdx] = -1;
    } else {
      // 새 콩 선택 (합법 이동 있을 때만 강조 의미가 있지만, 선택 자체는 허용)
      zoneSelected[playerIdx] = cellIdx;
    }
    renderBoard(playerIdx);
    return;
  }

  // 2) 빈 칸을 탭한 경우
  if (board[cellIdx] === EMPTY) {
    if (selected < 0) return; // 선택된 콩 없음 → 무시
    // 선택된 콩에서 이 빈 칸이 합법 착지인지 확인
    const targets = legalTargetsFor(board, selected);
    const mv = targets.find(m => m.land === cellIdx);
    if (!mv) {
      // 합법 착지가 아님 → 오답음 + 선택 해제
      sound.play('wrong');
      zoneSelected[playerIdx] = -1;
      renderBoard(playerIdx);
      return;
    }
    // 점프 실행: 콩 이동 + 사이 콩 제거
    board[selected] = EMPTY;
    board[mv.over] = EMPTY;
    board[cellIdx] = PEG;
    zonePegs[playerIdx] = countPegs(board);
    zoneSelected[playerIdx] = -1;
    sound.play('hop');

    renderBoard(playerIdx);
    updatePegsChip(playerIdx);

    // 클리어 체크 (콩 1개)
    if (zonePegs[playerIdx] === 1) {
      handleSolve(playerIdx);
      return;
    }
    // 데드엔드 안내 (점수에는 영향 없음 — '다시'로 재시도)
    if (!hasAnyMove(board)) {
      const zone = getZone(playerIdx);
      if (zone) zone.classList.add('stuck');
      flashStatus(`${PLAYER_CONFIG[playerIdx].label} 막혔어요! '다시'를 눌러 재도전!`);
    }
    return;
  }
}

let statusResetHandle = null;
function flashStatus(msg) {
  problemStatus.textContent = msg;
  if (statusResetHandle) clearTimeout(statusResetHandle);
  statusResetHandle = setTimeout(() => {
    if (phase === 'active') problemStatus.textContent = '콩을 뛰어넘어 한 알만 남기세요!';
  }, 1800);
}

// '다시' — 이 플레이어의 보드를 이번 라운드 시작 상태로 복구
function handleRedo(playerIdx) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;
  zoneBoards[playerIdx] = startBoardForRound.slice();
  zonePegs[playerIdx] = countPegs(zoneBoards[playerIdx]);
  zoneSelected[playerIdx] = -1;
  const zone = getZone(playerIdx);
  if (zone) zone.classList.remove('stuck');
  renderBoard(playerIdx);
  updatePegsChip(playerIdx);
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  if (zone) zone.classList.add('solved');

  // 첫 번째로 클리어한 사람이 라운드 승
  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('win');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    // 나머지 zone freeze
    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneSolved[i]) {
        const z = getZone(i);
        if (z) z.classList.add('locked');
      }
    }

    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

// ── Timer ────────────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 5) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    if (!zoneSolved[i]) {
      const z = getZone(i);
      if (z) z.classList.add('locked');
    }
  }

  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = '시간 초과! 아무도 못 풀었어요';

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';

  // 모두에게 동일한, 풀 수 있도록 보장된 시작 보드
  const reverseMoves = ROUND_REVERSE_MOVES[roundIdx] || ROUND_REVERSE_MOVES[ROUND_REVERSE_MOVES.length - 1];
  startBoardForRound = generateBoard(reverseMoves);

  zoneBoards = [];
  zonePegs = [];
  zoneSelected = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zoneBoards.push(startBoardForRound.slice());
    zonePegs.push(countPegs(startBoardForRound));
    zoneSelected.push(-1);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked', 'stuck');
    renderBoard(i);
    updatePegsChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '콩을 뛰어넘어 한 알만 남기세요!';

  startCountdown();
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

function startGame() {
  roundIdx = 0;
  scores = new Array(playerCount).fill(0);
  roundResults = [];
  phase = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent = '무승부!';
    resultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 우승! (${maxScore}승)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}승)`;
  }

  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
