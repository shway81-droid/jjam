/* games/domino-fill/game.js — 패턴 C (퍼즐 병렬 경쟁) — 도미노 채우기
 *
 * 메커니즘: 같은 격자판을 여러 플레이어에게 주고, 1×2 도미노로 빈틈없이 덮는 경쟁.
 *  - 모든 플레이어는 동일한 빈 격자(빈칸 수 짝수 → 항상 완전 덮기 해 존재)를 받는다(공정).
 *  - 빈 칸을 클릭하면 "선택" 상태가 된다. 인접한 빈 칸을 이어서 클릭하면 두 칸이
 *    하나의 1×2 도미노로 묶인다(가로/세로). 같은 칸을 다시 누르면 선택 취소.
 *    비인접 빈 칸을 누르면 선택이 그 칸으로 옮겨간다.
 *  - 이미 놓인 도미노 칸을 누르면 그 도미노를 제거한다(되돌리기).
 *  - 모든 칸을 도미노로 덮으면 완성. 가장 먼저 채운 사람이 라운드 승.
 *  - 라운드가 진행될수록 격자가 커진다(난이도 점증).
 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 격자 크기 [rows, cols] — 짝수 칸(완전 도미노 덮기 가능) · 난이도 점증
const ROUND_GRIDS = [
  [4, 4],   // 16칸 · 8 도미노
  [4, 6],   // 24칸 · 12 도미노
  [6, 6],   // 36칸 · 18 도미노
];

// 도미노 색 (파스텔, 순서대로 순환 배정)
const DOMINO_COLORS = [
  '#90CAF9', '#A5D6A7', '#FFCC80', '#EF9A9A',
  '#CE93D8', '#80DEEA', '#FFAB91', '#C5E1A5',
  '#F48FB1', '#B0BEC5', '#9FA8DA', '#FFE082',
  '#80CBC4', '#BCAAA4', '#E6EE9C', '#F8BBD0',
  '#B39DDB', '#FFAB40',
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
    o.frequency.setValueAtTime(330, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  lift(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.09);
  },
  pick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.24);
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

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];                 // round wins per player
let roundResults = [];           // [{winnerIdx, timedOut}]
let rows = 4, cols = 4;          // 현재 라운드 격자 크기
let zoneGrid = [];               // each player's rows×cols grid (dominoId | null)
let zoneSel = [];                // each player's selected empty cell {r,c} or null
let zoneNextId = [];             // each player's next domino id (색 순환·식별용)
let zoneSolved = [];             // boolean
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let statusTimer = null;

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

const DEFAULT_STATUS = '빈 칸 두 개를 골라 도미노를 놓으세요!';

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
  if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
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
      <span class="zone-moves" id="left-${i}">남은 0</span>
    `;
    zone.appendChild(header);

    const area = document.createElement('div');
    area.className = 'pf-area';
    area.id = `pf-area-${i}`;

    const board = document.createElement('div');
    board.className = 'pf-board';
    board.id = `pf-board-${i}`;
    area.appendChild(board);

    zone.appendChild(area);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── Render ───────────────────────────────────────────────────
// 도미노의 인접 짝 칸 방향에 따라 두 칸을 한 덩어리로 보이게 모서리를 둥글게 처리.
function dominoSideClass(grid, r, c, id) {
  // 같은 id를 가진 인접 칸의 방향을 찾는다(도미노는 정확히 2칸).
  if (r > 0 && grid[r - 1][c] === id) return 'd-down';   // 위쪽이 짝 → 이 칸은 아래쪽
  if (r < rows - 1 && grid[r + 1][c] === id) return 'd-up';   // 아래쪽이 짝 → 이 칸은 위쪽
  if (c > 0 && grid[r][c - 1] === id) return 'd-right'; // 왼쪽이 짝 → 이 칸은 오른쪽
  if (c < cols - 1 && grid[r][c + 1] === id) return 'd-left';  // 오른쪽이 짝 → 이 칸은 왼쪽
  return '';
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`pf-board-${playerIdx}`);
  if (!board) return;
  const grid = zoneGrid[playerIdx];
  const sel = zoneSel[playerIdx];
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const id = grid[r][c];
      const isSel = sel && sel.r === r && sel.c === c;
      let cls = 'pf-cell' + (id === null ? ' empty' : ' filled') + (isSel ? ' sel' : '');
      if (id !== null) {
        const side = dominoSideClass(grid, r, c, id);
        if (side) cls += ' ' + side;
      }
      cell.className = cls;
      if (id !== null) cell.style.background = DOMINO_COLORS[id % DOMINO_COLORS.length];
      cell.dataset.r = r;
      cell.dataset.c = c;
      onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function countEmpty(playerIdx) {
  const grid = zoneGrid[playerIdx];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) n++;
    }
  }
  return n;
}

function updateLeftChip(playerIdx) {
  const el = document.getElementById(`left-${playerIdx}`);
  if (el) el.textContent = `남은 ${countEmpty(playerIdx)}`;
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

// ── Interaction ──────────────────────────────────────────────
function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc) === 1;
}

function handleCellTap(playerIdx, r, c) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const grid = zoneGrid[playerIdx];
  const occupant = grid[r][c];

  // 이미 놓인 도미노 칸 → 제거(되돌리기)
  if (occupant !== null) {
    liftDomino(playerIdx, occupant);
    return;
  }

  // 빈 칸 클릭
  const sel = zoneSel[playerIdx];
  if (!sel) {
    // 첫 칸 선택
    zoneSel[playerIdx] = { r, c };
    sound.play('pick');
    renderBoard(playerIdx);
    return;
  }
  if (sel.r === r && sel.c === c) {
    // 같은 칸 재클릭 → 선택 취소
    zoneSel[playerIdx] = null;
    sound.play('lift');
    renderBoard(playerIdx);
    return;
  }
  if (isAdjacent(sel, { r, c })) {
    // 인접한 빈 칸 → 도미노 배치
    placeDomino(playerIdx, sel, { r, c });
    return;
  }
  // 비인접 빈 칸 → 선택을 그 칸으로 이동
  zoneSel[playerIdx] = { r, c };
  sound.play('pick');
  renderBoard(playerIdx);
}

function placeDomino(playerIdx, a, b) {
  const grid = zoneGrid[playerIdx];
  // 두 칸 모두 비어 있어야 함(방어적; 호출부에서 보장됨)
  if (grid[a.r][a.c] !== null || grid[b.r][b.c] !== null) {
    zoneSel[playerIdx] = null;
    renderBoard(playerIdx);
    return;
  }
  const id = zoneNextId[playerIdx]++;
  grid[a.r][a.c] = id;
  grid[b.r][b.c] = id;
  zoneSel[playerIdx] = null;
  sound.play('place');

  renderBoard(playerIdx);
  updateLeftChip(playerIdx);

  if (isSolved(playerIdx)) handleSolve(playerIdx);
}

function liftDomino(playerIdx, dominoId) {
  const grid = zoneGrid[playerIdx];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === dominoId) grid[r][c] = null;
    }
  }
  zoneSel[playerIdx] = null;
  sound.play('lift');

  renderBoard(playerIdx);
  updateLeftChip(playerIdx);
}

function isSolved(playerIdx) {
  return countEmpty(playerIdx) === 0;
}

function flashStatus(msg) {
  problemStatus.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (phase === 'active') problemStatus.textContent = DEFAULT_STATUS;
  }, 900);
}

// ── Solve / round flow ───────────────────────────────────────
function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  zone.classList.add('solved');

  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    }

    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

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

  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  rows = ROUND_GRIDS[roundIdx][0];
  cols = ROUND_GRIDS[roundIdx][1];

  zoneGrid = [];
  zoneSel = [];
  zoneNextId = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zoneGrid.push(Array.from({ length: rows }, () => new Array(cols).fill(null)));
    zoneSel.push(null);
    zoneNextId.push(0);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateLeftChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = DEFAULT_STATUS;

  startCountdown();
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) showResult();
  else loadRound();
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
