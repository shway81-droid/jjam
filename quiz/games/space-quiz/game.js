/* games/space-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const TIMEOUT_MS       = 6000;   // 6 seconds per question (text quiz)
const RESULT_PAUSE_MS  = 1900;   // pause before next question

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Question pool ────────────────────────────────────────────
// { q: 문제, a: 정답, o: [오답 3개] }  — 정답이 하나로 확정되도록 구성
const QUESTION_POOL = [
  { q: '태양에서 가장 가까운 행성은?', a: '수성', o: ['금성', '지구', '화성'] },
  { q: '태양계에서 가장 큰 행성은?', a: '목성', o: ['토성', '지구', '화성'] },
  { q: "'붉은 행성'이라고 불리는 행성은?", a: '화성', o: ['금성', '목성', '수성'] },
  { q: '우리가 살고 있는 행성은?', a: '지구', o: ['화성', '금성', '수성'] },
  { q: '밤하늘에서 스스로 빛을 내는 것은?', a: '별', o: ['달', '행성', '혜성'] },
  { q: '지구 주위를 도는 지구의 위성은?', a: '달', o: ['태양', '화성', '별똥별'] },
  { q: '태양계의 행성은 모두 몇 개일까?', a: '8개', o: ['7개', '9개', '10개'] },
  { q: '아름다운 고리를 가진 행성은?', a: '토성', o: ['목성', '지구', '수성'] },
  { q: '태양계의 한가운데에 있는 것은?', a: '태양', o: ['지구', '달', '목성'] },
  { q: '지구가 태양 둘레를 한 바퀴 도는 데 걸리는 시간은?', a: '1년', o: ['하루', '한 달', '1시간'] },
  { q: '지구가 스스로 한 바퀴 도는 데 걸리는 시간은?', a: '하루(24시간)', o: ['1년', '한 달', '일주일'] },
  { q: '낮과 밤이 생기는 까닭은?', a: '지구의 자전', o: ['달의 모양 변화', '태양의 폭발', '별의 이동'] },
  { q: '달의 보이는 모양이 날마다 바뀌는 것을 무엇이라 할까?', a: '달의 위상', o: ['일식', '자전', '유성'] },
  { q: '사람을 태우고 우주로 나가는 것은?', a: '우주선', o: ['잠수함', '비행기', '기차'] },
  { q: '우주에서 지구 둘레를 도는 인공 기계는?', a: '인공위성', o: ['등대', '전봇대', '풍력발전기'] },
  { q: '태양에서 가장 멀리 있는 행성은?', a: '해왕성', o: ['천왕성', '목성', '화성'] },
  { q: '밤하늘에 긴 꼬리를 그리며 나타나는 것은?', a: '혜성', o: ['태양', '달', '은하'] },
  { q: '수많은 별들이 모여 이루는 거대한 무리는?', a: '은하', o: ['행성', '위성', '운석'] },
  { q: '우리 은하를 다른 말로 무엇이라 부를까?', a: '은하수', o: ['안드로메다', '오리온', '북두칠성'] },
  { q: '달에 처음 발자국을 남긴 우주인은 어느 나라 사람일까?', a: '미국', o: ['한국', '일본', '프랑스'] },
  { q: '우주에서 우주복을 꼭 입어야 하는 까닭은?', a: '우주에는 공기가 없어서', o: ['우주가 더워서', '멋있어서', '무거워지려고'] },
  { q: '스스로 빛을 내지 못하고 태양 빛을 반사하는 것은?', a: '행성', o: ['항성', '태양', '별자리'] },
  { q: '북쪽 밤하늘에서 방향을 찾을 때 도움을 주는 별은?', a: '북극성', o: ['샛별', '태양', '달'] },
  { q: '국자 모양으로 보이는 일곱 개의 별은?', a: '북두칠성', o: ['오리온자리', '삼태성', '카시오페이아'] },
  { q: '해가 달에 가려 보이지 않게 되는 현상은?', a: '일식', o: ['월식', '자전', '공전'] },
  { q: '달이 지구의 그림자에 가려지는 현상은?', a: '월식', o: ['일식', '유성', '혜성'] },
  { q: '지구에서 가장 가까이 있는 별은?', a: '태양', o: ['북극성', '달', '시리우스'] },
  { q: '우주 공간의 특징으로 알맞은 것은?', a: '공기가 없다', o: ['비가 자주 온다', '바람이 분다', '숲이 있다'] },
  { q: "'별똥별'이라고도 부르는 것은?", a: '유성', o: ['행성', '위성', '은하'] },
  { q: '태양계 행성 중 가장 작은 행성은?', a: '수성', o: ['지구', '목성', '토성'] },
  { q: "'샛별'이라고도 불리며 새벽·저녁에 밝게 보이는 행성은?", a: '금성', o: ['화성', '토성', '해왕성'] },
  { q: '우주를 자세히 관찰할 때 쓰는 도구는?', a: '망원경', o: ['현미경', '돋보기', '청진기'] },
  { q: '태양에서 멀리 떨어진 해왕성 같은 행성의 특징은?', a: '매우 춥다', o: ['매우 뜨겁다', '숲이 많다', '물고기가 산다'] },
  { q: '지구, 화성, 목성처럼 태양 둘레를 도는 천체를 무엇이라 할까?', a: '행성', o: ['별자리', '유성', '우주선'] },
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
