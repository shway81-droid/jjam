/* games/calc-maze/game.js — 패턴 C (퍼즐 병렬 경쟁) — 계산 미로
 * 왼쪽 위에서 오른쪽·아래로만 이동해 칸의 연산을 차례로 적용,
 * 오른쪽 아래 칸에서 값이 목표와 같아지는 길을 가장 먼저 찾으면 승리. */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_SIZE = [3, 3, 4];       // 라운드별 격자 크기 (난이도 점증)
const ROUND_TIME = [40, 45, 60];    // 라운드별 제한시간
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

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
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.32, ctx.currentTime);
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

// ── Pure puzzle logic (DOM 비의존, 테스트 가능) ───────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomOp() {
  // 값이 항상 양수로 유지되도록 더하기·곱하기만 사용 (더하기 비중 ↑)
  if (Math.random() < 0.72) return { type: 'add', k: randInt(1, 5) };
  return { type: 'mul', k: 2 };
}

function applyOp(val, op) {
  return op.type === 'add' ? val + op.k : val * op.k;
}

function opLabel(op) {
  return op.type === 'add' ? '+' + op.k : '×' + op.k;
}

// 오른쪽/아래로만 이동하는 (0,0)→(n-1,n-1) 무작위 경로 (칸 인덱스 배열).
function randomMonotonePath(n) {
  let r = 0, c = 0;
  const path = [0];
  while (r < n - 1 || c < n - 1) {
    const canR = c < n - 1, canD = r < n - 1;
    let move;
    if (canR && canD) move = Math.random() < 0.5 ? 'R' : 'D';
    else if (canR) move = 'R';
    else move = 'D';
    if (move === 'R') c++; else r++;
    path.push(r * n + c);
  }
  return path;
}

// 경로를 따라 시작값에 연산을 차례로 적용한 값.
function computeValue(start, ops, path) {
  let v = start;
  for (let i = 1; i < path.length; i++) v = applyOp(v, ops[path[i]]);
  return v;
}

// 퍼즐 생성: 시작값 + 격자 연산 + (무작위 경로로 계산한) 목표값.
// 목표가 그 경로로 반드시 도달 가능하므로 항상 풀 수 있다.
function generatePuzzle(n) {
  for (let tries = 0; tries < 40; tries++) {
    const ops = new Array(n * n).fill(null);
    for (let idx = 1; idx < n * n; idx++) ops[idx] = randomOp();
    const start = randInt(2, 6);
    const solution = randomMonotonePath(n);
    const target = computeValue(start, ops, solution);
    if (target <= 99) {
      return { n, start, ops, target, solution };
    }
  }
  // 안전망: 곱하기 없이 재구성 (반드시 작은 값)
  const ops = new Array(n * n).fill(null);
  for (let idx = 1; idx < n * n; idx++) ops[idx] = { type: 'add', k: randInt(1, 4) };
  const start = randInt(2, 6);
  const solution = randomMonotonePath(n);
  return { n, start, ops, target: computeValue(start, ops, solution), solution };
}

function rightDownNeighbors(n, idx) {
  const r = Math.floor(idx / n), c = idx % n;
  return {
    right: c < n - 1 ? idx + 1 : -1,
    down:  r < n - 1 ? idx + n : -1,
  };
}

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let curN = 3;
let curStart = 0;
let curOps = null;
let curTarget = 0;
let curSolution = null;
let zonePath = [];       // 각 플레이어의 경로 (칸 인덱스 배열, 항상 [0]로 시작)
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = 0;

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
      <span class="cm-chip"><b class="cm-cur" id="cur-${i}">0</b> → <b class="cm-tgt" id="tgt-${i}">0</b></span>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'np-board cm-board';
    board.id = `cm-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`cm-board-${playerIdx}`);
  if (!board) return;
  const path = zonePath[playerIdx];
  const pathSet = new Set(path);
  const headIdx = path[path.length - 1];
  const total = curN * curN;

  board.style.gridTemplateColumns = `repeat(${curN}, 1fr)`;
  board.style.setProperty('--np-size', curN);
  board.innerHTML = '';

  for (let idx = 0; idx < total; idx++) {
    const cell = document.createElement('div');
    let cls = 'np-cell';
    if (idx === 0) {
      cls += ' cm-start';
      cell.textContent = curStart;
    } else {
      cls += ' cm-op';
      cell.textContent = opLabel(curOps[idx]);
    }
    if (pathSet.has(idx)) cls += ' cm-path';
    if (idx === headIdx) cls += ' cm-head';
    if (idx === total - 1) cls += ' cm-goal';
    cell.className = cls;
    cell.dataset.player = playerIdx;
    cell.dataset.idx = idx;
    onTap(cell, () => handleCellTap(playerIdx, idx));
    board.appendChild(cell);
  }
}

function updateChip(playerIdx) {
  const cur = document.getElementById(`cur-${playerIdx}`);
  const tgt = document.getElementById(`tgt-${playerIdx}`);
  if (cur) cur.textContent = computeValue(curStart, curOps, zonePath[playerIdx]);
  if (tgt) tgt.textContent = curTarget;
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
function handleCellTap(playerIdx, idx) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const path = zonePath[playerIdx];
  const head = path[path.length - 1];
  const total = curN * curN;

  // 머리 칸(경로 끝) 탭 → 되돌리기 (시작칸은 되돌릴 수 없음)
  if (idx === head) {
    if (path.length > 1) {
      path.pop();
      sound.play('undo');
      const zone = getZone(playerIdx);
      if (zone) zone.classList.remove('cm-mismatch');
      renderBoard(playerIdx);
      updateChip(playerIdx);
    } else {
      sound.play('buzz');
    }
    return;
  }

  // 오른쪽/아래 이웃이면 경로 연장
  const nb = rightDownNeighbors(curN, head);
  if (idx === nb.right || idx === nb.down) {
    path.push(idx);
    renderBoard(playerIdx);
    updateChip(playerIdx);

    if (idx === total - 1) {
      // 도착 칸 — 값이 목표와 같으면 성공
      const val = computeValue(curStart, curOps, path);
      if (val === curTarget) {
        sound.play('place');
        handleSolve(playerIdx);
      } else {
        sound.play('buzz');
        const zone = getZone(playerIdx);
        if (zone) {
          zone.classList.add('cm-mismatch');
        }
      }
    } else {
      sound.play('place');
    }
    return;
  }

  // 그 외 칸은 이동 불가
  sound.play('buzz');
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  zone.classList.remove('cm-mismatch');
  zone.classList.add('solved');

  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
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
  timeRemaining = ROUND_TIME[roundIdx];
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

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';
  curN = ROUND_SIZE[roundIdx];

  const puzzle = generatePuzzle(curN);
  curStart = puzzle.start;
  curOps = puzzle.ops;
  curTarget = puzzle.target;
  curSolution = puzzle.solution;

  zonePath = [];
  zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zonePath.push([0]);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked', 'cm-mismatch');
    renderBoard(i);
    updateChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `오른쪽·아래로만 지나 목표 ${curTarget}을(를) 만들어요!`;

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

// ── Test hook (Node 환경에서만 export) ─────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    randomOp, applyOp, opLabel, randomMonotonePath,
    computeValue, generatePuzzle, rightDownNeighbors,
  };
}
