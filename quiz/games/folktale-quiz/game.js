/* games/folktale-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const TIMEOUT_MS       = 7000;   // per question
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
  { q: "착한 아우는 박에서 금이, 욕심쟁이 형은 벌이 나온 이야기는?", a: "흥부와 놀부", o: ["콩쥐팥쥐", "심청전", "토끼와 거북"] },
  { q: "계모에게 구박받다 원님을 만나 행복해진 착한 소녀 이야기는?", a: "콩쥐팥쥐", o: ["흥부와 놀부", "별주부전", "해와 달이 된 오누이"] },
  { q: "눈먼 아버지를 위해 몸을 바쳤다가 왕비가 된 효녀 이야기는?", a: "심청전", o: ["흥부와 놀부", "콩쥐팥쥐", "토끼와 거북"] },
  { q: "느리지만 꾸준한 거북이 잠든 사이에 이긴 이야기는?", a: "토끼와 거북", o: ["흥부와 놀부", "심청전", "금도끼 은도끼"] },
  { q: "호랑이를 피해 하늘로 올라가 해와 달이 된 남매 이야기는?", a: "해와 달이 된 오누이", o: ["콩쥐팥쥐", "흥부와 놀부", "별주부전"] },
  { q: "연못에 도끼를 빠뜨린 나무꾼에게 산신령이 상을 준 이야기는?", a: "금도끼 은도끼", o: ["토끼와 거북", "심청전", "흥부와 놀부"] },
  { q: "용왕의 병을 고치려 토끼의 간을 구하러 간 자라 이야기는?", a: "별주부전", o: ["콩쥐팥쥐", "심청전", "해와 달이 된 오누이"] },
  { q: "나무꾼이 옷을 숨겨 선녀를 아내로 맞은 이야기는?", a: "선녀와 나무꾼", o: ["흥부와 놀부", "콩쥐팥쥐", "토끼와 거북"] },
  { q: "호랑이가 곶감을 무서워해 도망친 이야기는?", a: "호랑이와 곶감", o: ["심청전", "흥부와 놀부", "별주부전"] },
  { q: "하늘에서 내려온 단군이 세웠다는 우리나라 첫 나라 이야기는?", a: "단군 신화", o: ["흥부와 놀부", "콩쥐팥쥐", "토끼와 거북"] },
  { q: "도깨비에게 혹을 떼인 혹부리 영감 이야기는?", a: "혹부리 영감", o: ["흥부와 놀부", "심청전", "토끼와 거북"] },
  { q: "팥죽 할머니가 여러 친구들과 힘을 합쳐 호랑이를 물리친 이야기는?", a: "팥죽 할머니와 호랑이", o: ["콩쥐팥쥐", "흥부와 놀부", "심청전"] },
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
