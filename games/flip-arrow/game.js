/* games/flip-arrow/game.js — 패턴 B (반응속도 + 판단) — 거꾸로 화살표 */

'use strict';

// ── Constants ────────────────────────────────────────────────
const GAME_DURATION   = 30;                 // 초
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const CORRECT_FEEDBACK_MS = 240;            // 정답 표시 후 다음 화살표까지
const WRONG_FEEDBACK_MS   = 340;            // 오답 표시 후 같은 화살표 재개

// 4방향 모델. opp = 반대 방향 인덱스.
//   0:위  1:아래  2:왼쪽  3:오른쪽
const DIRS = [
  { key: 'up',    glyph: '↑', word: '위',   opp: 1 },
  { key: 'down',  glyph: '↓', word: '아래', opp: 0 },
  { key: 'left',  glyph: '←', word: '왼쪽', opp: 3 },
  { key: 'right', glyph: '→', word: '오른쪽', opp: 2 },
];

// 난이도 단계: 경과 시간(초)에 따라 자극 표현이 달라져 판단이 까다로워진다.
//   mode 'glyph'  = 화살표 그림, 'word' = 글자(위/아래/…), 'mix' = 무작위 혼합
const DIFFICULTY = [
  { fromSec: 0,  mode: 'glyph' },
  { fromSec: 12, mode: 'word'  },
  { fromSec: 22, mode: 'mix'   },
];

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const faSound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let faPlayerCount   = 2;
let faScores        = [];
let faSolved        = [];   // per player: 맞힌 수
let faMisses        = [];   // per player: 틀린 횟수
let faPrompts       = [];   // per player: 현재 자극 { dirIdx, mode }
let faPhase         = 'idle';
let faTimerHandle   = null;
let faTimeRemaining = GAME_DURATION;

// ── DOM refs ─────────────────────────────────────────────────
const faIntroScreen     = document.getElementById('introScreen');
const faCountdownScreen = document.getElementById('countdownScreen');
const faCountdownNumber = document.getElementById('countdownNumber');
const faGameScreen      = document.getElementById('gameScreen');
const faResultScreen    = document.getElementById('resultScreen');

const faBackBtn   = document.getElementById('backBtn');
const faPlayBtn   = document.getElementById('playBtn');
const faCloseBtn  = document.getElementById('closeBtn');
const faRetryBtn  = document.getElementById('retryBtn');
const faHomeBtn   = document.getElementById('homeBtn');

const faZonesWrap       = document.getElementById('zonesWrap');
const faQuestionCounter = document.getElementById('questionCounter');
const faProblemTimer    = document.getElementById('problemTimer');
const faProblemStatus   = document.getElementById('problemStatus');
const faScoreBar        = document.getElementById('scoreBar');

const faSoundToggle     = document.getElementById('soundToggleIntro');

const faResultTitle     = document.getElementById('resultTitle');
const faResultWinner    = document.getElementById('resultWinner');
const faResultTableHead = document.getElementById('resultTableHead');
const faResultTableBody = document.getElementById('resultTableBody');
const faTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function faShowScreen(s) {
  [faIntroScreen, faCountdownScreen, faGameScreen, faResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var faCountdownInterval = null;
function faStartPreCountdown(onDone) {
  faShowScreen(faCountdownScreen);
  faCountdownInterval = runCountdown(faCountdownNumber, onDone);
}

function faClearTimers() {
  if (faCountdownInterval) { clearInterval(faCountdownInterval); faCountdownInterval = null; }
  if (faTimerHandle) { clearInterval(faTimerHandle); faTimerHandle = null; }
}

function faRandInt(n) {
  return Math.floor(Math.random() * n);
}

// 경과 시간 기준 현재 난이도
function faCurrentDifficulty() {
  const elapsed = GAME_DURATION - faTimeRemaining;
  let chosen = DIFFICULTY[0];
  for (let i = 0; i < DIFFICULTY.length; i++) {
    if (elapsed >= DIFFICULTY[i].fromSec) chosen = DIFFICULTY[i];
  }
  return chosen;
}

// 자극 생성: 방향 1개 무작위 + 표현 모드 결정. 정답은 항상 반대 방향(유일).
function faGeneratePrompt(diff) {
  const dirIdx = faRandInt(4);
  let mode = diff.mode;
  if (mode === 'mix') mode = (Math.random() < 0.5) ? 'glyph' : 'word';
  return { dirIdx: dirIdx, mode: mode };
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  const el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
      <rect x="22" y="30" width="60" height="50" rx="10" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="3"/>
      <text x="52" y="68" text-anchor="middle" font-size="30" font-weight="900" fill="#E65100">→</text>
      <text x="110" y="62" text-anchor="middle" font-size="22" font-weight="900" fill="#EC407A">반대!</text>
      <rect x="138" y="30" width="60" height="50" rx="10" fill="#A5D6A7" stroke="#2E7D32" stroke-width="3"/>
      <text x="168" y="68" text-anchor="middle" font-size="30" font-weight="900" fill="#1B5E20">←</text>
      <text x="110" y="22" text-anchor="middle" font-size="12" font-weight="900" fill="#FB8C00">화살표의 반대 방향!</text>
    </svg>`;
  }
})();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { faPlayerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(faSound, faSoundToggle);

// ── Navigation ───────────────────────────────────────────────
onTap(faBackBtn,  function() { goHome(); });
onTap(faCloseBtn, function() { faClearTimers(); goHome(); });
onTap(faHomeBtn,  function() { goHome(); });
onTap(faRetryBtn, function() { faStartPreCountdown(function() { faStartGame(); }); });
onTap(faPlayBtn,  function() { faStartPreCountdown(function() { faStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
// D-pad 배치(3x3 grid)에 쓰일 슬롯. null = 빈 슬롯.
const PAD_SLOTS = [
  null, 0, null,   // 위(0)
  2, null, 3,      // 왼(2) · 가운데 · 오른(3)
  null, 1, null,   // 아래(1)
];

function faBuildZones() {
  faZonesWrap.innerHTML = '';
  faZonesWrap.className = 'zones-wrap p' + faPlayerCount;

  for (let i = 0; i < faPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="fa-score-chip-' + i + '">0점</span>';

    // 자극(화살표/글자) 카드
    const stim = document.createElement('div');
    stim.className = 'fa-stim';
    stim.id = 'fa-stim-' + i;

    // D-pad
    const pad = document.createElement('div');
    pad.className = 'fa-pad';
    pad.id = 'fa-pad-' + i;
    PAD_SLOTS.forEach(function(slot) {
      if (slot === null) {
        const ph = document.createElement('div');
        ph.className = 'fa-pad-empty';
        pad.appendChild(ph);
      } else {
        const btn = document.createElement('button');
        btn.className = 'fa-dir-btn';
        btn.dataset.player = i;
        btn.dataset.dir = slot;
        btn.textContent = DIRS[slot].glyph;
        btn.setAttribute('aria-label', PLAYER_CONFIG[i].label + ' ' + DIRS[slot].word);
        onTap(btn, function() { faHandleTap(i, slot, btn); });
        pad.appendChild(btn);
      }
    });

    zone.appendChild(header);
    zone.appendChild(stim);
    zone.appendChild(pad);
    faZonesWrap.appendChild(zone);
  }
}

function faGetZone(idx) {
  return faZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function faUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('fa-score-chip-' + playerIdx);
  if (chip) chip.textContent = faScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function faBuildScoreBar() {
  faScoreBar.innerHTML = '';
  for (let i = 0; i < faPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="fa-bar-score-' + i + '">0</span>';
    faScoreBar.appendChild(chip);
  }
}

function faUpdateBarScore(playerIdx) {
  const el = document.getElementById('fa-bar-score-' + playerIdx);
  if (el) el.textContent = faScores[playerIdx];
}

// ── Render a fresh prompt into a player's zone ────────────────
function faLoadPrompt(playerIdx) {
  const diff   = faCurrentDifficulty();
  const prompt = faGeneratePrompt(diff);
  faPrompts[playerIdx] = prompt;

  const stim = document.getElementById('fa-stim-' + playerIdx);
  if (stim) {
    const d = DIRS[prompt.dirIdx];
    if (prompt.mode === 'word') {
      stim.textContent = d.word;
      stim.classList.add('as-word');
    } else {
      stim.textContent = d.glyph;
      stim.classList.remove('as-word');
    }
  }

  // 버튼 상태 초기화
  const pad = document.getElementById('fa-pad-' + playerIdx);
  if (pad) {
    Array.from(pad.querySelectorAll('.fa-dir-btn')).forEach(function(b) {
      b.disabled = false;
      b.classList.remove('state-correct', 'state-wrong');
    });
  }
}

// ── Penalty / bonus flash ─────────────────────────────────────
function faFlash(playerIdx, text, isBonus) {
  const zone = faGetZone(playerIdx);
  if (!zone) return;
  const flash = document.createElement('div');
  flash.className = 'penalty-flash' + (isBonus ? ' bonus' : '');
  flash.textContent = text;
  zone.appendChild(flash);
  flash.addEventListener('animationend', function() { flash.remove(); });
}

// ── Tap handler ───────────────────────────────────────────────
function faHandleTap(playerIdx, dirIdx, btn) {
  if (faPhase !== 'playing') return;
  const prompt = faPrompts[playerIdx];
  if (!prompt) return;
  if (btn.disabled) return;

  const pad = document.getElementById('fa-pad-' + playerIdx);
  const answerIdx = DIRS[prompt.dirIdx].opp;

  if (dirIdx === answerIdx) {
    // 정답 → +1, 즉시 다음 화살표
    faSound.play('ding');
    faScores[playerIdx]++;
    faSolved[playerIdx]++;
    faUpdateScoreChip(playerIdx);
    faUpdateBarScore(playerIdx);
    faFlash(playerIdx, '+1', true);

    btn.classList.add('state-correct');
    if (pad) {
      Array.from(pad.querySelectorAll('.fa-dir-btn')).forEach(function(b) { b.disabled = true; });
    }
    setTimeout(function() {
      if (faPhase === 'playing') faLoadPrompt(playerIdx);
    }, CORRECT_FEEDBACK_MS);
  } else {
    // 오답 → -1(0 이하 없음), 같은 화살표 유지(잠깐 멈춤 후 재개)
    faSound.play('buzz');
    faMisses[playerIdx]++;
    if (faScores[playerIdx] > 0) faScores[playerIdx]--;
    faUpdateScoreChip(playerIdx);
    faUpdateBarScore(playerIdx);
    faFlash(playerIdx, '-1', false);

    btn.classList.add('state-wrong');
    if (pad) {
      Array.from(pad.querySelectorAll('.fa-dir-btn')).forEach(function(b) { b.disabled = true; });
    }
    setTimeout(function() {
      if (faPhase !== 'playing') return;
      // 같은 화살표 그대로 재개 (버튼 상태만 초기화)
      if (pad && faPrompts[playerIdx] === prompt) {
        Array.from(pad.querySelectorAll('.fa-dir-btn')).forEach(function(b) {
          b.disabled = false;
          b.classList.remove('state-wrong', 'state-correct');
        });
      }
    }, WRONG_FEEDBACK_MS);
  }
}

// ── Global timer ──────────────────────────────────────────────
function faStartTimer() {
  faTimeRemaining = GAME_DURATION;
  faProblemTimer.textContent = faTimeRemaining;
  faProblemTimer.classList.remove('urgent');

  faTimerHandle = setInterval(function() {
    faTimeRemaining--;
    faProblemTimer.textContent = faTimeRemaining;
    if (faTimeRemaining <= 5 && faTimeRemaining > 0) {
      faProblemTimer.classList.add('urgent');
      faSound.play('tick');
    }
    if (faTimeRemaining <= 0) {
      faClearTimers();
      faEndGame();
    }
  }, 1000);
}

// ── Start game ────────────────────────────────────────────────
function faStartGame() {
  faScores  = new Array(faPlayerCount).fill(0);
  faSolved  = new Array(faPlayerCount).fill(0);
  faMisses  = new Array(faPlayerCount).fill(0);
  faPrompts = new Array(faPlayerCount).fill(null);

  faClearTimers();
  faBuildZones();
  faBuildScoreBar();
  faQuestionCounter.textContent = '반대 방향을 눌러요!';
  faProblemStatus.textContent = '';
  faShowScreen(faGameScreen);

  faPhase = 'playing';
  for (let i = 0; i < faPlayerCount; i++) faLoadPrompt(i);
  faStartTimer();
}

// ── End game ──────────────────────────────────────────────────
function faEndGame() {
  faPhase = 'idle';
  faProblemStatus.textContent = '시간 종료!';
  setTimeout(function() { faShowResult(); }, RESULT_PAUSE_MS);
}

// ── Show result ───────────────────────────────────────────────
function faShowResult() {
  faClearTimers();
  faPhase = 'idle';
  faSound.play('fanfare');

  const maxScore = Math.max.apply(null, faScores);
  const winners  = faScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    faResultTitle.textContent  = '무승부!';
    faResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    faResultTitle.textContent  = '게임 종료!';
    faResultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    faResultTitle.textContent  = '동점!';
    faResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>플레이어</th><th>점수</th><th>맞힘</th><th>실수</th>';
  faResultTableHead.innerHTML = '';
  faResultTableHead.appendChild(headRow);

  // Table body
  faResultTableBody.innerHTML = '';
  for (let i = 0; i < faPlayerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="text-align:left;"><span class="player-dot" style="background:' + cfg.dot + '"></span>' + cfg.label + '</td>' +
      '<td class="' + (isWin ? 'cell-win' : '') + '">' + faScores[i] + '점</td>' +
      '<td>' + faSolved[i] + '</td>' +
      '<td class="' + (faMisses[i] > 0 ? '' : 'cell-none') + '">' + faMisses[i] + '</td>';
    faResultTableBody.appendChild(tr);
  }

  // Total chips
  faTotalRow.innerHTML = '';
  for (let i = 0; i < faPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + faScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    faTotalRow.appendChild(chip);
  }

  faShowScreen(faResultScreen);
}
