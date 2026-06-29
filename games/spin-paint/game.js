/* games/spin-paint/game.js — 패턴 C (퍼즐 병렬 경쟁) — 빙글 색칠 (점대칭/180° 회전 채우기) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 45;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 보드: rows × cols (cols는 짝수 — 좌우 절반이 같아야 함), fill = 색칸 비율
const ROUND_DEF = [
  { rows: 4, cols: 4, fill: 0.55 },
  { rows: 5, cols: 6, fill: 0.50 },
  { rows: 6, cols: 6, fill: 0.55 },
];

// 색 팔레트: 상태 1·2. 상태 0 = 빈칸.
const PALETTE = {
  1: { fill: '#F48FB1', name: '분홍' },
  2: { fill: '#81D4FA', name: '파랑' },
};

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

// ── Pure puzzle generator (테스트 가능, DOM 비의존) ──────────────
// 좌우 절반이 짝수 cols. 왼쪽 절반은 단서(고정), 오른쪽 절반은 왼쪽을 보드 중심
// 기준으로 180° 돌린(점대칭) 모습.
//   left[r][c]  (c: 0..half-1)  = 0|1|2
//   target right cell (r, c)  (c: half..cols-1) = left[rows-1-r][cols-1-c]
function randInt(n) { return Math.floor(Math.random() * n); }

function generatePuzzle(def) {
  const { rows, cols, fill } = def;
  const half = cols / 2;
  let left;
  let nonBlank = 0;
  let guard = 0;
  do {
    left = [];
    nonBlank = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < half; c++) {
        if (Math.random() < fill) {
          const col = 1 + randInt(2);
          row.push(col);
          nonBlank++;
        } else {
          row.push(0);
        }
      }
      left.push(row);
    }
    guard++;
  } while (nonBlank < Math.max(3, Math.round(rows * half * 0.3)) && guard < 200);

  return { rows, cols, half, left };
}

// 오른쪽 칸 (r,c)의 목표 상태 = 왼쪽을 180° 돌린(점대칭) 칸.
function targetAt(puzzle, r, c) {
  return puzzle.left[puzzle.rows - 1 - r][puzzle.cols - 1 - c];
}

// 오른쪽 보드가 완성(모든 칸이 거울상과 일치)됐는지.
function isComplete(puzzle, right) {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = puzzle.half; c < puzzle.cols; c++) {
      if (right[r][c] !== targetAt(puzzle, r, c)) return false;
    }
  }
  return true;
}

// 남은(불일치) 오른쪽 칸 수.
function remainingCount(puzzle, right) {
  let n = 0;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = puzzle.half; c < puzzle.cols; c++) {
      if (right[r][c] !== targetAt(puzzle, r, c)) n++;
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
let zoneRight = [];          // 각 플레이어의 오른쪽 절반 상태 (2D 배열, 전체 cols 폭으로 둠)
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
    board.className = 'dc-board';
    board.id = `dc-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`dc-board-${playerIdx}`);
  if (!board) return;
  const p = curPuzzle;
  const right = zoneRight[playerIdx];

  board.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
  board.style.setProperty('--dc-cols', p.cols);
  board.style.setProperty('--dc-rows', p.rows);
  board.innerHTML = '';

  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const cell = document.createElement('div');
      const isLeft = c < p.half;
      let state;
      if (isLeft) {
        state = p.left[r][c];
        cell.className = 'dc-cell clue' + (state === 0 ? ' blank' : '');
      } else {
        state = right[r][c];
        const ok = state === targetAt(p, r, c);
        cell.className = 'dc-cell editable' + (state === 0 ? ' blank' : '') + (ok ? ' ok' : '');
      }
      if (c === p.half) cell.classList.add('fold');
      if (state !== 0) cell.style.background = PALETTE[state].fill;
      cell.dataset.player = playerIdx;
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (!isLeft) onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function updateNextChip(playerIdx) {
  const el = document.getElementById(`next-${playerIdx}`);
  if (!el) return;
  const rem = remainingCount(curPuzzle, zoneRight[playerIdx]);
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

  const right = zoneRight[playerIdx];
  // 색 순환: 0 → 1 → 2 → 0
  right[r][c] = (right[r][c] + 1) % 3;
  sound.play('place');
  renderBoard(playerIdx);
  updateNextChip(playerIdx);

  if (isComplete(curPuzzle, right)) {
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

  zoneRight = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    // 오른쪽 절반 상태 (전체 cols 폭 2D 배열; 왼쪽 영역은 사용 안 함)
    const right = [];
    for (let r = 0; r < curPuzzle.rows; r++) {
      right.push(new Array(curPuzzle.cols).fill(0));
    }
    zoneRight.push(right);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateNextChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `왼쪽을 반 바퀴 돌리면? 점대칭으로 오른쪽을 색칠하세요`;

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
  module.exports = { generatePuzzle, targetAt, isComplete, remainingCount };
}
