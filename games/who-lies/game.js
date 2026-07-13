/* games/who-lies/game.js — 패턴 A (4지선다 동시반응) — 누가 거짓말? (진술 일관성 추리) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 10;    // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount    = 2;
let roundIdx       = 0;
let scores         = [];
let roundLog       = [];
let currentProblem = null;   // { display, answerStr, choices[] }
let currentChoices = [];
let dqSet          = new Set();
let phase          = 'idle';
let timerHandle    = null;
let nextHandle     = null;
let timeRemaining  = ROUND_TIME;
let gameRounds     = [];

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
const problemTimer  = document.getElementById('problemTimer');
const wordDisplay   = document.getElementById('wordDisplay');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
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

function randInt(min, max) {   // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

// ── 문제 생성 (거짓말쟁이 찾기) ──────────────────────────────
// 용의자 4명 중 한 명이 사고를 쳤다(숨은 범인 c). 각자 한 문장씩 말하는데
// "정확히 한 명만 거짓말"이라는 전제로 거짓말한 사람을 찾는다.
//
// 각 진술은 범인 c에 대한 참/거짓이 결정되는 술어(pred(c))로 표현한다.
//   deny  : "나는 안 그랬어!"     → 참 iff c !== 나
//   accuse: "○○가 그랬어!"        → 참 iff c === 대상
//   clear : "○○는 안 그랬어!"      → 참 iff c !== 대상
// 자기참조·메타("○○는 거짓말이야")는 배제해 술어가 오직 c에만 의존하게 한다.
//
// 생성 후 브루트포스로 검증한다: 후보 범인 c마다 거짓 진술 수를 센다.
//   유효 범인 = 거짓 진술이 '정확히 1개'인 c. 유효 범인이 '유일'할 때만 채택.
//   → 그때 거짓말쟁이(정답)도 유일하게 결정된다(모호성 원천 차단).

const SUSPECT_POOL = [
  { emoji: '🐰', name: '토끼' },
  { emoji: '🐱', name: '고양이' },
  { emoji: '🐶', name: '강아지' },
  { emoji: '🐻', name: '곰' },
  { emoji: '🐼', name: '판다' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🐯', name: '호랑이' },
  { emoji: '🐵', name: '원숭이' },
];

const DEEDS = [
  { emoji: '🍰', phrase: '케이크를 먹었' },
  { emoji: '🥛', phrase: '우유를 쏟았' },
  { emoji: '🪟', phrase: '유리창을 깼' },
  { emoji: '🖍️', phrase: '벽에 낙서했' },
  { emoji: '🍪', phrase: '쿠키를 가져갔' },
  { emoji: '🎈', phrase: '풍선을 터뜨렸' },
];

// 한 용의자에게 무작위 진술을 배정한다. names = 이 문제의 용의자 이름들.
function makeStatement(selfName, names) {
  const others = names.filter(n => n !== selfName);
  const type = randInt(0, 2);
  if (type === 0) {
    return { text: '나는 안 그랬어!', pred: c => c !== selfName };
  } else if (type === 1) {
    const t = others[randInt(0, others.length - 1)];
    return { text: `${t}가 그랬어!`, pred: c => c === t };
  } else {
    const t = others[randInt(0, others.length - 1)];
    return { text: `${t}는 안 그랬어!`, pred: c => c !== t };
  }
}

function buildProblem() {
  let guard = 0;
  while (guard++ < 400) {
    const suspects = shuffle(SUSPECT_POOL).slice(0, 4);
    const names    = suspects.map(s => s.name);
    const deed     = DEEDS[randInt(0, DEEDS.length - 1)];

    // 각 용의자 진술 배정
    const stmts = suspects.map(s => ({ who: s, ...makeStatement(s.name, names) }));

    // 브루트포스 검증: 거짓 진술이 정확히 1개인 범인 후보 수집
    const validCulprits = [];
    for (const c of names) {
      const liars = stmts.filter(st => !st.pred(c));
      if (liars.length === 1) validCulprits.push({ culprit: c, liar: liars[0].who.name });
    }
    // 유효 범인이 유일해야 거짓말쟁이도 유일 → 채택
    if (validCulprits.length !== 1) continue;

    const liarName = validCulprits[0].liar;

    const header = `${deed.emoji} 누가 ${deed.phrase}을까요? <b>(한 명만 거짓말!)</b>`;
    const lines  = stmts.map(st => `${st.who.emoji} ${st.who.name}: “${st.text}”`);
    const display = [header, ...lines].join('<br>');
    const choices = shuffle(names.slice());
    return { display: display, answerStr: liarName, choices: choices };
  }
  // 안전 폴백 (검증된 고정 문제: 강아지가 거짓말)
  return {
    display: '🍰 누가 케이크를 먹었을까요? <b>(한 명만 거짓말!)</b><br>' +
             '🐰 토끼: “나는 안 그랬어!”<br>' +
             '🐱 고양이: “토끼는 안 그랬어!”<br>' +
             '🐶 강아지: “고양이가 그랬어!”<br>' +
             '🐻 곰: “나는 안 그랬어!”',
    answerStr: '강아지',
    choices: shuffle(['토끼', '고양이', '강아지', '곰']),
  };
}

function buildRounds(n) {
  const rounds = [];
  const seen = new Set();
  let guard = 0;
  while (rounds.length < n && guard++ < 500) {
    const p = buildProblem();
    if (seen.has(p.display)) continue;
    seen.add(p.display);
    rounds.push(p);
  }
  return rounds;
}

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

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerBtns(playerIdx) {
  const grid = document.getElementById(`answer-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.answer-btn')) : [];
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

// ── Populate answer buttons for a round ─────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = name;
      btn.setAttribute('aria-label', `P${i + 1} ${name}`);

      btn.innerHTML = `<svg viewBox="0 0 110 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="106" height="40" rx="14" ry="14"
              fill="${PLAYER_CONFIG[i].dot}" opacity="0.18" stroke="${PLAYER_CONFIG[i].dot}" stroke-width="2"/>
        <text x="55" y="28" text-anchor="middle" dominant-baseline="middle"
              font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
              font-size="18" font-weight="800" fill="#222">${name}</text>
      </svg>`;

      onTap(btn, () => handleAnswerTap(i, name, btn));
      grid.appendChild(btn);
    });
  }
}

// ── Reset buttons for new round ──────────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
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
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 2) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenName, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenName === currentProblem.answerStr);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => btn.classList.remove('state-wrong'), 400);

    dqSet.add(playerIdx);
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    getAnswerBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentProblem.answerStr) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답!`;

  roundLog.push({
    display: currentProblem.display,
    answerStr: currentProblem.answerStr,
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

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentProblem.answerStr) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentProblem.answerStr}`;

  roundLog.push({
    display: currentProblem.display,
    answerStr: currentProblem.answerStr,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase          = 'active';
  currentProblem = gameRounds[roundIdx];
  currentChoices = currentProblem.choices;
  dqSet          = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  wordDisplay.innerHTML = currentProblem.display;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateAnswerBtns();
  resetBtnsForRound();
  startCountdown();
}

// ── Next round ───────────────────────────────────────────────
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
  gameRounds  = buildRounds(TOTAL_ROUNDS);
  roundIdx    = 0;
  scores      = new Array(playerCount).fill(0);
  roundLog    = [];
  dqSet       = new Set();
  phase       = 'idle';

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

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>문제</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const shown = log.display.replace(/<br>/g, ' / ');
    let cells = `<td style="text-align:left;font-size:0.72rem;">${idx + 1}. ${shown} → <b>${log.answerStr}</b></td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">-1</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

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
