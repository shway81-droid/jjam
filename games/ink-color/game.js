/* games/ink-color/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const ROUND_TIME      = 45;    // shared seconds for the whole game
const LOCKOUT_MS      = 600;   // brief lockout after a wrong tap
const RESULT_PAUSE_MS = 2200;

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Color palette (fixed 5) ──────────────────────────────────
// id, Korean color word, ink hex used to paint text / swatch.
const COLORS = [
  { id: 'red',    name: '빨강', hex: '#E53935' },
  { id: 'blue',   name: '파랑', hex: '#1E88E5' },
  { id: 'yellow', name: '노랑', hex: '#FDD835' },
  { id: 'green',  name: '초록', hex: '#43A047' },
  { id: 'purple', name: '보라', hex: '#8E24AA' },
];

const N_OPTIONS = 4; // answer swatch count per prompt

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let scores        = [];
let zoneState     = [];   // per player: { word, ink, options, locked }
let phase         = 'idle';
let roundTimer    = null;
let nextHandle    = null;
let lockHandles   = [];

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
const problemTimer  = document.getElementById('problemTimer');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introIllust   = document.getElementById('introIllust');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const totalRow      = document.getElementById('totalRow');

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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (roundTimer) { roundTimer.stop(); roundTimer = null; }
  if (nextHandle)  { clearTimeout(nextHandle); nextHandle = null; }
  lockHandles.forEach(h => clearTimeout(h));
  lockHandles = [];
}

// ── Build a Stroop prompt ────────────────────────────────────
// Returns { word, ink, options }. word = the COLOR WORD shown (meaning);
// ink = the color the word is PRINTED in (the correct answer);
// options = N color objects including ink, the rest distinct distractors.
// Bias toward conflict trials: word.id !== ink.id most of the time.
function makePrompt() {
  // Choose the ink color (the correct answer) freely.
  const ink = COLORS[Math.floor(Math.random() * COLORS.length)];

  // Choose the word. ~85% conflict: word meaning differs from ink color.
  let word;
  if (Math.random() < 0.85) {
    const others = COLORS.filter(c => c.id !== ink.id);
    word = others[Math.floor(Math.random() * others.length)];
  } else {
    word = ink; // occasional congruent trial keeps it honest
  }

  // Build options: ink (correct, exactly once) + distinct distractors.
  // Distractors are different colors from the ink, so ONLY ink is correct.
  const distractors = shuffle(COLORS.filter(c => c.id !== ink.id)).slice(0, N_OPTIONS - 1);
  const options = shuffle([ink].concat(distractors));

  return { word: word, ink: ink, options: options };
}

// ── Intro illustration: a color word in a different ink color ─
function renderIntroIllust() {
  introIllust.innerHTML = `<svg viewBox="0 0 210 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="198" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <text x="105" y="56" text-anchor="middle" font-size="34" font-weight="900" fill="#1E88E5">빨강</text>
    <g>
      <rect x="20"  y="80" width="40" height="30" rx="7" fill="#E53935" stroke="#2C2C2C" stroke-width="2.5"/>
      <rect x="68"  y="80" width="40" height="30" rx="7" fill="#1E88E5" stroke="#2C2C2C" stroke-width="2.5"/>
      <rect x="116" y="80" width="40" height="30" rx="7" fill="#FDD835" stroke="#2C2C2C" stroke-width="2.5"/>
      <rect x="164" y="80" width="26" height="30" rx="7" fill="#43A047" stroke="#2C2C2C" stroke-width="2.5"/>
      <rect x="64" y="76" width="48" height="38" rx="10" fill="none" stroke="#EC407A" stroke-width="4" stroke-dasharray="5 3"/>
    </g>
    <text x="88" y="126" text-anchor="middle" font-size="11" font-weight="900" fill="#EC407A">글자 색은 파랑!</text>
  </svg>`;
}
renderIntroIllust();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

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

    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `<span class="prompt-word" id="prompt-word-${i}">?</span>`;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(card);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
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

// ── New prompt for one zone (independent & continuous) ───────
function newPrompt(playerIdx) {
  const prompt = makePrompt();
  zoneState[playerIdx] = {
    word: prompt.word,
    ink: prompt.ink,
    options: prompt.options,
    locked: false,
  };

  // Render the Stroop word: meaning = word.name, painted in ink color.
  const wordEl = document.getElementById(`prompt-word-${playerIdx}`);
  if (wordEl) {
    wordEl.textContent = prompt.word.name;
    wordEl.style.color = prompt.ink.hex;
  }

  // Render answer swatches.
  const grid = document.getElementById(`answer-grid-${playerIdx}`);
  if (!grid) return;
  grid.innerHTML = '';
  prompt.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.player = String(playerIdx);
    btn.dataset.color = opt.id;
    btn.setAttribute('aria-label', `P${playerIdx + 1} ${opt.name}`);
    btn.innerHTML = `
      <span class="answer-swatch" style="background:${opt.hex}"></span>
      <span class="answer-name">${opt.name}</span>
    `;
    onTap(btn, () => handleAnswer(playerIdx, opt.id, btn));
    grid.appendChild(btn);
  });

  const zone = getZone(playerIdx);
  if (zone) zone.classList.remove('locked-zone');
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone) {
  if (!zone) return;
  const rect  = zone.getBoundingClientRect();
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = rect.width / 2 + 'px';
  r.style.top    = rect.height / 2 + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

function spawnFlash(zone, text, cls) {
  if (!zone) return;
  const f = document.createElement('div');
  f.className = `score-flash ${cls}`;
  f.textContent = text;
  zone.appendChild(f);
  f.addEventListener('animationend', () => f.remove());
}

// ── Answer handler ───────────────────────────────────────────
function handleAnswer(playerIdx, chosenColor, btn) {
  if (phase !== 'active') return;
  const st = zoneState[playerIdx];
  if (!st || st.locked) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone);

  // Correct answer = the INK color the word is printed in.
  if (chosenColor === st.ink.id) {
    sound.play('ding');
    btn.classList.add('state-correct');
    scores[playerIdx]++;
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);
    spawnFlash(zone, '+1', 'plus');
    // Fresh prompt immediately so the zone runs continuously.
    setTimeout(() => { if (phase === 'active') newPrompt(playerIdx); }, 120);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    spawnFlash(zone, '잠금', 'lock');
    st.locked = true;
    if (zone) zone.classList.add('locked-zone');

    const h = setTimeout(() => {
      if (phase === 'active') newPrompt(playerIdx);
    }, LOCKOUT_MS);
    lockHandles.push(h);
  }
}

// ── Timer ────────────────────────────────────────────────────
function startRoundTimer() {
  problemTimer.textContent = ROUND_TIME;
  problemTimer.classList.remove('urgent');

  roundTimer = createTimer(ROUND_TIME, function (remaining) {
    problemTimer.textContent = remaining;
    if (remaining <= 5) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }
  }, function () {
    endGame();
  });
  roundTimer.start();
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  scores      = new Array(playerCount).fill(0);
  zoneState   = new Array(playerCount).fill(null);
  phase       = 'active';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);

  for (let i = 0; i < playerCount; i++) {
    newPrompt(i);
    updateScoreChip(i);
    updateBarScore(i);
  }
  startRoundTimer();
}

// ── End game ─────────────────────────────────────────────────
function endGame() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Lock all zones.
  for (let i = 0; i < playerCount; i++) {
    const zone = getZone(i);
    if (zone) zone.classList.add('locked-zone');
    if (zoneState[i]) zoneState[i].locked = true;
  }

  nextHandle = setTimeout(() => showResult(), getAutoplayPauseMs(RESULT_PAUSE_MS));
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
