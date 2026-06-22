/* games/dice-roll/game.js — 주사위 굴리기 (주사위 굴림 퍼즐 2~4인 동시 레이스) */
'use strict';

const DR_TOTAL_ROUNDS = 4;
const DR_ROUND_TIME = 60;
const DR_RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 격자 크기와 해답 길이(굴림 수) — 점증 난이도
const DR_ROUND_GRID = [4, 4, 5, 5];
const DR_ROUND_STEPS = [3, 4, 5, 6];

const DR_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 표준 주사위 방향 (마주 보는 면 합 = 7)
function drStartOrient() {
  return { top: 1, bottom: 6, north: 2, south: 5, east: 3, west: 4 };
}

// 한 칸 굴림: 방향에 따라 면 회전
function drRoll(o, dir) {
  if (dir === 'north') return { top: o.south, bottom: o.north, north: o.top, south: o.bottom, east: o.east, west: o.west };
  if (dir === 'south') return { top: o.north, bottom: o.south, north: o.bottom, south: o.top, east: o.east, west: o.west };
  if (dir === 'east')  return { top: o.west, bottom: o.east, east: o.top, west: o.bottom, north: o.north, south: o.south };
  /* west */            return { top: o.east, bottom: o.west, west: o.top, east: o.bottom, north: o.north, south: o.south };
}

const DR_DIRS = {
  north: [-1, 0], south: [1, 0], east: [0, 1], west: [0, -1],
};

// ─── 레벨 생성 (항상 풀 수 있게 무작위 굴림으로 역생성) ─────────
function drGenerateLevel(grid, steps) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = { row: drRandInt(grid), col: drRandInt(grid) };
    let pos = { row: start.row, col: start.col };
    let orient = drStartOrient();
    let lastDir = null;
    for (let s = 0; s < steps; s++) {
      // 경계 안에서 이동 가능한 방향 중 무작위 (직전 방향 되돌리기는 가급적 피함)
      const opts = [];
      for (const dir of Object.keys(DR_DIRS)) {
        const [dr, dc] = DR_DIRS[dir];
        const nr = pos.row + dr, nc = pos.col + dc;
        if (nr >= 0 && nr < grid && nc >= 0 && nc < grid) opts.push(dir);
      }
      if (opts.length === 0) break;
      let pick = opts[drRandInt(opts.length)];
      if (opts.length > 1 && lastDir && drOpposite(pick) === lastDir) {
        // 한 번 더 뽑아 왔다갔다 줄이기
        pick = opts[drRandInt(opts.length)];
      }
      const [dr, dc] = DR_DIRS[pick];
      pos = { row: pos.row + dr, col: pos.col + dc };
      orient = drRoll(orient, pick);
      lastDir = pick;
    }
    // 시작과 다른 칸이어야 의미가 있음
    if (pos.row === start.row && pos.col === start.col) continue;
    return { grid: grid, start: start, goal: pos, required: orient.top };
  }
  // 안전망 (도달 못 하면 단순 레벨)
  const o = drRoll(drStartOrient(), 'east');
  return { grid: grid, start: { row: 0, col: 0 }, goal: { row: 0, col: 1 }, required: o.top };
}

function drOpposite(dir) {
  return { north: 'south', south: 'north', east: 'west', west: 'east' }[dir];
}
function drRandInt(n) { return Math.floor(Math.random() * n); }

// ─── Sound ───────────────────────────────────────────────────
const drSound = createSoundManager({
  roll(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(300, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.14);
  },
  bump(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
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

// ─── State ───────────────────────────────────────────────────
let drPlayerCount = 2;
let drRoundIdx = 0;
let drScores = [];
let drPos = [];        // [{row,col}] per player
let drOrient = [];     // [orientation] per player
let drMoves = [];
let drSolved = [];
let drPhase = 'idle';
let drTimerHandle = null;
let drNextHandle = null;
let drTimeRemaining = DR_ROUND_TIME;
let drLevel = null;

const drIntroScreen = document.getElementById('introScreen');
const drCountdownScreen = document.getElementById('countdownScreen');
const drCountdownNumber = document.getElementById('countdownNumber');
const drGameScreen = document.getElementById('gameScreen');
const drResultScreen = document.getElementById('resultScreen');
const drBackBtn = document.getElementById('backBtn');
const drPlayBtn = document.getElementById('playBtn');
const drCloseBtn = document.getElementById('closeBtn');
const drRetryBtn = document.getElementById('retryBtn');
const drHomeBtn = document.getElementById('homeBtn');
const drZonesWrap = document.getElementById('zonesWrap');
const drQuestionCounter = document.getElementById('questionCounter');
const drProblemTimer = document.getElementById('problemTimer');
const drProblemStatus = document.getElementById('problemStatus');
const drScoreBar = document.getElementById('scoreBar');
const drSoundToggleIntro = document.getElementById('soundToggleIntro');
const drResultTitle = document.getElementById('resultTitle');
const drResultWinner = document.getElementById('resultWinner');
const drTotalRow = document.getElementById('totalRow');

function drShowScreen(s) {
  [drIntroScreen, drCountdownScreen, drGameScreen, drResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let drCountdownInterval = null;
function drStartPreGameCountdown(onDone) {
  drShowScreen(drCountdownScreen);
  drCountdownInterval = runCountdown(drCountdownNumber, onDone);
}

function drClearTimers() {
  if (drCountdownInterval) { clearInterval(drCountdownInterval); drCountdownInterval = null; }
  if (drTimerHandle) { clearInterval(drTimerHandle); drTimerHandle = null; }
  if (drNextHandle) { clearTimeout(drNextHandle); drNextHandle = null; }
}

// ─── 존 구성 ───────────────────────────────────────────────
function drBuildZones() {
  drZonesWrap.innerHTML = '';
  drZonesWrap.className = `zones-wrap p${drPlayerCount}`;
  for (let i = 0; i < drPlayerCount; i++) {
    const cfg = DR_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-moves" id="dr-moves-${i}">굴림 0</span>
      </div>
      <div class="dr-grid-wrap" id="dr-wrap-${i}">
        <div class="dr-grid" id="dr-grid-${i}"></div>
      </div>
      <div class="dr-dpad" id="dr-dpad-${i}">
        <button class="dr-dpad-btn dpad-dr-up" id="dr-up-${i}" aria-label="위로 굴리기">⬆️</button>
        <button class="dr-dpad-btn dpad-dr-left" id="dr-left-${i}" aria-label="왼쪽으로 굴리기">⬅️</button>
        <button class="dr-dpad-btn dpad-dr-reset" id="dr-reset-${i}" aria-label="처음부터">↺</button>
        <button class="dr-dpad-btn dpad-dr-right" id="dr-right-${i}" aria-label="오른쪽으로 굴리기">➡️</button>
        <button class="dr-dpad-btn dpad-dr-down" id="dr-down-${i}" aria-label="아래로 굴리기">⬇️</button>
      </div>`;
    drZonesWrap.appendChild(zone);
    const dirMap = { up: 'north', down: 'south', left: 'west', right: 'east' };
    Object.keys(dirMap).forEach(key => {
      const btn = document.getElementById(`dr-${key}-${i}`);
      if (btn) onTap(btn, () => drHandleMove(i, dirMap[key]));
    });
    const rb = document.getElementById(`dr-reset-${i}`);
    if (rb) onTap(rb, () => drHandleReset(i));
  }
}

function drGetZone(idx) { return drZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 렌더링 ───────────────────────────────────────────────
function drRenderBoard(playerIdx) {
  const gridEl = document.getElementById(`dr-grid-${playerIdx}`);
  if (!gridEl || !drLevel) return;
  const N = drLevel.grid;
  const wrap = document.getElementById(`dr-wrap-${playerIdx}`);
  const wrapW = wrap ? wrap.offsetWidth : 120;
  const wrapH = wrap ? wrap.offsetHeight : 120;
  const sz = Math.min(wrapW - 8, wrapH - 8, 220);
  const cellSz = sz / N;
  gridEl.style.width = sz + 'px';
  gridEl.style.height = sz + 'px';
  gridEl.innerHTML = '';

  // 셀 격자
  const cellGrid = document.createElement('div');
  cellGrid.className = 'dr-cell-grid';
  cellGrid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  cellGrid.style.gridTemplateRows = `repeat(${N}, 1fr)`;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('div');
      cell.className = 'dr-cell';
      if ((r + c) % 2 === 1) cell.classList.add('alt');
      cellGrid.appendChild(cell);
    }
  }
  gridEl.appendChild(cellGrid);

  // 목표 칸 (깃발 + 목표 숫자)
  const goal = drLevel.goal;
  const goalEl = document.createElement('div');
  goalEl.className = 'dr-goal';
  goalEl.style.top = (goal.row * cellSz + 1) + 'px';
  goalEl.style.left = (goal.col * cellSz + 1) + 'px';
  goalEl.style.width = (cellSz - 2) + 'px';
  goalEl.style.height = (cellSz - 2) + 'px';
  goalEl.innerHTML = `<span class="dr-goal-num">${drLevel.required}</span><span class="dr-goal-flag">🚩</span>`;
  gridEl.appendChild(goalEl);

  // 주사위
  const pos = drPos[playerIdx];
  const dieEl = document.createElement('div');
  dieEl.className = 'dr-die';
  dieEl.id = `dr-die-${playerIdx}`;
  dieEl.style.top = (pos.row * cellSz + 2) + 'px';
  dieEl.style.left = (pos.col * cellSz + 2) + 'px';
  dieEl.style.width = (cellSz - 4) + 'px';
  dieEl.style.height = (cellSz - 4) + 'px';
  dieEl.textContent = drOrient[playerIdx].top;
  gridEl.appendChild(dieEl);
  drMarkGoalReached(playerIdx);
}

function drUpdateDie(playerIdx) {
  const gridEl = document.getElementById(`dr-grid-${playerIdx}`);
  if (!gridEl || !drLevel) return;
  const N = drLevel.grid;
  const wrap = document.getElementById(`dr-wrap-${playerIdx}`);
  const wrapW = wrap ? wrap.offsetWidth : 120;
  const wrapH = wrap ? wrap.offsetHeight : 120;
  const sz = Math.min(wrapW - 8, wrapH - 8, 220);
  const cellSz = sz / N;
  const dieEl = document.getElementById(`dr-die-${playerIdx}`);
  if (!dieEl) return;
  const pos = drPos[playerIdx];
  dieEl.style.top = (pos.row * cellSz + 2) + 'px';
  dieEl.style.left = (pos.col * cellSz + 2) + 'px';
  dieEl.textContent = drOrient[playerIdx].top;
  dieEl.classList.remove('pop');
  void dieEl.offsetWidth;
  dieEl.classList.add('pop');
  drMarkGoalReached(playerIdx);
}

// 목표 칸 위에 있고 윗면이 맞으면 표시
function drMarkGoalReached(playerIdx) {
  const dieEl = document.getElementById(`dr-die-${playerIdx}`);
  if (!dieEl || !drLevel) return;
  const pos = drPos[playerIdx];
  const onGoal = pos.row === drLevel.goal.row && pos.col === drLevel.goal.col;
  dieEl.classList.toggle('on-goal', onGoal);
  dieEl.classList.toggle('match', onGoal && drOrient[playerIdx].top === drLevel.required);
}

// ─── 이동 처리 ───────────────────────────────────────────────
function drHandleMove(playerIdx, dir) {
  if (drPhase !== 'active' || drSolved[playerIdx]) return;
  const N = drLevel.grid;
  const [dr, dc] = DR_DIRS[dir];
  const cur = drPos[playerIdx];
  const nr = cur.row + dr, nc = cur.col + dc;
  if (nr < 0 || nr >= N || nc < 0 || nc >= N) {
    drSound.play('bump');
    return;
  }
  drPos[playerIdx] = { row: nr, col: nc };
  drOrient[playerIdx] = drRoll(drOrient[playerIdx], dir);
  drMoves[playerIdx]++;
  const movesEl = document.getElementById(`dr-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = `굴림 ${drMoves[playerIdx]}`;
  drSound.play('roll');
  drUpdateDie(playerIdx);

  if (nr === drLevel.goal.row && nc === drLevel.goal.col && drOrient[playerIdx].top === drLevel.required) {
    drSolvePuzzle(playerIdx);
  }
}

function drHandleReset(playerIdx) {
  if (drPhase !== 'active' || drSolved[playerIdx]) return;
  drPos[playerIdx] = { row: drLevel.start.row, col: drLevel.start.col };
  drOrient[playerIdx] = drStartOrient();
  drSound.play('bump');
  drUpdateDie(playerIdx);
}

function drSolvePuzzle(playerIdx) {
  if (drSolved[playerIdx]) return;
  drSolved[playerIdx] = true;
  const zone = drGetZone(playerIdx);
  if (zone) zone.classList.add('solved');

  drScores[playerIdx]++;
  drUpdateBarScore(playerIdx);
  drSound.play('ding');
  drProblemStatus.textContent = `${DR_PLAYER_CONFIG[playerIdx].label} 도착! (${drMoves[playerIdx]}번 굴림)`;
  for (let i = 0; i < drPlayerCount; i++) {
    if (i !== playerIdx && !drSolved[i]) { const z = drGetZone(i); if (z) z.classList.add('locked'); }
  }
  drPhase = 'done';
  drClearTimers();
  drNextHandle = setTimeout(() => drNextRound(), DR_RESULT_PAUSE_MS);
}

function drHandleTimeout() {
  if (drPhase !== 'active') return;
  drPhase = 'done';
  drSound.play('timeout');
  for (let i = 0; i < drPlayerCount; i++) {
    if (!drSolved[i]) { const z = drGetZone(i); if (z) z.classList.add('locked'); }
  }
  drProblemStatus.textContent = '시간 초과! 다음 라운드로';
  drNextHandle = setTimeout(() => drNextRound(), DR_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───────────────────────────────────────────────
function drBuildScoreBar() {
  drScoreBar.innerHTML = '';
  for (let i = 0; i < drPlayerCount; i++) {
    const cfg = DR_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="dr-bar-score-${i}">0</span>`;
    drScoreBar.appendChild(chip);
  }
}
function drUpdateBarScore(idx) { const el = document.getElementById(`dr-bar-score-${idx}`); if (el) el.textContent = drScores[idx]; }

// ─── 타이머 ───────────────────────────────────────────────
function drStartCountdown() {
  drTimeRemaining = DR_ROUND_TIME;
  drProblemTimer.textContent = drTimeRemaining;
  drProblemTimer.classList.remove('urgent');
  drTimerHandle = setInterval(() => {
    drTimeRemaining--;
    drProblemTimer.textContent = drTimeRemaining;
    if (drTimeRemaining <= 5) { drProblemTimer.classList.add('urgent'); drSound.play('tick'); }
    if (drTimeRemaining <= 0) { drClearTimers(); drHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───────────────────────────────────────────────
function drLoadRound() {
  drPhase = 'active';
  const grid = DR_ROUND_GRID[drRoundIdx % DR_ROUND_GRID.length];
  const steps = DR_ROUND_STEPS[drRoundIdx % DR_ROUND_STEPS.length];
  drLevel = drGenerateLevel(grid, steps);

  drPos = [];
  drOrient = [];
  drMoves = [];
  drSolved = [];
  for (let i = 0; i < drPlayerCount; i++) {
    drPos.push({ row: drLevel.start.row, col: drLevel.start.col });
    drOrient.push(drStartOrient());
    drMoves.push(0);
    drSolved.push(false);
    const zone = drGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    const movesEl = document.getElementById(`dr-moves-${i}`);
    if (movesEl) movesEl.textContent = '굴림 0';
  }

  drQuestionCounter.textContent = `${drRoundIdx + 1} / ${DR_TOTAL_ROUNDS}`;
  drProblemStatus.textContent = `주사위🎲를 🚩 위로! 윗면이 ${drLevel.required}가 되게!`;

  for (let i = 0; i < drPlayerCount; i++) drRenderBoard(i);
  requestAnimationFrame(() => { for (let i = 0; i < drPlayerCount; i++) drRenderBoard(i); });
  drStartCountdown();
}

function drNextRound() {
  drRoundIdx++;
  if (drRoundIdx >= DR_TOTAL_ROUNDS) drShowResult();
  else drLoadRound();
}

function drStartGame() {
  drRoundIdx = 0;
  drScores = new Array(drPlayerCount).fill(0);
  drPhase = 'idle';
  drClearTimers();
  drBuildZones();
  drBuildScoreBar();
  drShowScreen(drGameScreen);
  drLoadRound();
}

function drShowResult() {
  drClearTimers();
  drPhase = 'idle';
  drSound.play('fanfare');
  const max = Math.max(...drScores);
  const winners = drScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { drResultTitle.textContent = '무승부!'; drResultWinner.textContent = '아무도 완성하지 못했어요.'; }
  else if (winners.length === 1) { drResultTitle.textContent = '게임 종료!'; drResultWinner.textContent = `${DR_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => DR_PLAYER_CONFIG[w].label).join(', '); drResultTitle.textContent = '동점!'; drResultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  drTotalRow.innerHTML = '';
  for (let i = 0; i < drPlayerCount; i++) {
    const cfg = DR_PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${drScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    drTotalRow.appendChild(chip);
  }
  drShowScreen(drResultScreen);
}

// ─── 인원 선택 ───────────────────────────────────────────────
setupPlayerSelect(function (n) { drPlayerCount = n; });

// ─── 이벤트 바인딩 ───────────────────────────────────────────
setupSoundToggle(drSound, drSoundToggleIntro);
onTap(drBackBtn, () => goHome());
onTap(drCloseBtn, () => { drClearTimers(); goHome(); });
onTap(drHomeBtn, () => goHome());
onTap(drRetryBtn, () => drStartPreGameCountdown(() => drStartGame()));
onTap(drPlayBtn, () => drStartPreGameCountdown(() => drStartGame()));
