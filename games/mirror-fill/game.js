/* games/mirror-fill/game.js — 패턴 C (퍼즐 병렬 경쟁) — 대칭 채우기
 *
 * 메커니즘: 격자를 좌우 대칭으로 만드는 경쟁.
 *  - 라운드마다 무작위 좌우 대칭 타깃 패턴을 만든다(대칭쌍을 같은 값으로 채워
 *    생성 → 항상 대칭 해가 존재). 모든 플레이어는 동일한 퍼즐을 받는다(공정).
 *  - 타깃의 채워진 칸 중 약 절반을 '씨앗'으로 골라 고정(locked)·미리 채움.
 *    나머지는 모두 빈칸으로 시작 → 보드는 비대칭으로 출발.
 *  - 빈 칸을 누르면 칠한다(filled). 칠한 칸을 다시 누르면 지운다.
 *  - 고정 칸(씨앗)은 누를 수 없다.
 *  - 격자가 완벽한 좌우 대칭이 되면 완성. 가장 먼저 맞춘 사람이 라운드 승.
 *  - 라운드가 진행될수록 격자가 커진다(난이도 점증).
 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 격자 크기 [rows, cols] — 짝수 열(가운데 대칭축이 칸 사이) · 난이도 점증
const ROUND_GRIDS = [
  [5, 6],
  [6, 6],
  [6, 8],
];

const FILL_PROB = 0.45;       // 타깃 칸이 채워질 확률

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
// 셀 상태: 0 = 빈칸(empty), 1 = 칠함(filled), 2 = 고정 씨앗(locked, 항상 채워짐)
let playerCount = 2;
let roundIdx = 0;
let scores = [];                 // round wins per player
let roundResults = [];           // [{winnerIdx, timedOut}]
let rows = 5, cols = 6;          // 현재 라운드 격자 크기
let zoneGrid = [];               // each player's rows×cols grid of cell states
let zoneSolved = [];             // boolean
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let statusTimer = null;

const DEFAULT_STATUS = '양쪽이 똑같아지게 칸을 칠하세요!';

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
  if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
}

// ── Puzzle generation ────────────────────────────────────────
// 좌우 대칭 타깃 패턴을 무작위 생성한 뒤, 채워진 칸의 약 절반을 고정 씨앗으로
// 골라 미리 채운다. 나머지는 빈칸으로 시작 → 보드는 비대칭으로 출발하고,
// 씨앗의 거울 짝을 채워야 대칭이 완성된다.
function generatePuzzle(r, c) {
  const half = c / 2; // 짝수 열 가정
  let target, filledCount;

  // 적당한 양의 채워진 칸이 나올 때까지 재생성
  for (let attempt = 0; attempt < 50; attempt++) {
    target = Array.from({ length: r }, () => new Array(c).fill(0));
    filledCount = 0;
    for (let rr = 0; rr < r; rr++) {
      for (let cc = 0; cc < half; cc++) {
        if (Math.random() < FILL_PROB) {
          target[rr][cc] = 1;
          target[rr][c - 1 - cc] = 1;
          filledCount += 2;
        }
      }
    }
    const total = r * c;
    // 너무 적거나(축구함) 너무 많지(거의 다 칠함) 않게
    if (filledCount >= Math.max(6, total * 0.25) && filledCount <= total * 0.7) break;
  }

  // 채워진 미러 쌍(왼쪽 절반 기준) 목록
  const pairs = [];
  for (let rr = 0; rr < r; rr++) {
    for (let cc = 0; cc < half; cc++) {
      if (target[rr][cc] === 1) pairs.push({ r: rr, c: cc });
    }
  }
  // 섞기
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  // 시작 격자: 모두 빈칸. 각 씨앗 쌍에서 '한쪽만' 고정(2) →
  // 그 칸의 대칭 짝은 비어 있으므로 시작은 항상 비대칭이고,
  // 플레이어는 반대쪽을 칠해야만 대칭이 완성된다(자명한 즉시 해 방지).
  const start = Array.from({ length: r }, () => new Array(c).fill(0));
  const seedPairs = Math.max(2, Math.round(pairs.length * 0.6));
  for (let i = 0; i < pairs.length && i < seedPairs; i++) {
    const p = pairs[i];
    const cc = (Math.random() < 0.5) ? p.c : (c - 1 - p.c);
    start[p.r][cc] = 2; // locked, 한쪽만
  }

  return { start };
}

// 동일 퍼즐을 각 플레이어 상태로 복제
function clonePuzzleToZone(puzzle) {
  return puzzle.start.map(row => row.slice());
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
      <span class="zone-moves" id="left-${i}">대칭으로!</span>
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
function renderBoard(playerIdx) {
  const board = document.getElementById(`pf-board-${playerIdx}`);
  if (!board) return;
  const grid = zoneGrid[playerIdx];
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const st = grid[r][c];
      let stateCls = 'empty';
      if (st === 1) stateCls = 'filled';
      else if (st === 2) stateCls = 'locked';
      cell.className = 'pf-cell ' + stateCls;
      cell.dataset.r = r;
      cell.dataset.c = c;
      onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function updateLeftChip(playerIdx) {
  const el = document.getElementById(`left-${playerIdx}`);
  if (!el) return;
  const grid = zoneGrid[playerIdx];
  // 비대칭 칸 수 = 거울 짝과 값이 다른 칸 개수
  let mismatched = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c] > 0 ? 1 : 0;
      const b = grid[r][cols - 1 - c] > 0 ? 1 : 0;
      if (a !== b) mismatched++;
    }
  }
  el.textContent = mismatched === 0 ? '대칭!' : `안맞음 ${mismatched}`;
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
function handleCellTap(playerIdx, r, c) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const grid = zoneGrid[playerIdx];
  const st = grid[r][c];

  // 고정 씨앗 칸 → 누를 수 없음
  if (st === 2) {
    sound.play('buzz');
    return;
  }

  if (st === 0) {
    grid[r][c] = 1;      // 칠하기
    sound.play('place');
  } else {
    grid[r][c] = 0;      // 지우기
    sound.play('lift');
  }

  renderBoard(playerIdx);
  updateLeftChip(playerIdx);

  if (isSolved(playerIdx)) handleSolve(playerIdx);
}

// 격자가 완벽한 좌우 대칭인지 검사 (씨앗은 항상 채워져 있어 빈 보드는 불가)
function isSolved(playerIdx) {
  const grid = zoneGrid[playerIdx];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c] > 0 ? 1 : 0;
      const b = grid[r][cols - 1 - c] > 0 ? 1 : 0;
      if (a !== b) return false;
    }
  }
  return true;
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

  const puzzle = generatePuzzle(rows, cols);

  zoneGrid = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zoneGrid.push(clonePuzzleToZone(puzzle));
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
