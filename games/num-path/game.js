/* games/num-path/game.js — 패턴 C (퍼즐 병렬 경쟁) — 숫자 길 (Numbrix 스타일) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 보드 크기 (rows=cols)와 단서 비율 (난이도 점증)
const ROUND_SIZE = [4, 4, 5];
const ROUND_CLUE_RATIO = [0.45, 0.40, 0.42];

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

// ── Pure puzzle generator + validator (테스트 가능, DOM 비의존) ──
// 좌표 인덱스: cell index = r * size + c. 값: 경로상 위치(1..size*size).

const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// 격자 위 해밀턴 경로를 무작위 DFS/백트래킹으로 생성.
// 반환: 길이 size*size 의 cell-index 배열 (방문 순서). 항상 성공할 때까지 재시도.
function generateHamiltonianPath(size) {
  const total = size * size;

  function attempt(startIdx) {
    const visited = new Array(total).fill(false);
    const path = [];

    function dfs(idx) {
      visited[idx] = true;
      path.push(idx);
      if (path.length === total) return true;

      const r = Math.floor(idx / size);
      const c = idx % size;
      const order = shuffleInPlace(DIRS4.slice());
      for (const [dr, dc] of order) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const nIdx = nr * size + nc;
        if (visited[nIdx]) continue;
        if (dfs(nIdx)) return true;
      }

      // 백트래킹
      visited[idx] = false;
      path.pop();
      return false;
    }

    return dfs(startIdx) ? path : null;
  }

  // 무작위 시작 칸으로 시도, 실패하면 다른 시작점으로 재시도.
  for (let tries = 0; tries < 200; tries++) {
    const startIdx = Math.floor(Math.random() * total);
    const path = attempt(startIdx);
    if (path) return path;
  }
  // 실질적으로 도달 불가(4x4·5x5는 항상 성공). 안전망.
  throw new Error('Hamiltonian path generation failed for size ' + size);
}

// 경로가 모든 칸을 정확히 한 번씩, 직교 인접 단계로 덮는지 검증.
function verifyPath(path, size) {
  const total = size * size;
  if (path.length !== total) return false;
  const seen = new Set();
  for (const idx of path) {
    if (idx < 0 || idx >= total) return false;
    if (seen.has(idx)) return false;
    seen.add(idx);
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const ar = Math.floor(a / size), ac = a % size;
    const br = Math.floor(b / size), bc = b % size;
    const md = Math.abs(ar - br) + Math.abs(ac - bc);
    if (md !== 1) return false;
  }
  return true;
}

// 퍼즐 생성: solution[idx] = 1..total (경로상 위치). clue[idx] = boolean.
// 항상 1 과 total 을 단서로 공개, 추가로 비율만큼 중간 단서 공개.
function generatePuzzle(size, clueRatio) {
  const total = size * size;
  const path = generateHamiltonianPath(size);
  if (!verifyPath(path, size)) {
    // 안전망: 재귀 재생성
    return generatePuzzle(size, clueRatio);
  }

  const solution = new Array(total);
  path.forEach((cellIdx, pos) => { solution[cellIdx] = pos + 1; });

  // 단서로 공개할 "값" 집합. 항상 1 과 total 포함.
  const clueValues = new Set([1, total]);
  const targetCount = Math.max(2, Math.round(total * clueRatio));
  const candidates = shuffleInPlace(
    Array.from({ length: total }, (_, i) => i + 1).filter(v => v !== 1 && v !== total)
  );
  let ci = 0;
  while (clueValues.size < targetCount && ci < candidates.length) {
    clueValues.add(candidates[ci++]);
  }

  const clue = new Array(total).fill(false);
  for (let idx = 0; idx < total; idx++) {
    if (clueValues.has(solution[idx])) clue[idx] = true;
  }

  return { size, total, solution, clue };
}

// 배치 규칙: 빈 칸에 K를 놓을 수 있으려면
//  - K-1 이 있는 칸과 직교 인접해야 하고(K>1),
//  - K+1 이 이미 보드에 존재하면 그 칸과도 직교 인접해야 한다.
// board[idx] = 값 또는 0(빈 칸). 인덱스를 받아 유효성 판단.
function indexOfValue(board, val) {
  for (let i = 0; i < board.length; i++) if (board[i] === val) return i;
  return -1;
}

function isAdjacent(size, a, b) {
  const ar = Math.floor(a / size), ac = a % size;
  const br = Math.floor(b / size), bc = b % size;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

function canPlace(board, size, idx, val) {
  if (board[idx] !== 0) return false;
  if (val > 1) {
    const prevIdx = indexOfValue(board, val - 1);
    if (prevIdx === -1) return false; // 아직 K-1 미배치
    if (!isAdjacent(size, idx, prevIdx)) return false;
  }
  const total = size * size;
  if (val < total) {
    const nextIdx = indexOfValue(board, val + 1);
    if (nextIdx !== -1 && !isAdjacent(size, idx, nextIdx)) return false;
  }
  return true;
}

// 보드에 아직 없는 가장 작은 값 (next number).
function smallestMissing(board, total) {
  for (let v = 1; v <= total; v++) {
    if (indexOfValue(board, v) === -1) return v;
  }
  return total + 1; // 완성됨
}

// 정답 경로를 배치 규칙대로 그대로 재생할 때 항상 완성되는지(=풀 수 있는지) 검증.
function verifySolvableByReplay(puzzle) {
  const { size, total, solution, clue } = puzzle;
  const board = new Array(total).fill(0);
  for (let idx = 0; idx < total; idx++) if (clue[idx]) board[idx] = solution[idx];

  let guard = 0;
  while (true) {
    const next = smallestMissing(board, total);
    if (next > total) return true; // 모두 채워짐
    // next 가 들어가야 할 정답 칸
    const targetIdx = solution.indexOf(next);
    if (!canPlace(board, size, targetIdx, next)) return false;
    board[targetIdx] = next;
    if (++guard > total + 5) return false; // 안전망
  }
}

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zoneBoard = [];      // 각 플레이어의 board (값 배열, 0=빈칸)
let zoneClue = [];       // 각 플레이어의 clue 배열 (불변, 공유 복제)
let zonePlaced = [];     // 각 플레이어가 직접 놓은 순서 스택 [idx,...] (undo용)
let zoneSolved = [];
let curSize = 4;
let curSolution = null;  // 라운드 공통 정답 (디버그/참고용)
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;

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

// ── Build zones (각 zone에 동일 퍼즐 보드를 복제) ──────────────
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
      <span class="zone-next" id="next-${i}">다음: 1</span>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'np-board';
    board.id = `np-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`np-board-${playerIdx}`);
  if (!board) return;
  const values = zoneBoard[playerIdx];
  const clue = zoneClue[playerIdx];
  const total = curSize * curSize;
  const placed = zonePlaced[playerIdx];
  const lastPlacedIdx = placed.length ? placed[placed.length - 1] : -1;

  board.style.gridTemplateColumns = `repeat(${curSize}, 1fr)`;
  // 칸 글자 크기: 보드 폭/그리드에 맞춰 clamp
  board.style.setProperty('--np-size', curSize);
  board.innerHTML = '';

  for (let idx = 0; idx < total; idx++) {
    const cell = document.createElement('div');
    const v = values[idx];
    let cls = 'np-cell';
    if (v === 0) {
      cls += ' empty';
    } else if (clue[idx]) {
      cls += ' clue';
    } else {
      cls += ' filled';
      if (idx === lastPlacedIdx) cls += ' last';
    }
    cell.className = cls;
    cell.textContent = v === 0 ? '' : v;
    cell.dataset.player = playerIdx;
    cell.dataset.idx = idx;
    onTap(cell, () => handleCellTap(playerIdx, idx));
    board.appendChild(cell);
  }
}

function updateNextChip(playerIdx) {
  const el = document.getElementById(`next-${playerIdx}`);
  if (!el) return;
  const total = curSize * curSize;
  const next = smallestMissing(zoneBoard[playerIdx], total);
  el.textContent = next > total ? '완성!' : `다음: ${next}`;
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

  const board = zoneBoard[playerIdx];
  const clue = zoneClue[playerIdx];
  const total = curSize * curSize;

  // 단서 칸은 절대 조작 불가
  if (clue[idx]) { sound.play('buzz'); return; }

  // 이미 플레이어가 놓은 칸을 탭 → UNDO (가장 최근에 놓은 칸만 가능)
  if (board[idx] !== 0) {
    const placed = zonePlaced[playerIdx];
    if (placed.length && placed[placed.length - 1] === idx) {
      placed.pop();
      board[idx] = 0;
      sound.play('undo');
      renderBoard(playerIdx);
      updateNextChip(playerIdx);
    } else {
      sound.play('buzz');
    }
    return;
  }

  // 빈 칸 → 다음 숫자 배치 시도
  const next = smallestMissing(board, total);
  if (next > total) return;

  if (canPlace(board, curSize, idx, next)) {
    board[idx] = next;
    zonePlaced[playerIdx].push(idx);
    sound.play('place');
    renderBoard(playerIdx);
    updateNextChip(playerIdx);

    if (smallestMissing(board, total) > total) {
      handleSolve(playerIdx);
    }
  } else {
    sound.play('buzz');
  }
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
    if (!zoneSolved[i]) {
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
  curSize = ROUND_SIZE[roundIdx];

  // 라운드당 한 번 퍼즐 생성 → 모든 zone에 복제 (공정)
  const puzzle = generatePuzzle(curSize, ROUND_CLUE_RATIO[roundIdx]);
  curSolution = puzzle.solution;

  zoneBoard = [];
  zoneClue = [];
  zonePlaced = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    const board = new Array(puzzle.total).fill(0);
    for (let idx = 0; idx < puzzle.total; idx++) {
      if (puzzle.clue[idx]) board[idx] = puzzle.solution[idx];
    }
    zoneBoard.push(board);
    zoneClue.push(puzzle.clue.slice());
    zonePlaced.push([]);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateNextChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `${curSize}×${curSize} 판을 1부터 차례로 채우세요!`;

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

// ── Test hook (Node 환경에서만 export; 브라우저 무영향) ─────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateHamiltonianPath, verifyPath, generatePuzzle,
    canPlace, smallestMissing, verifySolvableByReplay, isAdjacent,
  };
}
