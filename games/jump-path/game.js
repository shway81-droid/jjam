/* games/jump-path/game.js — 패턴 C (퍼즐 병렬 경쟁) — 숫자 점프
 *
 * 메커니즘: 가로로 늘어선 발판(징검다리)을 따라 깃발까지 가는 경쟁.
 *  - 각 발판에는 숫자 v가 적혀 있고, 그 발판에서는 정확히 v칸 떨어진
 *    발판으로만 점프할 수 있다(왼쪽 i-v 또는 오른쪽 i+v, 범위 안일 때).
 *  - 폰(🦘)은 맨 왼쪽 발판(index 0)에서 시작, 맨 오른쪽 깃발(index L-1)이 목표.
 *  - 현재 발판에서 정확히 v칸 떨어진 발판을 누르면 그 발판으로 점프(place).
 *    그 외 발판을 누르면 무효(buzz).
 *  - 막히면 출발 칸(index 0)을 누르면 언제든 처음으로 돌아간다(lift).
 *  - 깃발에 도착하면 완성. 가장 먼저 도착한 사람이 라운드 승.
 *  - 라운드가 진행될수록 발판이 길어진다(난이도 점증).
 *  - 모든 플레이어는 동일한 레벨을 받는다(공정).
 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 레벨 풀. 각 항목은 발판 값 배열(맨 끝 = 깃발, 값 무시).
// 모든 레벨은 index 0 → index L-1 까지 ±value 점프로 도달 가능(BFS로 재확인).
// 단순히 "오른쪽으로만" 점프하면 막히도록(되돌아가기/선택 필요) 설계.
const LEVEL_POOL = [
  // Round 1: L = 7  (해법에 되돌아가기/선택 필요, 단순 전진은 막힘)
  [
    [5, 6, 3, 1, 2, 2, 0],   // 0->5->3->4->6
    [4, 5, 2, 1, 1, 4, 0],   // 0->4->5->1->6
    [4, 3, 5, 3, 1, 6, 0],   // 0->4->3->6
  ],
  // Round 2: L = 8
  [
    [5, 4, 5, 6, 2, 3, 6, 0], // 0->5->2->7
    [5, 6, 1, 1, 5, 4, 3, 0], // 0->5->1->7
    [3, 4, 5, 1, 4, 6, 3, 0], // 0->3->2->7
  ],
  // Round 3: L = 9
  [
    [7, 4, 8, 8, 2, 8, 2, 3, 0], // 0->7->4->6->8
    [4, 4, 4, 6, 3, 1, 2, 5, 0], // 0->4->7->2->6->8
    [7, 8, 7, 5, 4, 1, 5, 2, 0], // 0->7->5->4->8
  ],
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
    o.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  lift(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
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
let levelValues = [];            // 현재 라운드 발판 값 배열 (모두 공유)
let zonePos = [];                // 각 플레이어 폰의 현재 발판 index
let zoneSolved = [];             // boolean
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let statusTimer = null;

const BASE_STATUS = '발판의 수만큼 점프해서 깃발까지!';
const HINT_STATUS = '막히면 출발 칸을 눌러 처음으로';

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

// ── Level selection & solvability ────────────────────────────
// 그래프 i → i±values[i] 에서 0부터 L-1 도달 가능한지 BFS로 검사.
function isSolvable(values) {
  const L = values.length;
  if (L < 2) return false;
  const goal = L - 1;
  const seen = new Array(L).fill(false);
  const queue = [0];
  seen[0] = true;
  while (queue.length) {
    const i = queue.shift();
    if (i === goal) return true;
    const v = values[i];
    if (v <= 0) continue; // 깃발/0칸에서는 이동 없음
    for (const j of [i + v, i - v]) {
      if (j >= 0 && j < L && !seen[j]) {
        seen[j] = true;
        queue.push(j);
      }
    }
  }
  return false;
}

// 라운드용 레벨을 선택. 무작위로 고르되 풀리는지 확인,
// 안 풀리면 같은 풀의 다음 후보로 폴백.
function pickLevel(round) {
  const candidates = LEVEL_POOL[round];
  const start = Math.floor(Math.random() * candidates.length);
  for (let k = 0; k < candidates.length; k++) {
    const lvl = candidates[(start + k) % candidates.length];
    if (isSolvable(lvl)) return lvl.slice();
  }
  // 풀의 어떤 후보도 못 풀면(없어야 함) 첫 후보라도 반환.
  return candidates[0].slice();
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
      <span class="zone-moves" id="left-${i}">🦘</span>
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
  const L = levelValues.length;
  const pos = zonePos[playerIdx];
  const curVal = levelValues[pos];
  board.innerHTML = '';

  for (let i = 0; i < L; i++) {
    const stone = document.createElement('div');
    stone.className = 'jp-stone';
    if (i === 0) stone.classList.add('start');
    if (i === L - 1) stone.classList.add('goal');

    if (i === L - 1) {
      // 깃발(목표)
      const flag = document.createElement('span');
      flag.className = 'jp-num';
      flag.textContent = '🚩';
      stone.appendChild(flag);
    } else {
      const num = document.createElement('span');
      num.className = 'jp-num';
      num.textContent = levelValues[i];
      stone.appendChild(num);
    }

    // 현재 발판 강조 + 점프 가능 발판 강조
    if (i === pos) {
      stone.classList.add('current', 'has-pawn');
      const pawn = document.createElement('span');
      pawn.className = 'jp-pawn';
      pawn.textContent = '🦘';
      stone.appendChild(pawn);
    } else if (curVal > 0 && (i === pos + curVal || i === pos - curVal)) {
      stone.classList.add('reachable');
    }

    stone.dataset.idx = i;
    onTap(stone, () => handleStoneTap(playerIdx, i));
    board.appendChild(stone);
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

// ── Interaction ──────────────────────────────────────────────
function handleStoneTap(playerIdx, targetIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;

  const pos = zonePos[playerIdx];

  // 출발 칸(index 0)은 언제든 처음으로 리셋
  if (targetIdx === 0) {
    if (pos === 0) return; // 이미 출발 칸
    zonePos[playerIdx] = 0;
    sound.play('lift');
    renderBoard(playerIdx);
    return;
  }

  const v = levelValues[pos];
  // 현재 발판에서 정확히 v칸 떨어진 발판만 유효
  if (v > 0 && (targetIdx === pos + v || targetIdx === pos - v)) {
    zonePos[playerIdx] = targetIdx;
    sound.play('place');
    renderBoard(playerIdx);
    if (isSolved(playerIdx)) handleSolve(playerIdx);
    return;
  }

  // 그 외 → 무효
  sound.play('buzz');
  flashStatus('정확히 그 수만큼 떨어진 칸으로!');
}

function isSolved(playerIdx) {
  return zonePos[playerIdx] === levelValues.length - 1;
}

function flashStatus(msg) {
  problemStatus.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (phase === 'active') problemStatus.textContent = HINT_STATUS;
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
  problemStatus.textContent = `시간 초과! 아무도 도착하지 못했어요`;

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  levelValues = pickLevel(roundIdx);

  zonePos = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zonePos.push(0);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = BASE_STATUS;

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
