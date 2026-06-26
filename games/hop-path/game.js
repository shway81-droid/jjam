/* games/hop-path/game.js — 패턴 C, 징검다리 폴짝 (적힌 수만큼 점프해 깃발까지) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 40;
const RESULT_PAUSE_MS = 2200;

// 라운드별 징검다리 개수 (점점 길어져 계획이 어려워짐)
const ROUND_LEN = [6, 7, 8];
const MAX_JUMP = 3;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

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
  hop(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15);
  },
  reset(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.2);
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

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let currentRow = null;   // { n, values:[] } — 이번 라운드 공통 징검다리
let frogPos = [];        // 플레이어별 현재 칸
let visited = [];        // 플레이어별 밟은 칸들
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;

const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen'), countdownNumber = $('countdownNumber');
const gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const backBtn = $('backBtn'), playBtn = $('playBtn'), closeBtn = $('closeBtn'), retryBtn = $('retryBtn'), homeBtn = $('homeBtn');
const zonesWrap = $('zonesWrap'), questionCounter = $('questionCounter'), problemTimer = $('problemTimer'), problemStatus = $('problemStatus'), scoreBar = $('scoreBar');
const soundToggleIntro = $('soundToggleIntro');
const resultTitle = $('resultTitle'), resultWinner = $('resultWinner'), totalRow = $('totalRow');

function showScreen(s) { [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active')); s.classList.add('active'); }
let countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}
function clearTimers() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; } }

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// 한 라운드의 징검다리 생성. 0 → n-1(깃발)로 가는 '앞으로 가는 정답 경로'를
// 항상 보장(각 경로칸의 수 = 다음 경로칸까지 거리). 나머지 칸은 가짜 수.
function makeRow(n) {
  const values = new Array(n).fill(0);
  const onPath = new Set([0]);
  let pos = 0;
  while (pos < n - 1) {
    const remaining = n - 1 - pos;
    const step = remaining <= MAX_JUMP ? remaining : randInt(1, MAX_JUMP);
    values[pos] = step;
    pos += step;
    onPath.add(pos);
  }
  // 경로 밖 칸(깃발 제외)에 가짜 수
  for (let i = 0; i < n - 1; i++) {
    if (!onPath.has(i)) values[i] = randInt(1, MAX_JUMP);
  }
  values[n - 1] = null; // 깃발 칸 — 점프 출발 안 함
  return { n, values };
}

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <button class="reset-btn" id="reset-${i}" aria-label="${cfg.label} 처음으로">↺ 처음</button>
      </div>`;
    const row = document.createElement('div');
    row.className = 'stone-row';
    row.id = `row-${i}`;
    zone.appendChild(row);
    zonesWrap.appendChild(zone);
    onTap($(`reset-${i}`), () => resetFrog(i));
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderRow(playerIdx) {
  const grid = $(`row-${playerIdx}`);
  if (!grid || !currentRow) return;
  const n = currentRow.n;
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  grid.innerHTML = '';
  const cur = frogPos[playerIdx];
  const curVal = currentRow.values[cur];
  const solved = zoneSolved[playerIdx];
  for (let i = 0; i < n; i++) {
    const stone = document.createElement('button');
    stone.dataset.player = playerIdx;
    stone.dataset.idx = i;
    let cls = 'stone';
    const isGoal = i === n - 1;
    if (i === 0) cls += ' start';
    if (isGoal) cls += ' goal';
    if (visited[playerIdx].includes(i)) cls += ' visited';
    if (i === cur) cls += ' current';
    const reachable = !solved && curVal != null && (i === cur + curVal || i === cur - curVal) && i >= 0 && i < n;
    if (reachable) cls += ' reachable';
    stone.className = cls;

    if (i === cur && isGoal) {
      stone.innerHTML = '<span class="frog">🐸</span><span class="goal-flag">🏁</span>';
    } else if (i === cur) {
      stone.innerHTML = `<span class="frog">🐸</span><span class="stone-num">${currentRow.values[i]}</span>`;
    } else if (isGoal) {
      stone.innerHTML = '<span class="goal-flag">🏁</span>';
    } else {
      stone.innerHTML = `<span class="stone-num">${currentRow.values[i]}</span>`;
    }
    onTap(stone, () => handleStoneTap(playerIdx, i));
    grid.appendChild(stone);
  }
}

function handleStoneTap(playerIdx, idx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const cur = frogPos[playerIdx];
  if (idx === cur) return;
  const curVal = currentRow.values[cur];
  if (curVal == null) return; // 이미 깃발 위
  if (idx === cur + curVal || idx === cur - curVal) {
    frogPos[playerIdx] = idx;
    if (!visited[playerIdx].includes(idx)) visited[playerIdx].push(idx);
    sound.play('hop');
    renderRow(playerIdx);
    if (idx === currentRow.n - 1) handleSolve(playerIdx);
  } else {
    sound.play('buzz');
  }
}

function resetFrog(playerIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  frogPos[playerIdx] = 0;
  visited[playerIdx] = [0];
  sound.play('reset');
  renderRow(playerIdx);
}

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
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 깃발 도착! 🏁`;
    for (let i = 0; i < playerCount; i++) if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="bar-score-${i}">0</span>`;
    scoreBar.appendChild(chip);
  }
}
function updateBarScore(idx) { const el = $(`bar-score-${idx}`); if (el) el.textContent = scores[idx]; }

function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');
  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;
    if (timeRemaining <= 5) { problemTimer.classList.add('urgent'); sound.play('tick'); }
    if (timeRemaining <= 0) { clearTimers(); handleTimeout(); }
  }, 1000);
}
function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');
  for (let i = 0; i < playerCount; i++) if (!zoneSolved[i]) getZone(i).classList.add('locked');
  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 도착하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  currentRow = makeRow(ROUND_LEN[roundIdx % ROUND_LEN.length]);
  frogPos = []; visited = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    frogPos.push(0);
    visited.push([0]);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderRow(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '🐸 적힌 수만큼 점프! 깃발🏁까지!';
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
  clearTimers(); buildZones(); buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');
  const max = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { resultTitle.textContent = '무승부!'; resultWinner.textContent = '아무도 깃발에 도착하지 못했어요.'; }
  else if (winners.length === 1) { resultTitle.textContent = '게임 종료!'; resultWinner.textContent = `${PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', '); resultTitle.textContent = '동점!'; resultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i);
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    totalRow.appendChild(chip);
  }
  showScreen(resultScreen);
}

setupPlayerSelect(function (n) { playerCount = n; });
setupSoundToggle(sound, soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
