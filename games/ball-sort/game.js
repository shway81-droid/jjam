/* games/ball-sort/game.js — 색 구슬 정렬 (정렬 퍼즐 2~4인 동시 레이스) */
'use strict';

const BALL_TOTAL_ROUNDS = 4;
const BALL_ROUND_TIME = 75;
const BALL_RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const BALL_CAP = 4; // 시험관 한 개에 구슬 4개

const BALL_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 구슬 색 팔레트 (검정 테두리 — Level 3 Comic)
const BALL_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA'];

/*
 * 레벨 라이브러리 — 각 레벨은 시험관 배열. 시험관 = 색 인덱스 배열(아래→위), 길이 ≤ BALL_CAP.
 * 생성기(scripts 외부)로 풀어짐(solvable) 검증된 배치만 하드코딩.
 * 목표: 모든 시험관이 비었거나 같은 색 BALL_CAP개로 가득 차면 완성.
 */
const BALL_LEVEL_LIBRARY = [
  [[0, 0, 1, 2], [2, 2, 2, 1], [1, 0, 1, 0], [], []],                                   // L0 3색 (쉬움)
  [[0, 0, 0, 1], [1, 2, 2, 1], [0, 1, 2, 2], [], []],                                   // L1 3색
  [[1, 0, 0, 3], [0, 2, 2, 2], [1, 3, 3, 0], [1, 1, 2, 3], [], []],                     // L2 4색
  [[0, 3, 3, 2], [3, 0, 2, 3], [2, 1, 2, 1], [1, 0, 0, 1], [], []],                     // L3 4색
  [[1, 1, 2, 0], [3, 1, 3, 1], [2, 0, 0, 3], [3, 2, 2, 0], []],                         // L4 4색 (빈관 1 — 어려움)
  [[0, 4, 3, 3], [1, 2, 1, 2], [0, 2, 3, 2], [4, 1, 4, 4], [1, 0, 3, 0], [], []],       // L5 5색
  [[1, 3, 2, 4], [4, 3, 1, 4], [1, 2, 2, 0], [1, 2, 4, 0], [0, 0, 3, 3], [], []],       // L6 5색
];

// 4라운드 레벨 매핑 (점증 난이도)
const BALL_ROUND_LEVELS = [0, 2, 4, 5];

// ─── 풀이 가능 자가검증 (BFS, warn만) ───────────────────────────
function ballIsSolvedState(tubes) {
  for (const t of tubes) {
    if (t.length === 0) continue;
    if (t.length !== BALL_CAP) return false;
    const c = t[0];
    for (const b of t) if (b !== c) return false;
  }
  return true;
}
function ballStateKey(tubes) {
  return tubes.map(t => t.join('.')).sort().join('|');
}
function ballVerifySolvable(levelDef) {
  const seen = new Set();
  const stack = [levelDef.map(t => t.slice())];
  let iters = 0;
  const limit = 300000;
  while (stack.length) {
    if (++iters > limit) return false;
    const cur = stack.pop();
    if (ballIsSolvedState(cur)) return true;
    const k = ballStateKey(cur);
    if (seen.has(k)) continue;
    seen.add(k);
    const n = cur.length;
    for (let i = 0; i < n; i++) {
      if (cur[i].length === 0) continue;
      const ball = cur[i][cur[i].length - 1];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dst = cur[j];
        if (dst.length >= BALL_CAP) continue;
        if (dst.length > 0 && dst[dst.length - 1] !== ball) continue;
        const ns = cur.map(t => t.slice());
        ns[j].push(ns[i].pop());
        stack.push(ns);
      }
    }
  }
  return false;
}

BALL_ROUND_LEVELS.forEach((li) => {
  if (!ballVerifySolvable(BALL_LEVEL_LIBRARY[li])) {
    console.warn(`[ball-sort] Level ${li} 풀이 불가능 — 데이터 확인 필요`);
  }
});

// ─── Sound ───────────────────────────────────────────────────
const ballSound = createSoundManager({
  pour(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.16);
  },
  lift(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.09);
  },
  bump(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
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
let ballPlayerCount = 2;
let ballRoundIdx = 0;
let ballScores = [];
let ballRoundResults = [];
let ballTubes = [];     // ballTubes[player] = [tube, tube, ...]
let ballSelected = [];  // 선택된 시험관 index 또는 null
let ballMoves = [];
let ballSolved = [];
let ballPhase = 'idle';
let ballTimerHandle = null;
let ballNextHandle = null;
let ballTimeRemaining = BALL_ROUND_TIME;
let ballCurLevelDef = null;

const ballIntroScreen = document.getElementById('introScreen');
const ballCountdownScreen = document.getElementById('countdownScreen');
const ballCountdownNumber = document.getElementById('countdownNumber');
const ballGameScreen = document.getElementById('gameScreen');
const ballResultScreen = document.getElementById('resultScreen');
const ballBackBtn = document.getElementById('backBtn');
const ballPlayBtn = document.getElementById('playBtn');
const ballCloseBtn = document.getElementById('closeBtn');
const ballRetryBtn = document.getElementById('retryBtn');
const ballHomeBtn = document.getElementById('homeBtn');
const ballZonesWrap = document.getElementById('zonesWrap');
const ballQuestionCounter = document.getElementById('questionCounter');
const ballProblemTimer = document.getElementById('problemTimer');
const ballProblemStatus = document.getElementById('problemStatus');
const ballScoreBar = document.getElementById('scoreBar');
const ballSoundToggleIntro = document.getElementById('soundToggleIntro');
const ballResultTitle = document.getElementById('resultTitle');
const ballResultWinner = document.getElementById('resultWinner');
const ballTotalRow = document.getElementById('totalRow');

function ballShowScreen(s) {
  [ballIntroScreen, ballCountdownScreen, ballGameScreen, ballResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let ballCountdownInterval = null;
function ballStartPreGameCountdown(onDone) {
  ballShowScreen(ballCountdownScreen);
  ballCountdownInterval = runCountdown(ballCountdownNumber, onDone);
}

function ballClearTimers() {
  if (ballCountdownInterval) { clearInterval(ballCountdownInterval); ballCountdownInterval = null; }
  if (ballTimerHandle) { clearInterval(ballTimerHandle); ballTimerHandle = null; }
  if (ballNextHandle) { clearTimeout(ballNextHandle); ballNextHandle = null; }
}

// ─── 존 구성 ───────────────────────────────────────────────
function ballBuildZones() {
  ballZonesWrap.innerHTML = '';
  ballZonesWrap.className = `zones-wrap p${ballPlayerCount}`;
  for (let i = 0; i < ballPlayerCount; i++) {
    const cfg = BALL_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-moves" id="ball-moves-${i}">이동 0</span>
      </div>
      <div class="ball-tubes" id="ball-tubes-${i}"></div>`;
    ballZonesWrap.appendChild(zone);
  }
}

function ballGetZone(idx) { return ballZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 렌더링 ───────────────────────────────────────────────
function ballRenderBoard(playerIdx) {
  const wrap = document.getElementById(`ball-tubes-${playerIdx}`);
  if (!wrap) return;
  wrap.innerHTML = '';
  const tubes = ballTubes[playerIdx];
  tubes.forEach((tube, ti) => {
    const tubeEl = document.createElement('button');
    tubeEl.type = 'button';
    tubeEl.className = 'ball-tube';
    if (ballSelected[playerIdx] === ti) tubeEl.classList.add('selected');
    // 빈 슬롯(위) → 채워진 구슬(아래) 순으로 렌더 (위에서 아래로)
    for (let s = BALL_CAP - 1; s >= 0; s--) {
      const slot = document.createElement('div');
      slot.className = 'ball-slot';
      if (s < tube.length) {
        const ball = document.createElement('div');
        ball.className = 'ball';
        ball.style.background = BALL_COLORS[tube[s]];
        // 선택된 시험관의 맨 위 구슬은 살짝 떠오름
        if (ballSelected[playerIdx] === ti && s === tube.length - 1) {
          ball.classList.add('lifted');
        }
        slot.appendChild(ball);
      }
      tubeEl.appendChild(slot);
    }
    onTap(tubeEl, () => ballHandleTubeTap(playerIdx, ti));
    wrap.appendChild(tubeEl);
  });
}

// ─── 탭 처리 ───────────────────────────────────────────────
function ballHandleTubeTap(playerIdx, tubeIdx) {
  if (ballPhase !== 'active' || ballSolved[playerIdx]) return;
  const tubes = ballTubes[playerIdx];
  const sel = ballSelected[playerIdx];

  if (sel === null) {
    // 빈 시험관 선택 불가
    if (tubes[tubeIdx].length === 0) { ballSound.play('bump'); return; }
    ballSelected[playerIdx] = tubeIdx;
    ballSound.play('lift');
    ballRenderBoard(playerIdx);
    return;
  }

  // 같은 시험관 다시 탭 → 선택 해제
  if (sel === tubeIdx) {
    ballSelected[playerIdx] = null;
    ballRenderBoard(playerIdx);
    return;
  }

  // 옮기기 시도
  const src = tubes[sel];
  const dst = tubes[tubeIdx];
  const ball = src[src.length - 1];
  const canMove = dst.length < BALL_CAP && (dst.length === 0 || dst[dst.length - 1] === ball);

  if (!canMove) {
    // 옮길 수 없으면 새 시험관을 선택으로 전환(편의)
    ballSound.play('bump');
    ballSelected[playerIdx] = tubes[tubeIdx].length > 0 ? tubeIdx : null;
    ballRenderBoard(playerIdx);
    return;
  }

  // 유효 이동
  dst.push(src.pop());
  ballSelected[playerIdx] = null;
  ballMoves[playerIdx]++;
  const movesEl = document.getElementById(`ball-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = `이동 ${ballMoves[playerIdx]}`;
  ballSound.play('pour');
  ballRenderBoard(playerIdx);

  if (ballIsSolvedState(tubes)) {
    ballSolvePuzzle(playerIdx);
  }
}

function ballSolvePuzzle(playerIdx) {
  if (ballSolved[playerIdx]) return;
  ballSolved[playerIdx] = true;
  const zone = ballGetZone(playerIdx);
  if (zone) zone.classList.add('solved');

  if (ballRoundResults.length === ballRoundIdx) {
    ballRoundResults.push({ winnerIdx: playerIdx, timedOut: false });
    ballScores[playerIdx]++;
    ballUpdateBarScore(playerIdx);
    ballSound.play('ding');
    ballProblemStatus.textContent = `${BALL_PLAYER_CONFIG[playerIdx].label} 정렬 완성! (${ballMoves[playerIdx]}번 이동)`;
    for (let i = 0; i < ballPlayerCount; i++) {
      if (i !== playerIdx && !ballSolved[i]) { const z = ballGetZone(i); if (z) z.classList.add('locked'); }
    }
    ballPhase = 'done';
    ballClearTimers();
    ballNextHandle = setTimeout(() => ballNextRound(), BALL_RESULT_PAUSE_MS);
  }
}

function ballHandleTimeout() {
  if (ballPhase !== 'active') return;
  ballPhase = 'done';
  ballSound.play('timeout');
  for (let i = 0; i < ballPlayerCount; i++) {
    if (!ballSolved[i]) { const z = ballGetZone(i); if (z) z.classList.add('locked'); }
  }
  ballRoundResults.push({ winnerIdx: -1, timedOut: true });
  ballProblemStatus.textContent = '시간 초과! 다음 라운드로';
  ballNextHandle = setTimeout(() => ballNextRound(), BALL_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───────────────────────────────────────────────
function ballBuildScoreBar() {
  ballScoreBar.innerHTML = '';
  for (let i = 0; i < ballPlayerCount; i++) {
    const cfg = BALL_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="ball-bar-score-${i}">0</span>`;
    ballScoreBar.appendChild(chip);
  }
}
function ballUpdateBarScore(idx) { const el = document.getElementById(`ball-bar-score-${idx}`); if (el) el.textContent = ballScores[idx]; }

// ─── 타이머 ───────────────────────────────────────────────
function ballStartCountdown() {
  ballTimeRemaining = BALL_ROUND_TIME;
  ballProblemTimer.textContent = ballTimeRemaining;
  ballProblemTimer.classList.remove('urgent');
  ballTimerHandle = setInterval(() => {
    ballTimeRemaining--;
    ballProblemTimer.textContent = ballTimeRemaining;
    if (ballTimeRemaining <= 5) { ballProblemTimer.classList.add('urgent'); ballSound.play('tick'); }
    if (ballTimeRemaining <= 0) { ballClearTimers(); ballHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───────────────────────────────────────────────
function ballLoadRound() {
  ballPhase = 'active';
  ballCurLevelDef = BALL_LEVEL_LIBRARY[BALL_ROUND_LEVELS[ballRoundIdx % BALL_ROUND_LEVELS.length]];

  ballTubes = [];
  ballSelected = [];
  ballMoves = [];
  ballSolved = [];

  for (let i = 0; i < ballPlayerCount; i++) {
    ballTubes.push(ballCurLevelDef.map(t => t.slice()));
    ballSelected.push(null);
    ballMoves.push(0);
    ballSolved.push(false);
    const zone = ballGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    const movesEl = document.getElementById(`ball-moves-${i}`);
    if (movesEl) movesEl.textContent = '이동 0';
  }

  ballQuestionCounter.textContent = `${ballRoundIdx + 1} / ${BALL_TOTAL_ROUNDS}`;
  ballProblemStatus.textContent = '시험관마다 같은 색만 모아요!';

  for (let i = 0; i < ballPlayerCount; i++) ballRenderBoard(i);
  ballStartCountdown();
}

function ballNextRound() {
  ballRoundIdx++;
  if (ballRoundIdx >= BALL_TOTAL_ROUNDS) ballShowResult();
  else ballLoadRound();
}

function ballStartGame() {
  ballRoundIdx = 0;
  ballScores = new Array(ballPlayerCount).fill(0);
  ballRoundResults = [];
  ballPhase = 'idle';
  ballClearTimers();
  ballBuildZones();
  ballBuildScoreBar();
  ballShowScreen(ballGameScreen);
  ballLoadRound();
}

function ballShowResult() {
  ballClearTimers();
  ballPhase = 'idle';
  ballSound.play('fanfare');
  const max = Math.max(...ballScores);
  const winners = ballScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { ballResultTitle.textContent = '무승부!'; ballResultWinner.textContent = '아무도 완성하지 못했어요.'; }
  else if (winners.length === 1) { ballResultTitle.textContent = '게임 종료!'; ballResultWinner.textContent = `${BALL_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => BALL_PLAYER_CONFIG[w].label).join(', '); ballResultTitle.textContent = '동점!'; ballResultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  ballTotalRow.innerHTML = '';
  for (let i = 0; i < ballPlayerCount; i++) {
    const cfg = BALL_PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${ballScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    ballTotalRow.appendChild(chip);
  }
  ballShowScreen(ballResultScreen);
}

// ─── 인원 선택 ───────────────────────────────────────────────
setupPlayerSelect(function (n) { ballPlayerCount = n; });

// ─── 이벤트 바인딩 ───────────────────────────────────────────
setupSoundToggle(ballSound, ballSoundToggleIntro);
onTap(ballBackBtn, () => goHome());
onTap(ballCloseBtn, () => { ballClearTimers(); goHome(); });
onTap(ballHomeBtn, () => goHome());
onTap(ballRetryBtn, () => ballStartPreGameCountdown(() => ballStartGame()));
onTap(ballPlayBtn, () => ballStartPreGameCountdown(() => ballStartGame()));
