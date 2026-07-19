/* games/sea-life/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const TIMEOUT_MS       = 6500;   // per question
const RESULT_PAUSE_MS  = 1900;   // pause before next question

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Question pool ────────────────────────────────────────────
// 4지선다: 문제 대상 → 보기 4개(정답 1 + 오답 3, 서로 중복 없음).
const QUESTION_POOL = [
  { q: "둥근 머리에 다리가 여덟 개이고 먹물을 뿜어요.", a: "문어", o: ["게", "새우", "조개"] },
  { q: "이빨이 날카롭고 바다에서 가장 무서운 물고기예요.", a: "상어", o: ["고등어", "새우", "불가사리"] },
  { q: "똑똑하고 사람과 잘 노는, 등이 굽은 바다 포유류예요.", a: "돌고래", o: ["게", "조개", "해파리"] },
  { q: "바다에서 가장 큰 동물로 물을 뿜어 올려요.", a: "고래", o: ["새우", "게", "불가사리"] },
  { q: "옆으로 걷고 집게발을 가진 바다 동물이에요.", a: "게", o: ["문어", "고래", "해파리"] },
  { q: "다리가 열 개이고 길쭉하며 먹물을 뿜어요.", a: "오징어", o: ["게", "불가사리", "조개"] },
  { q: "몸이 투명하고 흐물흐물하며 쏘기도 해요.", a: "해파리", o: ["게", "상어", "조개"] },
  { q: "별처럼 팔이 다섯 개 달린 바다 동물이에요.", a: "불가사리", o: ["문어", "새우", "고래"] },
  { q: "딱딱한 껍데기 두 짝 속에 사는 바다 동물이에요.", a: "조개", o: ["상어", "돌고래", "해파리"] },
  { q: "등에 단단한 껍데기를 지고 헤엄치는 바다 동물이에요.", a: "바다거북", o: ["상어", "게", "새우"] },
  { q: "몸을 동그랗게 부풀려 가시를 세우는 물고기예요.", a: "복어", o: ["고등어", "새우", "조개"] },
  { q: "작고 등이 굽었으며 긴 수염이 있는 바다 동물이에요.", a: "새우", o: ["상어", "고래", "거북"] },
  { q: "남극에 살며 날지 못하고 뒤뚱뒤뚱 걷는 새예요.", a: "펭귄", o: ["갈매기", "상어", "돌고래"] },
  { q: "통조림으로도 먹는, 등지느러미로 빠르게 헤엄치는 큰 물고기예요.", a: "참치", o: ["해파리", "조개", "불가사리"] },
  { q: "길고 미끄러운 몸으로 뱀처럼 헤엄치는 바닷물고기예요.", a: "장어", o: ["게", "조개", "불가사리"] },
  { q: "집게발이 크고 맛있어 잔치에 쓰는 바다 동물이에요.", a: "바닷가재", o: ["해파리", "조개", "펭귄"] },
  { q: "바닷가 위를 날며 \"끼룩끼룩\" 우는 새예요.", a: "갈매기", o: ["펭귄", "상어", "문어"] },
  { q: "바위에 붙어 사는, 꽃처럼 생긴 바다 동물이에요.", a: "말미잘", o: ["문어", "새우", "조개"] },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let questionIdx   = 0;
let scores        = [];
let questionLog   = [];      // { q, answer, winnerIdx, dqSet, timedOut }
let currentQuestion = null;  // { q, choices:[], answerIdx }
let dqSet         = new Set();
let phase         = 'idle';
let timeoutHandle = null;
let nextHandle    = null;
let gameQuestions = [];

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
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(item) {
  const choices = shuffle([item.a, item.o[0], item.o[1], item.o[2]]);
  const answerIdx = choices.indexOf(item.a);
  return { q: item.q, choices: choices, answerIdx: answerIdx };
}

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

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

  const zone   = getZone(playerIdx);
  spawnRipple(zone, window.event || null);

  const correct = slotIdx === currentQuestion.answerIdx;

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
      q:         currentQuestion.q,
      answer:    currentQuestion.choices[currentQuestion.answerIdx],
      winnerIdx,
      dqSet:     new Set(dqSet),
      timedOut:  false,
    });
  } else {
    const timedOut = !Array.from({ length: playerCount }, (_, i) => i).every(i => dqSet.has(i));

    if (timedOut) {
      sound.play('timeout');
      problemStatus.textContent = `시간 초과 ⏱`;
      problemExpr.classList.add('timeout-flash');
      setTimeout(() => problemExpr.classList.remove('timeout-flash'), 400);
      revealAnswer();
    } else {
      sound.play('timeout');
      problemStatus.textContent = '모두 실격 😅';
      revealAnswer();
    }

    questionLog.push({
      q:         currentQuestion.q,
      answer:    currentQuestion.choices[currentQuestion.answerIdx],
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
      if (Number(btn.dataset.slot) === currentQuestion.answerIdx) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      }
    });
  }
}

// ── Question flow ─────────────────────────────────────────────
function startGame() {
  gameQuestions = shuffle(QUESTION_POOL).slice(0, TOTAL_QUESTIONS);
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

  const item = gameQuestions[questionIdx];
  questionIdx++;
  dqSet   = new Set();
  phase   = 'idle';

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

  currentQuestion = buildQuestion(item);
  problemExpr.textContent = currentQuestion.q;

  setTimeout(() => {
    populateAnswers(currentQuestion);
    phase = 'active';

    timeoutHandle = setTimeout(() => {
      if (phase === 'active') {
        resolveQuestion(-1, null);
      }
    }, TIMEOUT_MS);
  }, 300);
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

  if (maxScore === 0) {
    resultTitle.textContent  = '😅 게임 종료!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
    resultWinner.style.color = '#5C6BC0';
  } else if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! 🎉`;
    resultWinner.style.color = cfg.dot;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} 🎉`;
    resultWinner.style.color = '#5C6BC0';
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
      <td style="font-size:0.8rem;font-weight:800">${q.answer}</td>
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
