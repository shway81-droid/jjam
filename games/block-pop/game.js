/* games/block-pop/game.js — 패턴 C (퍼즐 병렬 경쟁) — 뭉치 터트리기 (SameGame형) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const GAME_TIME = 45;         // seconds
const RESULT_PAUSE_MS = (typeof getAutoplayPauseMs === 'function') ? getAutoplayPauseMs(1800) : 1800;
const NUM_COLORS = 3;

// 색 팔레트 (상태 1..NUM_COLORS, 0 = 빈칸)
const PALETTE = {
  1: '#F06292', // 분홍
  2: '#4FC3F7', // 파랑
  3: '#AED581', // 연두
};

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

function boardDims(pc) {
  if (pc <= 2) return { cols: 6, rows: 9 };
  if (pc === 3) return { cols: 5, rows: 9 };
  return { cols: 4, rows: 9 };
}

// ── Pure SameGame logic (DOM 비의존 — Node 테스트 가능) ─────────
function randInt(n) { return Math.floor(Math.random() * n); }

function makeGrid(rows, cols) {
  const g = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(1 + randInt(NUM_COLORS));
    g.push(row);
  }
  return g;
}

// (r,c)와 4방향으로 이어진 같은 색 뭉치 좌표 목록
function floodGroup(grid, sr, sc) {
  const rows = grid.length, cols = grid[0].length;
  const color = grid[sr][sc];
  if (!color) return [];
  const seen = new Set();
  const stack = [[sr, sc]];
  const out = [];
  seen.add(sr + ',' + sc);
  while (stack.length) {
    const [r, c] = stack.pop();
    out.push([r, c]);
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const key = nr + ',' + nc;
      if (seen.has(key)) continue;
      if (grid[nr][nc] === color) { seen.add(key); stack.push([nr, nc]); }
    }
  }
  return out;
}

// 각 열에서 블록을 아래로 내림(중력)
function applyGravity(grid) {
  const rows = grid.length, cols = grid[0].length;
  for (let c = 0; c < cols; c++) {
    const stackVals = [];
    for (let r = 0; r < rows; r++) if (grid[r][c] !== 0) stackVals.push(grid[r][c]);
    const empty = rows - stackVals.length;
    for (let r = 0; r < rows; r++) grid[r][c] = (r < empty) ? 0 : stackVals[r - empty];
  }
}

// 완전히 빈 열 제거 후 왼쪽으로 붙이기 (오른쪽에 빈 열)
function collapseColumns(grid) {
  const rows = grid.length, cols = grid[0].length;
  const keep = [];
  for (let c = 0; c < cols; c++) {
    let any = false;
    for (let r = 0; r < rows; r++) if (grid[r][c] !== 0) { any = true; break; }
    if (any) keep.push(c);
  }
  for (let r = 0; r < rows; r++) {
    const newRow = keep.map(c => grid[r][c]);
    while (newRow.length < cols) newRow.push(0);
    for (let c = 0; c < cols; c++) grid[r][c] = newRow[c];
  }
}

// 뭉치 터트리기: 성공하면 제거된 블록 수 반환, 실패(1개 이하)면 0
function popAt(grid, r, c) {
  const group = floodGroup(grid, r, c);
  if (group.length < 2) return 0;
  for (const [gr, gc] of group) grid[gr][gc] = 0;
  applyGravity(grid);
  collapseColumns(grid);
  return group.length;
}

function countRemaining(grid) {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== 0) n++;
  return n;
}

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  pop(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(360, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.09);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.14);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.16);
  },
  clear(ctx) {
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.start(t); o.stop(t + 0.34);
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
let dims = { cols: 6, rows: 9 };
let scores = [];            // 없앤 블록 수
let zoneGrid = [];          // 각 플레이어 격자
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = GAME_TIME;
let gameOver = false;
let clearedBy = -1;

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
      <span class="zone-next" id="removed-${i}">없앤 0</span>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'bp-board';
    board.id = `bp-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`bp-board-${playerIdx}`);
  if (!board) return;
  const grid = zoneGrid[playerIdx];
  const rows = dims.rows, cols = dims.cols;

  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  board.style.setProperty('--bp-cols', cols);
  board.style.setProperty('--bp-rows', rows);
  board.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const v = grid[r][c];
      cell.className = 'bp-cell' + (v === 0 ? ' empty' : '');
      if (v !== 0) cell.style.background = PALETTE[v];
      cell.dataset.player = playerIdx;
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (v !== 0) onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function updateRemovedChip(playerIdx) {
  const el = document.getElementById(`removed-${playerIdx}`);
  if (el) el.textContent = `없앤 ${scores[playerIdx]}`;
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
  if (phase !== 'active' || gameOver) return;

  const removed = popAt(zoneGrid[playerIdx], r, c);
  if (removed < 2) {
    sound.play('buzz');
    return;
  }

  scores[playerIdx] += removed;
  sound.play('pop');
  renderBoard(playerIdx);
  updateRemovedChip(playerIdx);
  updateBarScore(playerIdx);

  if (countRemaining(zoneGrid[playerIdx]) === 0) {
    handleClear(playerIdx);
  }
}

function handleClear(winnerIdx) {
  if (gameOver) return;
  gameOver = true;
  clearedBy = winnerIdx;
  phase = 'done';
  clearTimers();

  const zone = getZone(winnerIdx);
  if (zone) zone.classList.add('solved');
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) { const z = getZone(i); if (z) z.classList.add('locked'); }
  }

  sound.play('clear');
  problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 판을 다 비웠어요! 🎉`;
  nextHandle = setTimeout(() => showResult(), RESULT_PAUSE_MS);
}

// ── Timer ────────────────────────────────────────────────────
function startCountdown() {
  timeRemaining = GAME_TIME;
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
  gameOver = true;
  sound.play('timeout');
  for (let i = 0; i < playerCount; i++) { const z = getZone(i); if (z) z.classList.add('locked'); }
  problemStatus.textContent = `시간 종료! 가장 많이 없앤 사람은?`;
  nextHandle = setTimeout(() => showResult(), RESULT_PAUSE_MS);
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  dims = boardDims(playerCount);
  scores = new Array(playerCount).fill(0);
  zoneGrid = [];
  gameOver = false;
  clearedBy = -1;
  phase = 'active';

  clearTimers();
  buildZones();
  buildScoreBar();

  for (let i = 0; i < playerCount; i++) {
    zoneGrid.push(makeGrid(dims.rows, dims.cols));
    renderBoard(i);
    updateRemovedChip(i);
  }

  problemStatus.textContent = `붙어있는 같은 색 2개 이상을 톡!`;
  showScreen(gameScreen);
  startCountdown();
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  let winners;
  if (clearedBy >= 0) {
    winners = [clearedBy];
  } else {
    winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === maxScore).map(x => x.i);
  }

  if (maxScore === 0) {
    resultTitle.textContent = '무승부!';
    resultWinner.textContent = '아무도 블록을 없애지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    const extra = clearedBy === w ? ' · 판 비우기 성공!' : '';
    resultTitle.textContent = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 우승! (${scores[w]}개${extra})`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}개)`;
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
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}개</span>
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
  module.exports = { floodGroup, applyGravity, collapseColumns, popAt, countRemaining, makeGrid };
}
