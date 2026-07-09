/* games/dino-quiz/game.js */

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
  { q: "'폭군 도마뱀'이라 불리는 사나운 육식 공룡은?", a: '티라노사우루스', o: ['브라키오사우루스', '트리케라톱스', '스테고사우루스'] },
  { q: '머리에 뿔이 세 개 달린 초식 공룡은?', a: '트리케라톱스', o: ['티라노사우루스', '프테라노돈', '벨로키랍토르'] },
  { q: '목이 아주 길어 높은 나뭇잎을 먹던 초식 공룡은?', a: '브라키오사우루스', o: ['티라노사우루스', '벨로키랍토르', '스테고사우루스'] },
  { q: '등에 커다란 뼈판이 줄지어 있고 꼬리에 가시가 있는 공룡은?', a: '스테고사우루스', o: ['트리케라톱스', '티라노사우루스', '프테라노돈'] },
  { q: '하늘을 날아다니던 날개 달린 익룡은?', a: '프테라노돈', o: ['티라노사우루스', '스테고사우루스', '트리케라톱스'] },
  { q: '온몸이 갑옷 같은 뼈로 덮이고 꼬리에 뭉치가 달린 공룡은?', a: '안킬로사우루스', o: ['스테고사우루스', '브라키오사우루스', '프테라노돈'] },
  { q: '몸집이 작고 빠르며 무리 지어 사냥하던 영리한 육식 공룡은?', a: '벨로키랍토르', o: ['브라키오사우루스', '스테고사우루스', '트리케라톱스'] },
  { q: '머리뼈가 아주 두꺼워 박치기를 했다고 알려진 공룡은?', a: '파키케팔로사우루스', o: ['트리케라톱스', '프테라노돈', '브라키오사우루스'] },
  { q: '풀과 나뭇잎을 먹는 공룡을 무엇이라고 할까?', a: '초식 공룡', o: ['육식 공룡', '잡식 공룡', '날짐승'] },
  { q: '다른 동물을 잡아먹는 공룡을 무엇이라고 할까?', a: '육식 공룡', o: ['초식 공룡', '물고기', '곤충'] },
  { q: '공룡이 새끼를 낳는 방법은?', a: '알을 낳는다', o: ['젖을 먹여 기른다', '새끼를 바로 낳는다', '씨앗으로 퍼진다'] },
  { q: '공룡이 살았던 아주 먼 옛날을 무엇이라고 할까?', a: '중생대', o: ['신생대', '현대', '빙하기'] },
  { q: '땅속에 묻힌 공룡의 뼈나 흔적을 무엇이라고 할까?', a: '화석', o: ['보석', '광물', '지층'] },
  { q: '공룡을 연구하고 화석을 발굴하는 과학자를 무엇이라 할까?', a: '고생물학자', o: ['천문학자', '요리사', '우주비행사'] },
  { q: '공룡은 지금도 지구에 살고 있을까?', a: '아니요, 멸종했어요', o: ['네, 도시에 살아요', '네, 바다에 살아요', '네, 동물원에 있어요'] },
  { q: '티라노사우루스의 특징으로 알맞은 것은?', a: '앞발이 아주 작다', o: ['목이 매우 길다', '등에 뼈판이 있다', '날개가 있다'] },
  { q: '안킬로사우루스가 적을 물리칠 때 쓰던 것은?', a: '꼬리 끝의 뭉치', o: ['긴 목', '날개', '뿔 세 개'] },
  { q: '다음 중 하늘을 날 수 있었던 것은?', a: '프테라노돈', o: ['스테고사우루스', '트리케라톱스', '브라키오사우루스'] },
  { q: '다음 중 목이 가장 긴 공룡은?', a: '브라키오사우루스', o: ['벨로키랍토르', '트리케라톱스', '스테고사우루스'] },
  { q: '공룡은 어떤 무리에 가까운 동물일까?', a: '파충류', o: ['포유류', '어류', '곤충'] },
  { q: '공룡이 사라진(멸종한) 까닭으로 널리 알려진 것은?', a: '커다란 운석 충돌', o: ['사람들이 사냥해서', '먹이가 너무 많아져서', '겨울잠을 자다가'] },
  { q: '다음 중 육식 공룡은?', a: '티라노사우루스', o: ['브라키오사우루스', '스테고사우루스', '트리케라톱스'] },
  { q: '다음 중 초식 공룡은?', a: '트리케라톱스', o: ['티라노사우루스', '벨로키랍토르', '알로사우루스'] },
  { q: '벨로키랍토르는 주로 어떻게 사냥했을까?', a: '무리를 지어 함께', o: ['혼자 잠수해서', '하늘을 날며', '나무 위에서'] },
  { q: "공룡 이름에 붙는 '사우루스'는 무슨 뜻일까?", a: '도마뱀', o: ['공룡', '괴물', '새'] },
  { q: '알에서 갓 나온 공룡을 무엇이라 부를까?', a: '새끼 공룡', o: ['어른 공룡', '화석', '알'] },
  { q: '트리케라톱스의 먹이로 알맞은 것은?', a: '풀과 나뭇잎', o: ['다른 공룡', '물고기', '곤충'] },
  { q: '스테고사우루스 등에 있는 넓적한 뼈판은 주로 어떤 일을 했을까?', a: '몸을 지키고 체온 조절', o: ['하늘을 나는 데', '헤엄치는 데', '땅을 파는 데'] },
  { q: '프테라노돈은 무엇을 하며 살았을까?', a: '하늘을 날았다', o: ['땅속을 팠다', '겨울잠을 잤다', '바닷속에서만 살았다'] },
  { q: '티라노사우루스의 먹이로 알맞은 것은?', a: '다른 동물(고기)', o: ['풀', '나뭇잎', '씨앗'] },
  { q: '공룡 화석은 주로 어디에서 발견될까?', a: '땅속(지층) 바위', o: ['하늘의 구름', '바다 위', '나무 꼭대기'] },
  { q: '트리케라톱스가 적으로부터 몸을 지킬 때 쓰던 것은?', a: '머리의 뿔', o: ['꼬리의 뭉치', '등의 뼈판', '큰 날개'] },
  { q: '다음 중 초식 공룡끼리 묶인 것은?', a: '브라키오사우루스·스테고사우루스', o: ['티라노사우루스·벨로키랍토르', '프테라노돈·티라노사우루스', '벨로키랍토르·알로사우루스'] },
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
