/* games/heavy-order/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const TIMEOUT_MS       = 8000;   // 8 seconds per question (transitive reasoning)
const RESULT_PAUSE_MS  = 1900;   // pause before next question

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Question pool ────────────────────────────────────────────
// 이행추론(transitive reasoning): 저울로 잰 무게 힌트 A>B·B>C·C>D 를 이어 생각해
// 가장 무거운(또는 가장 가벼운) 하나를 고른다. 힌트는 순서를 섞어 제시해 스스로 잇게 한다.
// 힌트만으로 순서가 하나로 확정되므로 정답은 유일하다(보기 4개 모두 순서에 포함).
// `q`는 HTML(힌트 · 로 구분 + <br> + 질문 <b>)로 렌더한다.
const HINT = '🔎 저울로 재보니…<br>';
const QUESTION_POOL = [
  { q: HINT + '토끼 &gt; 다람쥐 · 사자 &gt; 토끼 · 코끼리 &gt; 사자<br><b>가장 무거운 동물은?</b>', a: '코끼리', o: ['사자', '토끼', '다람쥐'] },
  { q: HINT + '고양이 &gt; 쥐 · 하마 &gt; 돼지 · 돼지 &gt; 고양이<br><b>가장 무거운 동물은?</b>', a: '하마', o: ['돼지', '고양이', '쥐'] },
  { q: HINT + '늑대 &gt; 여우 · 여우 &gt; 토끼 · 곰 &gt; 늑대<br><b>가장 가벼운 동물은?</b>', a: '토끼', o: ['곰', '늑대', '여우'] },
  { q: HINT + '말 &gt; 양 · 기린 &gt; 말 · 양 &gt; 닭<br><b>가장 무거운 동물은?</b>', a: '기린', o: ['말', '양', '닭'] },
  { q: HINT + '오리 &gt; 참새 · 소 &gt; 염소 · 염소 &gt; 오리<br><b>가장 가벼운 동물은?</b>', a: '참새', o: ['소', '염소', '오리'] },
  { q: HINT + '사슴 &gt; 너구리 · 낙타 &gt; 사슴 · 너구리 &gt; 고슴도치<br><b>가장 무거운 동물은?</b>', a: '낙타', o: ['사슴', '너구리', '고슴도치'] },
  { q: HINT + '상어 &gt; 문어 · 고래 &gt; 상어 · 문어 &gt; 새우<br><b>가장 무거운 바다 친구는?</b>', a: '고래', o: ['상어', '문어', '새우'] },
  { q: HINT + '악어 &gt; 거북 · 공룡 &gt; 악어 · 거북 &gt; 개구리<br><b>가장 가벼운 동물은?</b>', a: '개구리', o: ['공룡', '악어', '거북'] },
  { q: HINT + '파랑 &gt; 초록 · 빨강 &gt; 파랑 · 초록 &gt; 노랑<br><b>가장 무거운 상자는?</b>', a: '빨강', o: ['파랑', '초록', '노랑'] },
  { q: HINT + '주황 &gt; 노랑 · 보라 &gt; 주황 · 노랑 &gt; 초록<br><b>가장 가벼운 상자는?</b>', a: '초록', o: ['보라', '주황', '노랑'] },
  { q: HINT + '멜론 &gt; 사과 · 수박 &gt; 멜론 · 사과 &gt; 포도<br><b>가장 무거운 과일은?</b>', a: '수박', o: ['멜론', '사과', '포도'] },
  { q: HINT + '양배추 &gt; 당근 · 호박 &gt; 양배추 · 당근 &gt; 딸기<br><b>가장 가벼운 것은?</b>', a: '딸기', o: ['호박', '양배추', '당근'] },
  { q: HINT + '축구공 &gt; 야구공 · 볼링공 &gt; 축구공 · 야구공 &gt; 탁구공<br><b>가장 무거운 공은?</b>', a: '볼링공', o: ['축구공', '야구공', '탁구공'] },
  { q: HINT + '세탁기 &gt; 전자레인지 · 냉장고 &gt; 세탁기 · 전자레인지 &gt; 선풍기<br><b>가장 무거운 물건은?</b>', a: '냉장고', o: ['세탁기', '전자레인지', '선풍기'] },
  { q: HINT + '책상 &gt; 의자 · 피아노 &gt; 책상 · 의자 &gt; 연필<br><b>가장 가벼운 물건은?</b>', a: '연필', o: ['피아노', '책상', '의자'] },
  { q: HINT + '버스 &gt; 자동차 · 기차 &gt; 버스 · 자동차 &gt; 자전거<br><b>가장 무거운 탈것은?</b>', a: '기차', o: ['버스', '자동차', '자전거'] },
  { q: HINT + '트럭 &gt; 오토바이 · 배 &gt; 트럭 · 오토바이 &gt; 킥보드<br><b>가장 가벼운 탈것은?</b>', a: '킥보드', o: ['배', '트럭', '오토바이'] },
  { q: HINT + '표범 &gt; 살쾡이 · 사자 &gt; 표범 · 살쾡이 &gt; 쥐<br><b>가장 무거운 동물은?</b>', a: '사자', o: ['표범', '살쾡이', '쥐'] },
  { q: HINT + '독수리 &gt; 비둘기 · 타조 &gt; 독수리 · 비둘기 &gt; 참새<br><b>가장 가벼운 새는?</b>', a: '참새', o: ['타조', '독수리', '비둘기'] },
  { q: HINT + '말 &gt; 돼지 · 황소 &gt; 말 · 돼지 &gt; 닭<br><b>가장 무거운 동물은?</b>', a: '황소', o: ['말', '돼지', '닭'] },
  { q: HINT + '멧돼지 &gt; 토끼 · 곰 &gt; 멧돼지 · 토끼 &gt; 다람쥐<br><b>가장 가벼운 동물은?</b>', a: '다람쥐', o: ['곰', '멧돼지', '토끼'] },
  { q: HINT + '얼룩말 &gt; 양 · 코뿔소 &gt; 얼룩말 · 양 &gt; 토끼<br><b>가장 무거운 동물은?</b>', a: '코뿔소', o: ['얼룩말', '양', '토끼'] },
  { q: HINT + '돌멩이 &gt; 조약돌 · 벽돌 &gt; 돌멩이 · 조약돌 &gt; 모래알<br><b>가장 가벼운 것은?</b>', a: '모래알', o: ['벽돌', '돌멩이', '조약돌'] },
  { q: HINT + '배구공 &gt; 테니스공 · 농구공 &gt; 배구공 · 테니스공 &gt; 구슬<br><b>가장 무거운 공은?</b>', a: '농구공', o: ['배구공', '테니스공', '구슬'] },
  { q: HINT + '돌고래 &gt; 참치 · 고래 &gt; 돌고래 · 참치 &gt; 멸치<br><b>가장 가벼운 바다 친구는?</b>', a: '멸치', o: ['고래', '돌고래', '참치'] },
  { q: HINT + '게 &gt; 새우 · 문어 &gt; 게 · 새우 &gt; 고둥<br><b>가장 무거운 바다 친구는?</b>', a: '문어', o: ['게', '새우', '고둥'] },
  { q: HINT + '가방 &gt; 필통 · 책 &gt; 가방 · 필통 &gt; 지우개<br><b>가장 가벼운 것은?</b>', a: '지우개', o: ['책', '가방', '필통'] },
  { q: HINT + '수레 &gt; 바구니 · 손수레 &gt; 수레 · 바구니 &gt; 봉지<br><b>가장 무거운 것은?</b>', a: '손수레', o: ['수레', '바구니', '봉지'] },
  { q: HINT + '호랑이 &gt; 늑대 · 곰 &gt; 호랑이 · 늑대 &gt; 여우<br><b>가장 무거운 동물은?</b>', a: '곰', o: ['호랑이', '늑대', '여우'] },
  { q: HINT + '수박 &gt; 참외 · 참외 &gt; 귤 · 귤 &gt; 방울토마토<br><b>가장 가벼운 과일은?</b>', a: '방울토마토', o: ['수박', '참외', '귤'] },
  { q: HINT + '돼지 &gt; 오리 · 소 &gt; 돼지 · 오리 &gt; 병아리<br><b>가장 무거운 동물은?</b>', a: '소', o: ['돼지', '오리', '병아리'] },
  { q: HINT + '통나무 &gt; 나뭇가지 · 나뭇가지 &gt; 나뭇잎 · 나뭇잎 &gt; 깃털<br><b>가장 가벼운 것은?</b>', a: '깃털', o: ['통나무', '나뭇가지', '나뭇잎'] },
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
  problemExpr.innerHTML = currentQuestion.q;

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
