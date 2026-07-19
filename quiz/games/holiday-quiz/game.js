/* games/holiday-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;     // seconds per round
const RESULT_PAUSE_MS = 2000;  // pause before next round

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1', btnFill: '#0277BD' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2', btnFill: '#C62828' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3', btnFill: '#2E7D32' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4', btnFill: '#E65100' },
];

// ── Holiday Data ─────────────────────────────────────────────
// front = 설명(단서), answer = 명절, wrongs = 다른 명절 2개
const ALL_PROVERBS = [
  { front: "새해 첫날, 떡국 먹고 세배해요",       answer: "설날",       wrongs: ["추석", "단오"] },
  { front: "한가위, 송편 빚고 성묘 가요",         answer: "추석",       wrongs: ["설날", "한식"] },
  { front: "오곡밥과 부럼을 먹는 첫 보름",        answer: "정월대보름", wrongs: ["추석", "단오"] },
  { front: "창포물에 머리 감고 그네 타요",        answer: "단오",       wrongs: ["추석", "설날"] },
  { front: "밤이 가장 긴 날, 팥죽 먹어요",        answer: "동지",       wrongs: ["단오", "추석"] },
  { front: "찬 음식 먹고 산소 돌보는 날",         answer: "한식",       wrongs: ["단오", "칠석"] },
  { front: "견우직녀가 오작교에서 만나요",        answer: "칠석",       wrongs: ["추석", "동지"] },
  { front: "제비 돌아오는 봄, 화전 부쳐요",       answer: "삼짇날",     wrongs: ["단오", "동지"] },
  { front: "음력 9월 9일, 국화전 먹어요",         answer: "중양절",     wrongs: ["단오", "칠석"] },
  { front: "부처님 오신 날, 연등 달아요",         answer: "초파일",     wrongs: ["단오", "동지"] },
  { front: "한 해 마지막 날, 밤새워 새해 맞이",   answer: "섣달그믐",   wrongs: ["설날", "추석"] },
  { front: "농사일 끝내고 음식 나누는 날",        answer: "백중",       wrongs: ["설날", "추석"] },
  { front: "동쪽 물에 머리 감는 여름 명절",       answer: "유두",       wrongs: ["추석", "설날"] },
  { front: "세배하고 세뱃돈을 받아요",           answer: "설날",       wrongs: ["동지", "한식"] },
  { front: "보름달 보며 강강술래 해요",          answer: "추석",       wrongs: ["설날", "단오"] },
  { front: "쥐불놀이와 달집태우기를 해요",        answer: "정월대보름", wrongs: ["동지", "칠석"] },
  { front: "수리취떡 먹고 씨름을 즐겨요",        answer: "단오",       wrongs: ["동지", "한식"] },
  { front: "팥죽 쑤어 나쁜 기운 쫓아요",         answer: "동지",       wrongs: ["설날", "칠석"] },
  { front: "까치·까마귀가 다리를 놓아줘요",       answer: "칠석",       wrongs: ["단오", "설날"] },
  { front: "윷놀이와 널뛰기를 즐겨요",           answer: "설날",       wrongs: ["단오", "칠석"] },
  { front: "차례 지내고 햇과일 나눠요",          answer: "추석",       wrongs: ["동지", "한식"] },
  { front: "더위팔기와 귀밝이술을 해요",         answer: "정월대보름", wrongs: ["단오", "추석"] },
  { front: "'수릿날'이라 부르고 부채 선물",       answer: "단오",       wrongs: ["동지", "설날"] },
  { front: "'작은설', 새알심 나이만큼 먹어요",    answer: "동지",       wrongs: ["한식", "칠석"] },
  { front: "떡국 먹으면 한 살 더 먹어요",        answer: "설날",       wrongs: ["추석", "단오"] },
  { front: "햅쌀로 송편 빚는 큰 명절",           answer: "추석",       wrongs: ["정월대보름", "한식"] },
  { front: "내리는 비는 견우직녀 눈물",          answer: "칠석",       wrongs: ["동지", "단오"] },
  { front: "낮이 다시 길어지기 시작해요",        answer: "동지",       wrongs: ["단오", "추석"] },
  { front: "불을 쓰지 않고 찬밥을 먹어요",        answer: "한식",       wrongs: ["동지", "칠석"] },
  { front: "진달래 화전 부쳐 먹는 봄날",         answer: "삼짇날",     wrongs: ["추석", "동지"] },
  { front: "다리밟기로 다리 튼튼해지길 빌어요",   answer: "정월대보름", wrongs: ["단오", "칠석"] },
  { front: "초여름 '수릿날', 그네뛰기 대회",      answer: "단오",       wrongs: ["동지", "설날"] },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { front, answer, winnerIdx (-1=timeout), dqPlayers[] }
let currentP      = null;  // current item { front, answer, wrongs }
let roundAnswers  = [];    // [{ text, isCorrect }] — 3 shuffled options
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameProverbs  = [];    // 10 randomly selected items

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen   = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn          = document.getElementById('backBtn');
const playBtn          = document.getElementById('playBtn');
const closeBtn         = document.getElementById('closeBtn');
const retryBtn         = document.getElementById('retryBtn');
const homeBtn          = document.getElementById('homeBtn');
const soundToggleIntro = document.getElementById('soundToggleIntro');

const zonesWrap        = document.getElementById('zonesWrap');
const questionCounter  = document.getElementById('questionCounter');
const proverbSvg       = document.getElementById('proverbSvg');
const proverbText      = document.getElementById('proverbText');
const problemStatus    = document.getElementById('problemStatus');
const problemTimer     = document.getElementById('problemTimer');
const scoreBar         = document.getElementById('scoreBar');

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
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundIcon() {
  const el = document.getElementById('soundIconIntro');
  if (!el) return;
  if (sound.isMuted()) {
    el.innerHTML = `
      <path d="M4 8H7L11 5V17L7 14H4V8Z" fill="currentColor"/>
      <line x1="14" y1="9" x2="20" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="20" y1="9" x2="14" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `;
  } else {
    el.innerHTML = `
      <path d="M4 8H7L11 5V17L7 14H4V8Z" fill="currentColor"/>
      <path d="M14 8.5C15 9.5 15 12.5 14 13.5M16 6.5C18.5 8.5 18.5 13.5 16 15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `;
  }
}

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundIcon();
});
updateSoundIcon();

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── SVG button builder ───────────────────────────────────────
// Creates a full-SVG-backed answer button
function buildAnswerSvgBtn(text, fill, playerIdx, answerIdx) {
  const btn = document.createElement('button');
  btn.className = 'answer-btn';
  btn.dataset.player = playerIdx;
  btn.dataset.answerIdx = answerIdx;
  btn.setAttribute('aria-label', text);

  // SVG background
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('btn-bg');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('viewBox', '0 0 200 56');

  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '200');
  rect.setAttribute('height', '56');
  rect.setAttribute('rx', '14');
  rect.setAttribute('fill', fill);

  // Subtle lighter highlight stripe
  const shine = document.createElementNS(svgNS, 'rect');
  shine.setAttribute('x', '0');
  shine.setAttribute('y', '0');
  shine.setAttribute('width', '200');
  shine.setAttribute('height', '24');
  shine.setAttribute('rx', '14');
  shine.setAttribute('fill', 'rgba(255,255,255,0.12)');

  // Drop shadow rect (decorative bottom)
  const shadow = document.createElementNS(svgNS, 'rect');
  shadow.setAttribute('x', '4');
  shadow.setAttribute('y', '50');
  shadow.setAttribute('width', '192');
  shadow.setAttribute('height', '6');
  shadow.setAttribute('rx', '3');
  shadow.setAttribute('fill', 'rgba(0,0,0,0.18)');

  svg.appendChild(shadow);
  svg.appendChild(rect);
  svg.appendChild(shine);
  btn.appendChild(svg);

  // Label
  const label = document.createElement('span');
  label.className = 'btn-label';
  label.textContent = text;
  btn.appendChild(label);

  return btn;
}

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // Answer list container (filled per round)
    const list = document.createElement('div');
    list.className = 'answer-list';
    list.id = `answer-list-${i}`;

    zone.appendChild(header);
    zone.appendChild(list);
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

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left      = x + 'px';
  r.style.top       = y + 'px';
  r.style.width     = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Clue SVG display ─────────────────────────────────────────
// Dynamically adjusts font size + wraps long text in SVG
function renderProverbSvg(frontText) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const displayText = frontText;

  // Measure approximate char count to decide layout
  const isLong = displayText.length > 13;
  const svgH   = isLong ? 110 : 90;

  proverbSvg.setAttribute('viewBox', `0 0 300 ${svgH}`);
  proverbSvg.setAttribute('height', String(svgH));

  // Clear existing children
  proverbSvg.innerHTML = '';

  // Background rect
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', '300');
  bg.setAttribute('height', String(svgH));
  bg.setAttribute('rx', '18');
  bg.setAttribute('fill', 'rgba(0,0,0,0.82)');
  proverbSvg.appendChild(bg);

  // Decorative lantern circles on left/right
  const decorLeft = document.createElementNS(svgNS, 'circle');
  decorLeft.setAttribute('cx', '16');
  decorLeft.setAttribute('cy', String(svgH / 2));
  decorLeft.setAttribute('r', '6');
  decorLeft.setAttribute('fill', 'rgba(255,220,150,0.35)');
  proverbSvg.appendChild(decorLeft);

  const decorRight = document.createElementNS(svgNS, 'circle');
  decorRight.setAttribute('cx', '284');
  decorRight.setAttribute('cy', String(svgH / 2));
  decorRight.setAttribute('r', '6');
  decorRight.setAttribute('fill', 'rgba(255,220,150,0.35)');
  proverbSvg.appendChild(decorRight);

  // Text — wrap if long
  if (isLong) {
    const mid    = Math.ceil(displayText.length / 2);
    const spaceI = displayText.indexOf(' ', mid);
    const cutRaw = spaceI > -1 ? spaceI : mid;
    const line1  = displayText.slice(0, cutRaw).trim();
    const line2  = displayText.slice(cutRaw).trim();
    const longest = Math.max(line1.length, line2.length);
    const fontSize = longest > 15 ? 16 : (longest > 12 ? 18 : 20);

    [line1, line2].forEach((line, idx) => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', '150');
      t.setAttribute('y', String(idx === 0 ? svgH / 2 - 12 : svgH / 2 + 16));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', '#FFFFFF');
      t.setAttribute('font-size', String(fontSize));
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-family', "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif");
      t.textContent = line;
      proverbSvg.appendChild(t);
    });
  } else {
    const fontSize = displayText.length > 10 ? 20 : 24;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', '150');
    t.setAttribute('y', String(svgH / 2));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', '#FFFFFF');
    t.setAttribute('font-size', String(fontSize));
    t.setAttribute('font-weight', 'bold');
    t.setAttribute('font-family', "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif");
    t.textContent = displayText;
    proverbSvg.appendChild(t);
  }
}

// ── Populate answer buttons for a round ─────────────────────
function populateAnswerButtons() {
  for (let i = 0; i < playerCount; i++) {
    const list = document.getElementById(`answer-list-${i}`);
    if (!list) continue;
    list.innerHTML = '';

    const cfg = PLAYER_CONFIG[i];

    roundAnswers.forEach((opt, ansIdx) => {
      const btn = buildAnswerSvgBtn(opt.text, cfg.btnFill, i, ansIdx);
      onTap(btn, (e) => handleAnswerTap(i, ansIdx, btn, e));
      list.appendChild(btn);
    });
  }
}

function getAnswerBtns(playerIdx) {
  const list = document.getElementById(`answer-list-${playerIdx}`);
  return list ? list.querySelectorAll('.answer-btn') : [];
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }
    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Disable / enable answer buttons ─────────────────────────
function setPlayerBtnsDisabled(playerIdx, disabled) {
  const btns = getAnswerBtns(playerIdx);
  btns.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else          btn.classList.remove('state-disabled');
  });
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled  = false;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');

    if (dqSet.has(i)) {
      setPlayerBtnsDisabled(i, true);
      if (zone) zone.classList.add('dq-zone');
    }
  }
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, answerIdx, btn, e) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, e);

  const isCorrect = roundAnswers[answerIdx].isCorrect;

  if (isCorrect) {
    resolveRound(playerIdx, answerIdx);
  } else {
    // Wrong answer
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => {
      btn.classList.remove('state-wrong');
    }, 350);

    dqSet.add(playerIdx);

    // Deduct 1 (floor 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    // Penalty flash
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '-1';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // Disable this player's buttons
    setPlayerBtnsDisabled(playerIdx, true);
    if (zone) zone.classList.add('dq-zone');

    // Check all-DQ → timeout
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 350);
    }
  }
}

// ── Correct answer ───────────────────────────────────────────
function resolveRound(winnerIdx, correctAnsIdx) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Show correct on winner's zone
  const winnerBtns = getAnswerBtns(winnerIdx);
  winnerBtns.forEach((btn, idx) => {
    if (idx === correctAnsIdx) btn.classList.add('state-correct');
    else btn.classList.add('state-disabled');
    btn.disabled = true;
  });

  // Dim all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      const btns = getAnswerBtns(i);
      btns.forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winLabel} 정답!`;

  roundLog.push({
    front: currentP.front,
    answer: currentP.answer,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // Reveal correct answer on all zones
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach((btn, idx) => {
      if (roundAnswers[idx].isCorrect) btn.classList.add('state-reveal');
      else btn.classList.add('state-disabled');
      btn.disabled = true;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentP.answer}`;

  roundLog.push({
    front: currentP.front,
    answer: currentP.answer,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase    = 'active';
  currentP = gameProverbs[roundIdx];
  dqSet    = new Set();

  // Build shuffled answer options
  roundAnswers = shuffle([
    { text: currentP.answer,    isCorrect: true  },
    { text: currentP.wrongs[0], isCorrect: false },
    { text: currentP.wrongs[1], isCorrect: false },
  ]);

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  renderProverbSvg(currentP.front);
  populateAnswerButtons();
  resetBtnsForRound();

  startCountdown();
}

// ── Next round ────────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  gameProverbs = shuffle(ALL_PROVERBS).slice(0, TOTAL_ROUNDS);
  roundIdx     = 0;
  scores       = new Array(playerCount).fill(0);
  roundLog     = [];
  dqSet        = new Set();
  phase        = 'idle';

  clearTimers();

  buildZones();
  buildScoreBar();

  showScreen(gameScreen);
  loadRound();
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
    resultTitle.textContent  = '아쉬워요!';
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

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>명절</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const front = log.front.length > 10 ? log.front.slice(0, 9) + '…' : log.front;
    let cells = `<td style="text-align:left;font-size:0.78rem;max-width:120px;">
      ${idx + 1}. ${front}<br>
      <span style="font-size:0.7rem;color:#888;">${log.answer}</span>
    </td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">오답</td>`;
      } else {
        cells += `<td class="cell-none">-</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

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
      ${isWin ? '<svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,2 11.5,6.5 17,7.2 13,11 14.2,17 9,14 3.8,17 5,11 1,7.2 6.5,6.5" fill="#F9A825"/></svg>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
