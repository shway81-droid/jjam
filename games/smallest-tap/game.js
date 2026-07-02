/* games/smallest-tap/game.js — 패턴 B — 가장 작은 수 */

'use strict';

// ── Constants ────────────────────────────────────────────────
const GAME_DURATION   = 30;                 // 초
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const CORRECT_FEEDBACK_MS = 280;            // 정답 표시 후 다음 문제까지
const WRONG_FEEDBACK_MS   = 320;            // 오답 표시 후 같은 문제 재개

// 난이도 단계: 경과 시간(초)에 따라 점점 어려워짐.
//   choices: 보기 개수, max: 수 범위 상한, minGap: 최댓값과 2등의 최소 차이
// 후반엔 보기 4개 + 범위 1~99 + 값이 서로 가까워져 가장 작은 수 비교가 까다로움.
const DIFFICULTY = [
  { fromSec: 0,  choices: 3, min: 1, max: 20, minGap: 2 },
  { fromSec: 10, choices: 3, min: 1, max: 50, minGap: 1 },
  { fromSec: 18, choices: 4, min: 1, max: 50, minGap: 1 },
  { fromSec: 25, choices: 4, min: 1, max: 99, minGap: 1 },
];

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const btSound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let btPlayerCount   = 2;
let btScores        = [];
let btSolved        = [];   // per player: 맞힌 문제 수
let btMisses        = [];   // per player: 틀린 횟수
let btPrompts       = [];   // per player: 현재 문제 { values:[], targetIdx }
let btPhase         = 'idle';
let btTimerHandle   = null;
let btTimeRemaining = GAME_DURATION;

// ── DOM refs ─────────────────────────────────────────────────
const btIntroScreen     = document.getElementById('introScreen');
const btCountdownScreen = document.getElementById('countdownScreen');
const btCountdownNumber = document.getElementById('countdownNumber');
const btGameScreen      = document.getElementById('gameScreen');
const btResultScreen    = document.getElementById('resultScreen');

const btBackBtn   = document.getElementById('backBtn');
const btPlayBtn   = document.getElementById('playBtn');
const btCloseBtn  = document.getElementById('closeBtn');
const btRetryBtn  = document.getElementById('retryBtn');
const btHomeBtn   = document.getElementById('homeBtn');

const btZonesWrap       = document.getElementById('zonesWrap');
const btQuestionCounter = document.getElementById('questionCounter');
const btProblemTimer    = document.getElementById('problemTimer');
const btProblemStatus   = document.getElementById('problemStatus');
const btScoreBar        = document.getElementById('scoreBar');

const btSoundToggle     = document.getElementById('soundToggleIntro');

const btResultTitle     = document.getElementById('resultTitle');
const btResultWinner    = document.getElementById('resultWinner');
const btResultTableHead = document.getElementById('resultTableHead');
const btResultTableBody = document.getElementById('resultTableBody');
const btTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function btShowScreen(s) {
  [btIntroScreen, btCountdownScreen, btGameScreen, btResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var btCountdownInterval = null;
function btStartPreCountdown(onDone) {
  btShowScreen(btCountdownScreen);
  btCountdownInterval = runCountdown(btCountdownNumber, onDone);
}

function btClearTimers() {
  if (btCountdownInterval) { clearInterval(btCountdownInterval); btCountdownInterval = null; }
  if (btTimerHandle) { clearInterval(btTimerHandle); btTimerHandle = null; }
}

function btRandInt(n) {
  return Math.floor(Math.random() * n);
}

// 경과 시간 기준 현재 난이도
function btCurrentDifficulty() {
  const elapsed = GAME_DURATION - btTimeRemaining;
  let chosen = DIFFICULTY[0];
  for (let i = 0; i < DIFFICULTY.length; i++) {
    if (elapsed >= DIFFICULTY[i].fromSec) chosen = DIFFICULTY[i];
  }
  return chosen;
}

// 문제 생성: 보기 중 정확히 하나가 '유일한 최솟값'(동률 없음)이 되도록 보장.
// 반환: { values: number[], targetIdx: number }  (targetIdx = 가장 작은 수의 위치)
function btGeneratePrompt(diff) {
  const n = diff.choices;
  let values;
  let attempts = 0;
  while (true) {
    attempts++;
    values = [];
    const used = new Set();
    // 서로 다른 값들을 뽑는다 (중복 자체를 피해 동률 원천 차단)
    let guard = 0;
    while (values.length < n && guard < 500) {
      guard++;
      const v = diff.min + btRandInt(diff.max - diff.min + 1);
      if (!used.has(v)) { used.add(v); values.push(v); }
    }
    if (values.length < n) continue; // 범위가 좁아 뽑기 실패 → 재시도

    // 최솟값이 유일한지 + 2등(둘째로 작은 수)과 minGap 이상 떨어졌는지 확인
    const sorted = values.slice().sort((a, b) => a - b);
    const bottom = sorted[0];
    const second = sorted[1];
    const uniqueBottom = bottom !== second;         // 동률 없음
    const gapOk = (second - bottom) >= diff.minGap; // 충분히 떨어짐
    if (uniqueBottom && gapOk) break;
    if (attempts > 200) {
      // 안전망: 강제로 유일 최솟값 구성 (실제로는 거의 도달 안 함)
      values = [];
      for (let i = 0; i < n; i++) values.push(diff.min + i);
      break;
    }
  }
  const minVal = Math.min.apply(null, values);
  const targetIdx = values.indexOf(minVal);
  return { values: values, targetIdx: targetIdx };
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  const el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
      <rect x="20" y="32" width="50" height="46" rx="10" fill="#FFF3E0" stroke="#2C2C2C" stroke-width="3"/>
      <text x="45" y="64" text-anchor="middle" font-size="22" font-weight="900">23</text>
      <rect x="85" y="32" width="50" height="46" rx="10" fill="#80CBC4" stroke="#00695C" stroke-width="3"/>
      <text x="110" y="64" text-anchor="middle" font-size="22" font-weight="900" fill="#004D40">8</text>
      <text x="110" y="22" text-anchor="middle" font-size="13" font-weight="900" fill="#00897B">가장 작은 수!</text>
      <rect x="150" y="32" width="50" height="46" rx="10" fill="#FFF3E0" stroke="#2C2C2C" stroke-width="3"/>
      <text x="175" y="64" text-anchor="middle" font-size="22" font-weight="900">41</text>
    </svg>`;
  }
})();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { btPlayerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(btSound, btSoundToggle);

// ── Navigation ───────────────────────────────────────────────
onTap(btBackBtn,  function() { goHome(); });
onTap(btCloseBtn, function() { btClearTimers(); goHome(); });
onTap(btHomeBtn,  function() { goHome(); });
onTap(btRetryBtn, function() { btStartPreCountdown(function() { btStartGame(); }); });
onTap(btPlayBtn,  function() { btStartPreCountdown(function() { btStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function btBuildZones() {
  btZonesWrap.innerHTML = '';
  btZonesWrap.className = 'zones-wrap p' + btPlayerCount;

  for (let i = 0; i < btPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="bt-score-chip-' + i + '">0점</span>';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'bt-btn-group';
    btnGroup.id = 'bt-btn-group-' + i;

    zone.appendChild(header);
    zone.appendChild(btnGroup);
    btZonesWrap.appendChild(zone);
  }
}

function btGetZone(idx) {
  return btZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function btUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('bt-score-chip-' + playerIdx);
  if (chip) chip.textContent = btScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function btBuildScoreBar() {
  btScoreBar.innerHTML = '';
  for (let i = 0; i < btPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="bt-bar-score-' + i + '">0</span>';
    btScoreBar.appendChild(chip);
  }
}

function btUpdateBarScore(playerIdx) {
  const el = document.getElementById('bt-bar-score-' + playerIdx);
  if (el) el.textContent = btScores[playerIdx];
}

// ── Render a fresh prompt into a player's zone ────────────────
function btLoadPrompt(playerIdx) {
  const diff   = btCurrentDifficulty();
  const prompt = btGeneratePrompt(diff);
  btPrompts[playerIdx] = prompt;

  const group = document.getElementById('bt-btn-group-' + playerIdx);
  if (!group) return;
  group.innerHTML = '';

  prompt.values.forEach(function(val, idx) {
    const btn = document.createElement('button');
    btn.className = 'bt-btn';
    btn.dataset.player = playerIdx;
    btn.dataset.idx = idx;
    btn.textContent = val;
    btn.setAttribute('aria-label', PLAYER_CONFIG[playerIdx].label + ' 보기 ' + val);
    onTap(btn, function() { btHandleTap(playerIdx, idx, btn); });
    group.appendChild(btn);
  });
}

// ── Penalty / bonus flash ─────────────────────────────────────
function btFlash(playerIdx, text, isBonus) {
  const zone = btGetZone(playerIdx);
  if (!zone) return;
  const flash = document.createElement('div');
  flash.className = 'penalty-flash' + (isBonus ? ' bonus' : '');
  flash.textContent = text;
  zone.appendChild(flash);
  flash.addEventListener('animationend', function() { flash.remove(); });
}

// ── Tap handler ───────────────────────────────────────────────
function btHandleTap(playerIdx, idx, btn) {
  if (btPhase !== 'playing') return;
  const prompt = btPrompts[playerIdx];
  if (!prompt) return;
  if (btn.disabled) return;

  const group = document.getElementById('bt-btn-group-' + playerIdx);

  if (idx === prompt.targetIdx) {
    // 정답 → +1, 즉시 다음 문제
    btSound.play('ding');
    btScores[playerIdx]++;
    btSolved[playerIdx]++;
    btUpdateScoreChip(playerIdx);
    btUpdateBarScore(playerIdx);
    btFlash(playerIdx, '+1', true);

    btn.classList.add('state-correct');
    if (group) {
      Array.from(group.children).forEach(function(b) { b.disabled = true; });
    }
    setTimeout(function() {
      if (btPhase === 'playing') btLoadPrompt(playerIdx);
    }, CORRECT_FEEDBACK_MS);
  } else {
    // 오답 → -1(0 이하 없음), 같은 문제 유지(잠깐 멈춤 후 재개)
    btSound.play('buzz');
    btMisses[playerIdx]++;
    if (btScores[playerIdx] > 0) btScores[playerIdx]--;
    btUpdateScoreChip(playerIdx);
    btUpdateBarScore(playerIdx);
    btFlash(playerIdx, '-1', false);

    btn.classList.add('state-wrong');
    if (group) {
      Array.from(group.children).forEach(function(b) { b.disabled = true; });
    }
    setTimeout(function() {
      if (btPhase !== 'playing') return;
      // 같은 문제 그대로 재개 (버튼 상태만 초기화)
      if (group && btPrompts[playerIdx] === prompt) {
        Array.from(group.children).forEach(function(b) {
          b.disabled = false;
          b.classList.remove('state-wrong', 'state-correct');
        });
      }
    }, WRONG_FEEDBACK_MS);
  }
}

// ── Global timer ──────────────────────────────────────────────
function btStartTimer() {
  btTimeRemaining = GAME_DURATION;
  btProblemTimer.textContent = btTimeRemaining;
  btProblemTimer.classList.remove('urgent');

  btTimerHandle = setInterval(function() {
    btTimeRemaining--;
    btProblemTimer.textContent = btTimeRemaining;
    if (btTimeRemaining <= 5 && btTimeRemaining > 0) {
      btProblemTimer.classList.add('urgent');
      btSound.play('tick');
    }
    if (btTimeRemaining <= 0) {
      btClearTimers();
      btEndGame();
    }
  }, 1000);
}

// ── Start game ────────────────────────────────────────────────
function btStartGame() {
  btScores  = new Array(btPlayerCount).fill(0);
  btSolved  = new Array(btPlayerCount).fill(0);
  btMisses  = new Array(btPlayerCount).fill(0);
  btPrompts = new Array(btPlayerCount).fill(null);

  btClearTimers();
  btBuildZones();
  btBuildScoreBar();
  btQuestionCounter.textContent = '가장 작은 수를 터치!';
  btProblemStatus.textContent = '';
  btShowScreen(btGameScreen);

  btPhase = 'playing';
  for (let i = 0; i < btPlayerCount; i++) btLoadPrompt(i);
  btStartTimer();
}

// ── End game ──────────────────────────────────────────────────
function btEndGame() {
  btPhase = 'idle';
  btProblemStatus.textContent = '시간 종료!';
  setTimeout(function() { btShowResult(); }, RESULT_PAUSE_MS);
}

// ── Show result ───────────────────────────────────────────────
function btShowResult() {
  btClearTimers();
  btPhase = 'idle';
  btSound.play('fanfare');

  const maxScore = Math.max.apply(null, btScores);
  const winners  = btScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    btResultTitle.textContent  = '무승부!';
    btResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    btResultTitle.textContent  = '게임 종료!';
    btResultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    btResultTitle.textContent  = '동점!';
    btResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  const headRow = document.createElement('tr');
  let headHtml = '<th>플레이어</th><th>점수</th><th>맞힘</th><th>실수</th>';
  headRow.innerHTML = headHtml;
  btResultTableHead.innerHTML = '';
  btResultTableHead.appendChild(headRow);

  // Table body
  btResultTableBody.innerHTML = '';
  for (let i = 0; i < btPlayerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="text-align:left;"><span class="player-dot" style="background:' + cfg.dot + '"></span>' + cfg.label + '</td>' +
      '<td class="' + (isWin ? 'cell-win' : '') + '">' + btScores[i] + '점</td>' +
      '<td>' + btSolved[i] + '</td>' +
      '<td class="' + (btMisses[i] > 0 ? '' : 'cell-none') + '">' + btMisses[i] + '</td>';
    btResultTableBody.appendChild(tr);
  }

  // Total chips
  btTotalRow.innerHTML = '';
  for (let i = 0; i < btPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + btScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    btTotalRow.appendChild(chip);
  }

  btShowScreen(btResultScreen);
}
