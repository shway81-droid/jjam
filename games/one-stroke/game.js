/* games/one-stroke/game.js — 패턴 C (퍼즐 병렬 경쟁) — 한붓그리기 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── 도형(그래프) ──────────────────────────────────────────────
// 좌표는 0~100 정사각형 기준. start는 반드시 홀수 차수 꼭짓점(한붓그리기 시작점).
// 각 도형은 홀수 차수 꼭짓점이 정확히 2개 → 오일러 경로 존재(반드시 풀 수 있음).
const FIGURES = [
  { // R1: 사각형 + 대각선 하나 (5개 선)
    start: 0,
    nodes: [ {x:22,y:24}, {x:78,y:24}, {x:78,y:78}, {x:22,y:78} ],
    edges: [ [0,1],[1,2],[2,3],[3,0],[0,2] ],
  },
  { // R2: 집 모양 (8개 선)
    start: 0,
    nodes: [ {x:20,y:80}, {x:80,y:80}, {x:80,y:46}, {x:20,y:46}, {x:50,y:16} ],
    edges: [ [0,1],[1,2],[2,3],[3,0],[0,2],[1,3],[3,4],[2,4] ],
  },
  { // R3: 집 + 가운데 부채 (10개 선)
    start: 0,
    nodes: [ {x:16,y:82}, {x:84,y:82}, {x:84,y:46}, {x:16,y:46}, {x:50,y:14}, {x:50,y:64} ],
    edges: [ [0,1],[1,2],[2,3],[3,0],[3,4],[2,4],[5,0],[5,1],[5,2],[5,3] ],
  },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  draw(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
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
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.17);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.17);
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
let scores = [];
let roundResults = [];
let zoneStates = [];             // [{ used:Set, current:int, solved:bool }]
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let currentFigure = null;

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

// 두 꼭짓점 a,b 사이의 아직 안 쓴 선의 인덱스를 찾는다 (없으면 -1)
function findEdge(fig, a, b, used) {
  for (let i = 0; i < fig.edges.length; i++) {
    if (used.has(i)) continue;
    const e = fig.edges[i];
    if ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)) return i;
  }
  return -1;
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
      <span class="zone-progress" id="moves-${i}">0 / 0</span>
      <button class="stroke-reset" id="reset-${i}" aria-label="처음부터">↺</button>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'stroke-board';
    board.id = `board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);

    const resetBtn = header.querySelector(`#reset-${i}`);
    onTap(resetBtn, () => resetBoard(i));
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function updateProgress(playerIdx) {
  const el = document.getElementById(`moves-${playerIdx}`);
  if (el) el.textContent = `${zoneStates[playerIdx].used.size} / ${currentFigure.edges.length}`;
}

// ── Render one board (SVG 선 + 꼭짓점 버튼) ───────────────────
function renderBoard(playerIdx) {
  const board = document.getElementById(`board-${playerIdx}`);
  if (!board) return;
  const st = zoneStates[playerIdx];
  const fig = currentFigure;
  const cfg = PLAYER_CONFIG[playerIdx];

  // 선(SVG)
  let lines = '';
  fig.edges.forEach((e, ei) => {
    const p = fig.nodes[e[0]], q = fig.nodes[e[1]];
    const used = st.used.has(ei);
    lines += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" ` +
      `class="stroke-line${used ? ' used' : ''}" ` +
      `${used ? `stroke="${cfg.dot}"` : ''} />`;
  });

  board.innerHTML =
    `<svg class="stroke-svg" viewBox="0 0 100 100">${lines}</svg>`;

  // 꼭짓점 버튼
  fig.nodes.forEach((n, ni) => {
    const btn = document.createElement('button');
    btn.className = 'stroke-node';
    if (st.current === -1 && ni === fig.start) btn.classList.add('start');
    if (st.current === ni) btn.classList.add('current');
    btn.style.left = n.x + '%';
    btn.style.top = n.y + '%';
    btn.dataset.node = ni;
    onTap(btn, () => handleNodeTap(playerIdx, ni));
    board.appendChild(btn);
  });
}

function flashNode(playerIdx, nodeIdx, cls) {
  const board = document.getElementById(`board-${playerIdx}`);
  if (!board) return;
  const btn = board.querySelector(`.stroke-node[data-node="${nodeIdx}"]`);
  if (!btn) return;
  btn.classList.add(cls);
  setTimeout(() => btn.classList.remove(cls), 380);
}

// ── Node tap ─────────────────────────────────────────────────
function handleNodeTap(playerIdx, nodeIdx) {
  if (phase !== 'active') return;
  const st = zoneStates[playerIdx];
  if (st.solved) return;

  // 시작 전: 시작점(초록)에서만 출발
  if (st.current === -1) {
    if (nodeIdx !== currentFigure.start) {
      sound.play('buzz');
      flashNode(playerIdx, currentFigure.start, 'hint');
      return;
    }
    st.current = nodeIdx;
    sound.play('draw');
    renderBoard(playerIdx);
    return;
  }

  // 같은 점 다시 누르면 무시
  if (nodeIdx === st.current) return;

  const ei = findEdge(currentFigure, st.current, nodeIdx, st.used);
  if (ei === -1) {
    // 이어진 (안 그린) 선이 없음
    sound.play('buzz');
    flashNode(playerIdx, nodeIdx, 'bad');
    return;
  }

  st.used.add(ei);
  st.current = nodeIdx;
  sound.play('draw');
  renderBoard(playerIdx);
  updateProgress(playerIdx);

  if (st.used.size === currentFigure.edges.length) {
    handleSolve(playerIdx);
  }
}

function resetBoard(playerIdx) {
  if (phase !== 'active') return;
  const st = zoneStates[playerIdx];
  if (st.solved) return;
  st.used = new Set();
  st.current = -1;
  renderBoard(playerIdx);
  updateProgress(playerIdx);
}

function handleSolve(winnerIdx) {
  const st = zoneStates[winnerIdx];
  if (st.solved) return;
  st.solved = true;

  const zone = getZone(winnerIdx);
  zone.classList.add('solved');

  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneStates[i].solved) {
        getZone(i).classList.add('locked');
      }
    }

    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
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
    if (!zoneStates[i].solved) {
      getZone(i).classList.add('locked');
    }
  }

  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';
  currentFigure = FIGURES[roundIdx];
  zoneStates = [];

  for (let i = 0; i < playerCount; i++) {
    zoneStates.push({ used: new Set(), current: -1, solved: false });
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateProgress(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '초록 점에서 시작! 모든 선을 한 번씩 그어요';

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
