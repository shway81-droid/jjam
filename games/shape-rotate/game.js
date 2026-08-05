/* games/shape-rotate/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const TIMEOUT_MS       = 7000;   // counting the corridor takes thought
const RESULT_PAUSE_MS  = 1800;

const GRID_N = 5;                 // 5x5 maze
const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Player config: label, dot colour, zone bg colour
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount  = 2;
let difficulty   = 'easy';
let questionIdx  = 0;
let scores       = [];
let questionLog  = [];
let currentQuestion = null;      // { html, answer, choices }
let dqSet        = new Set();
let phase        = 'idle';
let timeoutHandle = null;
let nextHandle    = null;

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen    = document.getElementById('gameScreen');
const resultScreen  = document.getElementById('resultScreen');

const backBtn       = document.getElementById('backBtn');
const playBtn       = document.getElementById('playBtn');
const closeBtn      = document.getElementById('closeBtn');
const retryBtn      = document.getElementById('retryBtn');
const homeBtn       = document.getElementById('homeBtn');

const zonesWrap     = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemExpr   = document.getElementById('problemExpr');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle      = document.getElementById('resultTitle');
const resultWinner     = document.getElementById('resultWinner');
const resultTableHead  = document.getElementById('resultTableHead');
const resultTableBody  = document.getElementById('resultTableBody');
const totalRow         = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Maze generation ──────────────────────────────────────────
const cellIdx = (r, c) => r * GRID_N + c;
const inBounds = (r, c) => r >= 0 && r < GRID_N && c >= 0 && c < GRID_N;

function neighborsOf(i) {
  const r = Math.floor(i / GRID_N), c = i % GRID_N;
  const out = [];
  for (const [dr, dc] of NB) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc)) out.push(cellIdx(nr, nc));
  }
  return out;
}

// Build an INDUCED self-avoiding walk: no two non-consecutive path cells are
// orthogonally adjacent. Filling every other cell with walls then leaves the
// path as the ONE and only corridor → step count is unique (no shortcuts).
function buildPath(lenMin, lenMax) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const start = rand(0, GRID_N * GRID_N - 1);
    const path = [start];
    const visited = new Set([start]);
    while (path.length < lenMax) {
      const cur = path[path.length - 1];
      const cands = neighborsOf(cur).filter(c => {
        if (visited.has(c)) return false;
        for (const v of neighborsOf(c)) {
          if (v !== cur && visited.has(v)) return false; // would create a chord
        }
        return true;
      });
      if (cands.length === 0) break;
      const nx = cands[rand(0, cands.length - 1)];
      path.push(nx);
      visited.add(nx);
    }
    if (path.length >= lenMin) return path;
  }
  return null;
}

function pathRange() {
  const base = difficulty === 'easy' ? 4 : 6;
  const extra = Math.floor((questionIdx - 1) / 4); // grows every 4 questions
  const lenMax = Math.min(GRID_N * GRID_N - 2, base + extra * 2);
  const lenMin = Math.max(3, lenMax - 2);
  return { lenMin, lenMax };
}

// rotate a 3x3 boolean matrix 90deg clockwise
function rot90(m){
  const r = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) r[j][2-i] = m[i][j];
  return r;
}
function matEq(a,b){
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) if (a[i][j]!==b[i][j]) return false;
  return true;
}
function gridHtml(m, cls){
  let cells='';
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    cells += `<span class="rot-cell ${m[i][j]? 'on':'off'}"></span>`;
  }
  return `<div class="rot-grid ${cls||''}">${cells}</div>`;
}
function genBase(){
  // random asymmetric shape of 3-4 filled cells whose 4 rotations are all distinct
  for (let t=0;t<300;t++){
    const m=[[0,0,0],[0,0,0],[0,0,0]];
    const cellsN = rand(3,4);
    let placed=0, guard=0;
    while(placed<cellsN && guard<50){ guard++; const i=rand(0,2), j=rand(0,2); if(!m[i][j]){m[i][j]=1;placed++;} }
    const r1=rot90(m), r2=rot90(r1), r3=rot90(r2);
    const all=[m,r1,r2,r3];
    let distinct=true;
    for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) if(matEq(all[a],all[b])) distinct=false;
    if(distinct) return m;
  }
  // fallback known-asymmetric L shape
  return [[1,0,0],[1,0,0],[1,1,0]];
}
function generateQuestion(){
  const base = genBase();
  const rots = [base, rot90(base), rot90(rot90(base)), rot90(rot90(rot90(base)))]; // 0,90,180,270
  // ask angle: easy -> 90 or 180, normal -> 90/180/270
  const angleOptions = (typeof difficulty!=='undefined' && difficulty==='normal') ? [1,2,3] : [1,2];
  const turns = angleOptions[rand(0, angleOptions.length-1)]; // index into rots
  const target = rots[turns];
  // candidate display: show all 4 distinct rotations in shuffled order, labeled 가/나/다/라
  const labels = ['가','나','다','라'];
  const order = shuffle([0,1,2,3].slice());
  let answer = '가';
  let candHtml = '';
  order.forEach((rotIdx, pos) => {
    if (matEq(rots[rotIdx], target)) answer = labels[pos];
    candHtml += `<div class="rot-cand"><span class="rot-cand-label">${labels[pos]}</span>${gridHtml(rots[rotIdx])}</div>`;
  });
  const turnTxt = turns===1 ? '90°' : turns===2 ? '180°' : '270°';
  const html =
    `<div class="rot-wrap">` +
      `<div class="rot-base">${gridHtml(base,'big')}<div class="rot-turn">↻ ${turnTxt}</div></div>` +
      `<div class="rot-cands">${candHtml}</div>` +
    `</div>`;
  const choices = ['가','나','다','라'];
  return { html, answer, choices };
}

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Difficulty selection ─────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn,  () => startCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    for (let j = 0; j < 4; j++) {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.slot   = j;
      btn.textContent    = '?';
      onTap(btn, () => handleAnswerTap(i, j, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerBtns(playerIdx) {
  return zonesWrap.querySelectorAll(`.answer-btn[data-player="${playerIdx}"]`);
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Build score bar ──────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
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

// ── Populate answer buttons for a question ───────────────────
function populateAnswers(question) {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach((btn, j) => {
      btn.textContent = question.choices[j];
      btn.className   = 'answer-btn';
      btn.disabled    = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
  }
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : e;
  const x     = (touch ? touch.clientX : rect.left + rect.width / 2)  - rect.left;
  const y     = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = Math.max(rect.width, rect.height) + 'px';
  r.style.marginLeft = r.style.marginTop = `-${Math.max(rect.width, rect.height) / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, slotIdx, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, typeof event !== 'undefined' ? event : null);

  const chosen  = currentQuestion.choices[slotIdx];
  const correct = chosen === currentQuestion.answer;

  if (correct) {
    resolveQuestion(playerIdx, btn);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    disqualifyPlayer(playerIdx);
  }
}

function disqualifyPlayer(playerIdx) {
  if (dqSet.has(playerIdx)) return;
  dqSet.add(playerIdx);

  scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
  updateScoreChip(playerIdx);
  updateBarScore(playerIdx);

  const zone = getZone(playerIdx);
  if (zone) {
    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());
  }

  getAnswerBtns(playerIdx).forEach(b => {
    b.classList.add('state-disabled');
    b.disabled = true;
  });

  const allDQ = Array.from({ length: playerCount }, (_, i) => i).every(i => dqSet.has(i));
  if (allDQ) {
    resolveQuestion(-1, null);
  }
}

// ── Resolve a question ───────────────────────────────────────
function resolveQuestion(winnerIdx, winBtn) {
  if (phase !== 'active') return;
  clearTimers();
  phase = 'result';

  if (winnerIdx >= 0) {
    sound.play('ding');
    scores[winnerIdx]++;
    updateScoreChip(winnerIdx);
    updateBarScore(winnerIdx);

    if (winBtn) winBtn.classList.add('state-correct');

    const cfg = PLAYER_CONFIG[winnerIdx];
    problemStatus.textContent = `${cfg.label} 정답! 🎉`;

    questionLog.push({
      answer:    currentQuestion.answer,
      winnerIdx,
      dqSet:     new Set(dqSet),
      timedOut:  false,
    });
  } else {
    const timedOut = !Array.from({ length: playerCount }, (_, i) => i).every(i => dqSet.has(i));

    if (timedOut) {
      sound.play('timeout');
      problemStatus.textContent = `시간 초과 ⏱`;
      revealAnswer();
    } else {
      sound.play('timeout');
      problemStatus.textContent = '모두 실격 😅';
    }

    questionLog.push({
      answer:    currentQuestion.answer,
      winnerIdx: -1,
      dqSet:     new Set(dqSet),
      timedOut,
    });
  }

  nextHandle = setTimeout(nextQuestion, RESULT_PAUSE_MS);
}

function revealAnswer() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach(btn => {
      if (btn.textContent === String(currentQuestion.answer)) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      }
    });
  }
}

// ── Question flow ─────────────────────────────────────────────
function startGame() {
  scores      = new Array(playerCount).fill(0);
  questionLog = [];
  questionIdx = 0;

  showScreen(gameScreen);
  buildZones();
  buildScoreBar();
  nextQuestion();
}

function nextQuestion() {
  if (questionIdx >= TOTAL_QUESTIONS) {
    showResult();
    return;
  }

  questionIdx++;
  dqSet = new Set();
  phase = 'idle';

  questionCounter.textContent = `${questionIdx} / ${TOTAL_QUESTIONS}`;
  problemStatus.textContent   = '';

  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (z) z.classList.remove('dq-zone');
    getAnswerBtns(i).forEach(b => {
      b.className = 'answer-btn';
      b.disabled  = false;
      b.textContent = '?';
    });
  }

  currentQuestion = generateQuestion();
  problemExpr.innerHTML = currentQuestion.html;

  setTimeout(() => {
    populateAnswers(currentQuestion);
    phase = 'active';

    timeoutHandle = setTimeout(() => {
      if (phase === 'active') {
        resolveQuestion(-1, null);
      }
    }, TIMEOUT_MS);
  }, 400);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
  if (nextHandle)    { clearTimeout(nextHandle);    nextHandle    = null; }
}

// ── Result screen ─────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! 🎉`;
    resultWinner.style.color = cfg.dot;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} 🎉`;
    resultWinner.style.color = '#00897B';
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);
  resultTableHead.innerHTML = `
    <tr>
      <th>#</th>
      <th>정답</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.dot}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = questionLog.map((q, ri) => {
    const cells = players.map((_, pi) => {
      if (q.dqSet.has(pi) && q.winnerIdx !== pi) return `<td class="cell-dq">실격</td>`;
      if (q.winnerIdx === pi) return `<td class="cell-win">★</td>`;
      if (q.timedOut)  return `<td class="cell-timeout">시간초과</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr>
      <td>${ri + 1}</td>
      <td style="font-weight:800">${q.answer}</td>
      ${cells}
    </tr>`;
  }).join('');

  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.dot}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
