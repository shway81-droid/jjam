/* games/neighbor-color/game.js — 패턴 C (퍼즐 병렬 경쟁) — 이웃 다른 색 (격자 색칠 퍼즐) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 보드: rows × cols, clue = 미리 칠해진 칸 비율 (난이도 점증)
const ROUND_DEF = [
  { rows: 3, cols: 4, clue: 0.45 },
  { rows: 4, cols: 4, clue: 0.42 },
  { rows: 4, cols: 5, clue: 0.40 },
];

// 4색 팔레트 (상태 1..4). 상태 0 = 빈칸.
const PALETTE = [
  { id: 1, fill: '#EF9A9A', name: '빨강' },
  { id: 2, fill: '#90CAF9', name: '파랑' },
  { id: 3, fill: '#A5D6A7', name: '초록' },
  { id: 4, fill: '#FFE082', name: '노랑' },
];

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    });
  },
  place(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  undo(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

// ── Pure puzzle generator + validator (테스트 가능, DOM 비의존) ──
// board[r][c] = 0(빈칸) | 1..4(색). 규칙: 8방향(킹) 인접 칸끼리 같은 색 금지.
// 4색은 킹-인접 격자를 항상 칠할 수 있음(채색수=4). 패리티 패턴으로 기준해 생성.
function randInt(n) { return Math.floor(Math.random() * n); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

const KING_DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],          [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// 패리티 기반 유효 4색 해 + 라벨 무작위 치환.
function buildBaseSolution(rows, cols) {
  const perm = shuffle([1, 2, 3, 4]);
  const sol = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const idx = (r % 2) * 2 + (c % 2);   // 0..3
      row.push(perm[idx]);
    }
    sol.push(row);
  }
  return sol;
}

// 퍼즐 생성: 유효 해를 만든 뒤 일부만 단서로 공개, 나머지는 빈칸.
//   반환 { rows, cols, clueMask[r][c]: bool, board[r][c]: 0|색 }
function generatePuzzle(def) {
  const { rows, cols, clue } = def;
  const sol = buildBaseSolution(rows, cols);
  const total = rows * cols;

  let clueMask, board, clueCount;
  let guard = 0;
  do {
    clueMask = [];
    board = [];
    clueCount = 0;
    for (let r = 0; r < rows; r++) {
      const mrow = [];
      const brow = [];
      for (let c = 0; c < cols; c++) {
        const isClue = Math.random() < clue;
        mrow.push(isClue);
        if (isClue) { brow.push(sol[r][c]); clueCount++; }
        else { brow.push(0); }
      }
      clueMask.push(mrow);
      board.push(brow);
    }
    guard++;
  } while ((clueCount < 2 || clueCount > total - 2) && guard < 200);

  return { rows, cols, clueMask, board };
}

// 한 칸이 8방향 이웃과 색 충돌하는지.
function cellConflicts(board, rows, cols, r, c) {
  const v = board[r][c];
  if (v === 0) return false;
  for (const [dr, dc] of KING_DIRS) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    if (board[nr][nc] === v) return true;
  }
  return false;
}

// 완성 판정: 모든 칸이 칠해졌고(0 없음) 충돌이 하나도 없으면 true.
function isComplete(puzzle, board) {
  const { rows, cols } = puzzle;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 0) return false;
      if (cellConflicts(board, rows, cols, r, c)) return false;
    }
  }
  return true;
}

// 남은(빈칸 + 충돌칸) 수 — 진행 표시용.
function remainingCount(puzzle, board) {
  const { rows, cols } = puzzle;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 0 || cellConflicts(board, rows, cols, r, c)) n++;
    }
  }
  return n;
}

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];
let curDef = null;
let curPuzzle = null;        // 라운드 공통 퍼즐(모든 zone 복제)
let zoneBoard = [];          // 각 플레이어의 현재 board (값 배열)
let zoneBrush = [];          // 각 플레이어가 선택한 색(1..4)
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let roundDecided = false;

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
      <span class="zone-next" id="next-${i}">남은 0</span>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'nc-board';
    board.id = `nc-board-${i}`;
    zone.appendChild(board);

    // 색 팔레트
    const pal = document.createElement('div');
    pal.className = 'nc-palette';
    pal.id = `nc-pal-${i}`;
    PALETTE.forEach(col => {
      const sw = document.createElement('button');
      sw.className = 'nc-swatch';
      sw.dataset.player = i;
      sw.dataset.color = col.id;
      sw.style.background = col.fill;
      sw.setAttribute('aria-label', PLAYER_CONFIG[i].label + ' ' + col.name);
      onTap(sw, () => selectBrush(i, col.id));
      pal.appendChild(sw);
    });
    zone.appendChild(pal);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function selectBrush(playerIdx, colorId) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zoneBrush[playerIdx] = colorId;
  sound.play('place');
  renderPalette(playerIdx);
}

function renderPalette(playerIdx) {
  const pal = document.getElementById(`nc-pal-${playerIdx}`);
  if (!pal) return;
  const brush = zoneBrush[playerIdx];
  Array.from(pal.querySelectorAll('.nc-swatch')).forEach(sw => {
    sw.classList.toggle('selected', Number(sw.dataset.color) === brush);
  });
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`nc-board-${playerIdx}`);
  if (!board) return;
  const p = curPuzzle;
  const vals = zoneBoard[playerIdx];

  board.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
  board.style.setProperty('--nc-cols', p.cols);
  board.style.setProperty('--nc-rows', p.rows);
  board.innerHTML = '';

  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const cell = document.createElement('div');
      const v = vals[r][c];
      const isClue = p.clueMask[r][c];
      let cls = 'nc-cell' + (v === 0 ? ' blank' : '');
      if (isClue) cls += ' clue';
      else cls += ' editable';
      if (v !== 0 && cellConflicts(vals, p.rows, p.cols, r, c)) cls += ' bad';
      cell.className = cls;
      if (v !== 0) cell.style.background = PALETTE[v - 1].fill;
      cell.dataset.player = playerIdx;
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (!isClue) onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function updateNextChip(playerIdx) {
  const el = document.getElementById(`next-${playerIdx}`);
  if (!el) return;
  const rem = remainingCount(curPuzzle, zoneBoard[playerIdx]);
  el.textContent = rem === 0 ? '완성!' : `남은 ${rem}`;
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

// ── Cell tap handler ─────────────────────────────────────────
function handleCellTap(playerIdx, r, c) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const vals = zoneBoard[playerIdx];
  const brush = zoneBrush[playerIdx];
  // 같은 색을 다시 탭하면 지우기(빈칸), 아니면 선택색으로 칠하기
  if (vals[r][c] === brush) {
    vals[r][c] = 0;
    sound.play('undo');
  } else {
    vals[r][c] = brush;
    sound.play('place');
  }
  renderBoard(playerIdx);
  updateNextChip(playerIdx);

  if (isComplete(curPuzzle, vals)) {
    handleSolve(playerIdx);
  }
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  zone.classList.add('solved');

  if (!roundDecided) {
    roundDecided = true;
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneSolved[i]) {
        getZone(i).classList.add('locked');
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
    if (!zoneSolved[i]) getZone(i).classList.add('locked');
  }

  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';
  roundDecided = false;
  curDef = ROUND_DEF[roundIdx];
  curPuzzle = generatePuzzle(curDef);

  zoneBoard = [];
  zoneBrush = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    // 단서를 포함한 board 복제
    const b = curPuzzle.board.map(row => row.slice());
    zoneBoard.push(b);
    zoneBrush.push(1);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    renderPalette(i);
    updateNextChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `이웃(8방향)과 다른 색으로 모두 칠하세요!`;

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

// ── Test hook (Node 환경에서만 export; 브라우저 무영향) ─────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildBaseSolution, generatePuzzle, cellConflicts, isComplete, remainingCount,
  };
}
