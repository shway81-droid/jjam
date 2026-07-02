/* games/block-fit/game.js — 패턴 C (퍼즐 병렬 경쟁) — 조각 채우기
 *
 * 메커니즘: 빈 격자판을 여러 조각(폴리오미노)으로 빈틈없이 채우는 경쟁.
 *  - 라운드마다 격자를 무작위로 분할해 조각 트레이를 만든다(분할에서 생성 →
 *    항상 해가 존재). 모든 플레이어는 동일한 퍼즐을 받는다(공정).
 *  - 조각을 골라(트레이) 빈 칸을 누르면, 그 칸을 기준점으로 조각이 놓인다.
 *  - 이미 놓인 조각 칸을 누르면 다시 트레이로 빼낸다.
 *  - 격자를 전부 채우면 완성. 가장 먼저 채운 사람이 라운드 승.
 *  - 라운드가 진행될수록 격자가 커진다(난이도 점증).
 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

// 라운드별 격자 크기 [rows, cols] — 난이도 점증
const ROUND_GRIDS = [
  [4, 4],
  [5, 4],
  [5, 5],
];

// 조각 색 (파스텔, id별 일관 — 같은 조각은 항상 같은 색)
const PIECE_COLORS = [
  '#90CAF9', '#A5D6A7', '#FFCC80', '#EF9A9A',
  '#CE93D8', '#80DEEA', '#FFAB91', '#C5E1A5',
  '#F48FB1', '#B0BEC5',
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
let playerCount = 2;
let roundIdx = 0;
let scores = [];                 // round wins per player
let roundResults = [];           // [{winnerIdx, timedOut}]
let rows = 4, cols = 4;          // 현재 라운드 격자 크기
let zoneGrid = [];               // each player's rows×cols grid (pieceId | null)
let zonePieces = [];             // each player's piece list
let zoneSel = [];                // each player's selected piece id or null
let zoneSolved = [];             // boolean
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let statusTimer = null;

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
// 격자를 무작위로 폴리오미노(3~5칸)로 분할한다. 셀을 행우선으로 순회하며
// 아직 배정 안 된 셀을 씨앗으로 영역을 키운다. 행우선 최소 셀이 씨앗이 되므로
// 그 셀이 조각의 기준점(origin)이 된다 → 항상 원래 분할대로 채울 해가 존재.
function generatePuzzle(r, c) {
  const grid = Array.from({ length: r }, () => new Array(c).fill(-1));
  const inB = (rr, cc) => rr >= 0 && rr < r && cc >= 0 && cc < c;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const pieces = [];
  let id = 0;

  for (let rr = 0; rr < r; rr++) {
    for (let cc = 0; cc < c; cc++) {
      if (grid[rr][cc] !== -1) continue;
      const target = 3 + Math.floor(Math.random() * 3); // 3..5
      const cells = [{ r: rr, c: cc }];
      grid[rr][cc] = id;

      while (cells.length < target) {
        const frontier = [];
        for (const cell of cells) {
          for (const [dr, dc] of DIRS) {
            const nr = cell.r + dr, nc = cell.c + dc;
            if (inB(nr, nc) && grid[nr][nc] === -1) frontier.push({ r: nr, c: nc });
          }
        }
        if (!frontier.length) break;
        const pick = frontier[Math.floor(Math.random() * frontier.length)];
        grid[pick.r][pick.c] = id;
        cells.push(pick);
      }

      // origin = 씨앗(행우선 최소). shape = origin 기준 상대 좌표.
      const origin = cells[0];
      const shape = cells.map(cell => ({ dr: cell.r - origin.r, dc: cell.c - origin.c }));
      let minDc = 0, maxDc = 0, maxDr = 0;
      shape.forEach(s => {
        if (s.dc < minDc) minDc = s.dc;
        if (s.dc > maxDc) maxDc = s.dc;
        if (s.dr > maxDr) maxDr = s.dr;
      });
      pieces.push({
        id,
        shape,                         // [{dr,dc}], origin = {0,0}
        bboxW: maxDc - minDc + 1,
        bboxH: maxDr + 1,
        bboxMinDc: minDc,
        color: PIECE_COLORS[id % PIECE_COLORS.length],
      });
      id++;
    }
  }

  // 트레이 표시 순서를 섞는다(원래 위치를 바로 안 보이게).
  const order = pieces.map(p => p.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return { pieces, order };
}

// 동일 퍼즐을 각 플레이어 상태로 복제
function clonePuzzleToZone(puzzle) {
  const pieces = puzzle.order.map(pid => {
    const src = puzzle.pieces[pid];
    return {
      id: src.id,
      shape: src.shape.map(s => ({ dr: s.dr, dc: s.dc })),
      bboxW: src.bboxW,
      bboxH: src.bboxH,
      bboxMinDc: src.bboxMinDc,
      color: src.color,
      placed: false,
    };
  });
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
  return { pieces, grid };
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
      <span class="zone-moves" id="left-${i}">남은 0</span>
    `;
    zone.appendChild(header);

    const area = document.createElement('div');
    area.className = 'pf-area';
    area.id = `pf-area-${i}`;

    const board = document.createElement('div');
    board.className = 'pf-board';
    board.id = `pf-board-${i}`;
    area.appendChild(board);

    const tray = document.createElement('div');
    tray.className = 'pf-tray';
    tray.id = `pf-tray-${i}`;
    area.appendChild(tray);

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

  const colorById = {};
  zonePieces[playerIdx].forEach(p => { colorById[p.id] = p.color; });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const pid = grid[r][c];
      cell.className = 'pf-cell' + (pid === null ? ' empty' : ' filled');
      if (pid !== null) cell.style.background = colorById[pid];
      cell.dataset.r = r;
      cell.dataset.c = c;
      onTap(cell, () => handleCellTap(playerIdx, r, c));
      board.appendChild(cell);
    }
  }
}

function renderTray(playerIdx) {
  const tray = document.getElementById(`pf-tray-${playerIdx}`);
  if (!tray) return;
  const sel = zoneSel[playerIdx];
  tray.innerHTML = '';

  zonePieces[playerIdx].forEach(piece => {
    if (piece.placed) return;
    const slot = document.createElement('div');
    slot.className = 'pf-piece' + (sel === piece.id ? ' selected' : '');
    slot.style.gridTemplateColumns = `repeat(${piece.bboxW}, 1fr)`;
    slot.style.gridTemplateRows = `repeat(${piece.bboxH}, 1fr)`;

    // bbox 그리드를 채우되, 조각 셀만 색칠
    const filled = new Set(piece.shape.map(s => `${s.dr},${s.dc - piece.bboxMinDc}`));
    for (let r = 0; r < piece.bboxH; r++) {
      for (let c = 0; c < piece.bboxW; c++) {
        const mini = document.createElement('div');
        if (filled.has(`${r},${c}`)) {
          mini.className = 'pf-mini on';
          mini.style.background = piece.color;
        } else {
          mini.className = 'pf-mini off';
        }
        slot.appendChild(mini);
      }
    }
    onTap(slot, () => handlePieceTap(playerIdx, piece.id));
    tray.appendChild(slot);
  });
}

function updateLeftChip(playerIdx) {
  const el = document.getElementById(`left-${playerIdx}`);
  if (el) {
    const remaining = zonePieces[playerIdx].filter(p => !p.placed).length;
    el.textContent = `남은 ${remaining}`;
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
function handlePieceTap(playerIdx, pieceId) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const piece = zonePieces[playerIdx].find(p => p.id === pieceId);
  if (!piece || piece.placed) return;
  // 토글 선택
  zoneSel[playerIdx] = (zoneSel[playerIdx] === pieceId) ? null : pieceId;
  sound.play('pick');
  renderTray(playerIdx);
}

function handleCellTap(playerIdx, r, c) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const grid = zoneGrid[playerIdx];
  const occupant = grid[r][c];

  // 이미 놓인 조각 칸 → 빼내기
  if (occupant !== null) {
    liftPiece(playerIdx, occupant);
    return;
  }

  // 빈 칸 → 선택된 조각을 그 칸을 기준점으로 놓기
  const sel = zoneSel[playerIdx];
  if (sel === null) {
    sound.play('buzz');
    flashStatus('먼저 아래에서 조각을 골라요');
    return;
  }
  tryPlace(playerIdx, sel, r, c);
}

function tryPlace(playerIdx, pieceId, baseR, baseC) {
  const grid = zoneGrid[playerIdx];
  const piece = zonePieces[playerIdx].find(p => p.id === pieceId);
  if (!piece || piece.placed) return;

  // 절대 좌표 계산 + 유효성 검사
  const abs = [];
  for (const s of piece.shape) {
    const rr = baseR + s.dr;
    const cc = baseC + s.dc;
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || grid[rr][cc] !== null) {
      sound.play('buzz');
      return; // 맞지 않음
    }
    abs.push({ r: rr, c: cc });
  }

  // 배치
  abs.forEach(a => { grid[a.r][a.c] = pieceId; });
  piece.placed = true;
  zoneSel[playerIdx] = null;
  sound.play('place');

  renderBoard(playerIdx);
  renderTray(playerIdx);
  updateLeftChip(playerIdx);

  if (isSolved(playerIdx)) handleSolve(playerIdx);
}

function liftPiece(playerIdx, pieceId) {
  const grid = zoneGrid[playerIdx];
  const piece = zonePieces[playerIdx].find(p => p.id === pieceId);
  if (!piece || !piece.placed) return;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === pieceId) grid[r][c] = null;
    }
  }
  piece.placed = false;
  zoneSel[playerIdx] = pieceId; // 빼낸 조각을 바로 선택 상태로
  sound.play('lift');

  renderBoard(playerIdx);
  renderTray(playerIdx);
  updateLeftChip(playerIdx);
}

function isSolved(playerIdx) {
  return zonePieces[playerIdx].every(p => p.placed);
}

function flashStatus(msg) {
  problemStatus.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (phase === 'active') problemStatus.textContent = '조각을 골라 빈 칸을 채우세요!';
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
  zonePieces = [];
  zoneSel = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    const cl = clonePuzzleToZone(puzzle);
    zonePieces.push(cl.pieces);
    zoneGrid.push(cl.grid);
    zoneSel.push(null);
    zoneSolved.push(false);

    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    renderTray(i);
    updateLeftChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `조각을 골라 빈 칸을 채우세요!`;

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
