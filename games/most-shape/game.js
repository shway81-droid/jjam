/* games/most-shape/game.js — 가장 많은 그림 (빈도 비교 판단 2~4인) */

'use strict';

// ── Constants ────────────────────────────────────────────────
const MS_TOTAL_ROUNDS    = 8;
const MS_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const MS_ITEMS_PER_ROUND = 4;

// 라운드별 난이도
// phase 1: 3종, 큰 차이(margin>=3), 6초
// phase 2: 3종, 빽빽·작은 차이(margin>=2), 5초
// phase 3: 4종 비교(margin>=1, 유일 최대), 5초
const MS_ROUND_PLAN = [
  { phase: 1, timeLimit: 6 },
  { phase: 1, timeLimit: 6 },
  { phase: 2, timeLimit: 5 },
  { phase: 2, timeLimit: 5 },
  { phase: 2, timeLimit: 5 },
  { phase: 3, timeLimit: 5 },
  { phase: 3, timeLimit: 5 },
  { phase: 3, timeLimit: 5 },
];

// 시각적으로 또렷이 구별되는 그림들
const MS_EMOJIS = ['🍎','🍌','🍇','🍓','🍊','🐶','🐱','⭐','❤️','🌸','🚗','⚽'];

const MS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const msSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let msPlayerCount   = 2;
let msRoundIdx      = 0;
let msScores        = [];
let msRoundLog      = [];
let msDqSet         = new Set();
let msPhase         = 'idle';
let msTimerHandle   = null;
let msNextHandle    = null;
let msTimeRemaining = 6;

let msItems         = [];
let msItemIdx       = 0;
let msRoundScores   = [];

// ── DOM refs ─────────────────────────────────────────────────
const msIntroScreen     = document.getElementById('introScreen');
const msCountdownScreen = document.getElementById('countdownScreen');
const msCountdownNumber = document.getElementById('countdownNumber');
const msGameScreen      = document.getElementById('gameScreen');
const msResultScreen    = document.getElementById('resultScreen');

const msBackBtn   = document.getElementById('backBtn');
const msPlayBtn   = document.getElementById('playBtn');
const msCloseBtn  = document.getElementById('closeBtn');
const msRetryBtn  = document.getElementById('retryBtn');
const msHomeBtn   = document.getElementById('homeBtn');

const msZonesWrap       = document.getElementById('zonesWrap');
const msQuestionCounter = document.getElementById('questionCounter');
const msProblemTimer    = document.getElementById('problemTimer');
const msScatter         = document.getElementById('msScatter');
const msProblemStatus   = document.getElementById('problemStatus');
const msScoreBar        = document.getElementById('scoreBar');

const msSoundToggle     = document.getElementById('soundToggleIntro');

const msResultTitle     = document.getElementById('resultTitle');
const msResultWinner    = document.getElementById('resultWinner');
const msResultTableHead = document.getElementById('resultTableHead');
const msResultTableBody = document.getElementById('resultTableBody');
const msTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function msShowScreen(s) {
  [msIntroScreen, msCountdownScreen, msGameScreen, msResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var msCountdownInterval = null;
function msStartPreCountdown(onDone) {
  msShowScreen(msCountdownScreen);
  msCountdownInterval = runCountdown(msCountdownNumber, onDone);
}

function msClearTimers() {
  if (msCountdownInterval) { clearInterval(msCountdownInterval); msCountdownInterval = null; }
  if (msTimerHandle) { clearInterval(msTimerHandle); msTimerHandle = null; }
  if (msNextHandle)  { clearTimeout(msNextHandle);   msNextHandle  = null; }
}

function msRandInt(n) {
  return Math.floor(Math.random() * n);
}
function msShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = msRandInt(i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// 문항 생성
// returns { items:[emoji...], options:[emoji...], answer:emoji, counts:{emoji:n} }
function msGenerateItem(phaseNum) {
  var K, winnerCount, otherMin, otherMax;
  if (phaseNum === 1) {
    K = 3; winnerCount = 6 + msRandInt(2);   // 6~7
    otherMin = 2; otherMax = winnerCount - 3; // margin >= 3
  } else if (phaseNum === 2) {
    K = 3; winnerCount = 6 + msRandInt(2);   // 6~7
    otherMin = 3; otherMax = winnerCount - 2; // margin >= 2
  } else {
    K = 4; winnerCount = 6 + msRandInt(2);   // 6~7
    otherMin = 3; otherMax = winnerCount - 1; // margin >= 1 (유일 최대 보장)
  }

  var chosen = msShuffle(MS_EMOJIS).slice(0, K);
  var winner = chosen[0];
  var counts = {};
  counts[winner] = winnerCount;
  for (var i = 1; i < K; i++) {
    var n = otherMin + msRandInt(Math.max(1, otherMax - otherMin + 1));
    if (n >= winnerCount) n = winnerCount - 1;
    if (n < 1) n = 1;
    counts[chosen[i]] = n;
  }

  // items 배열 구성 후 셔플
  var items = [];
  chosen.forEach(function(e) {
    for (var c = 0; c < counts[e]; c++) items.push(e);
  });
  items = msShuffle(items);

  return {
    items: items,
    options: msShuffle(chosen),
    answer: winner,
    counts: counts,
  };
}

function msGenerateItems(phaseNum) {
  var items = [];
  for (var i = 0; i < MS_ITEMS_PER_ROUND; i++) {
    items.push(msGenerateItem(phaseNum));
  }
  return items;
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  var el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="30" y="40" font-size="20">🍎</text>' +
      '<text x="70" y="40" font-size="20">🍌</text>' +
      '<text x="110" y="40" font-size="20">🍎</text>' +
      '<text x="150" y="40" font-size="20">🍇</text>' +
      '<text x="186" y="40" font-size="20">🍎</text>' +
      '<text x="50" y="76" font-size="20">🍎</text>' +
      '<text x="92" y="76" font-size="20">🍌</text>' +
      '<text x="134" y="76" font-size="20">🍎</text>' +
      '<text x="170" y="96" text-anchor="middle" font-size="13" font-weight="900" fill="#26A69A">🍎 가장 많아!</text>' +
      '</svg>';
  }
})();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { msPlayerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(msSound, msSoundToggle);

// ── Navigation ───────────────────────────────────────────────
onTap(msBackBtn,  function() { goHome(); });
onTap(msCloseBtn, function() { msClearTimers(); goHome(); });
onTap(msHomeBtn,  function() { goHome(); });
onTap(msRetryBtn, function() { msStartPreCountdown(function() { msStartGame(); }); });
onTap(msPlayBtn,  function() { msStartPreCountdown(function() { msStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function msBuildZones() {
  msZonesWrap.innerHTML = '';
  msZonesWrap.className = 'zones-wrap p' + msPlayerCount;

  for (var i = 0; i < msPlayerCount; i++) {
    var cfg  = MS_PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="ms-score-chip-' + i + '">0점</span>';

    var btnGroup = document.createElement('div');
    btnGroup.className = 'ms-btn-group';
    btnGroup.id = 'ms-btn-group-' + i;

    zone.appendChild(header);
    zone.appendChild(btnGroup);
    msZonesWrap.appendChild(zone);
  }
}

// 옵션 버튼을 현재 문항에 맞게 채움
function msBuildOptionButtons() {
  var currentItem = msItems[msItemIdx];
  for (var i = 0; i < msPlayerCount; i++) {
    var group = document.getElementById('ms-btn-group-' + i);
    if (!group) continue;
    group.innerHTML = '';
    group.className = 'ms-btn-group opts-' + currentItem.options.length;
    currentItem.options.forEach(function(emoji, oi) {
      var btn = document.createElement('button');
      btn.className = 'ms-btn';
      btn.dataset.player = i;
      btn.dataset.ans = emoji;
      btn.setAttribute('aria-label', MS_PLAYER_CONFIG[i].label + ' ' + emoji);
      btn.textContent = emoji;
      (function(pi, ans, b) { onTap(b, function() { msHandleTap(pi, ans, b); }); })(i, emoji, btn);
      group.appendChild(btn);
    });
  }
}

function msGetZone(idx) {
  return msZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function msGetBtns(playerIdx) {
  var zone = msGetZone(playerIdx);
  return zone ? Array.from(zone.querySelectorAll('.ms-btn')) : [];
}

function msUpdateScoreChip(playerIdx) {
  var chip = document.getElementById('ms-score-chip-' + playerIdx);
  if (chip) chip.textContent = msScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function msBuildScoreBar() {
  msScoreBar.innerHTML = '';
  for (var i = 0; i < msPlayerCount; i++) {
    var cfg  = MS_PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="ms-bar-score-' + i + '">0</span>';
    msScoreBar.appendChild(chip);
  }
}

function msUpdateBarScore(playerIdx) {
  var el = document.getElementById('ms-bar-score-' + playerIdx);
  if (el) el.textContent = msScores[playerIdx];
}

// ── Disable / reset ───────────────────────────────────────────
function msDisablePlayerBtns(playerIdx) {
  msGetBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Timer ─────────────────────────────────────────────────────
function msStartItemTimer() {
  var plan = MS_ROUND_PLAN[msRoundIdx];
  msTimeRemaining = plan.timeLimit;
  msProblemTimer.textContent = msTimeRemaining;
  msProblemTimer.classList.remove('urgent');

  msTimerHandle = setInterval(function() {
    msTimeRemaining--;
    msProblemTimer.textContent = msTimeRemaining;
    if (msTimeRemaining <= 2 && msTimeRemaining > 0) {
      msProblemTimer.classList.add('urgent');
      msSound.play('tick');
    }
    if (msTimeRemaining <= 0) {
      msClearTimers();
      msHandleItemTimeout();
    }
  }, 1000);
}

// ── Tap handler ───────────────────────────────────────────────
function msHandleTap(playerIdx, ans, btn) {
  if (msPhase !== 'item-active') return;
  if (msDqSet.has(playerIdx)) return;

  var currentItem = msItems[msItemIdx];

  if (ans === currentItem.answer) {
    msSound.play('ding');
    btn.classList.add('state-correct');
    msDqSet.add(playerIdx);
    msScores[playerIdx]++;
    msRoundScores[playerIdx]++;
    msUpdateScoreChip(playerIdx);
    msUpdateBarScore(playerIdx);

    msGetBtns(playerIdx).forEach(function(b) {
      if (b !== btn) { b.classList.add('state-disabled'); b.disabled = true; }
    });

    if (msAllAnswered()) {
      msClearTimers();
      msNextHandle = setTimeout(function() { msNextItem(); }, 600);
    }
  } else {
    msSound.play('buzz');
    btn.classList.add('state-wrong');
    msDqSet.add(playerIdx);

    var zone = msGetZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    msDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    var anyActive = false;
    for (var i = 0; i < msPlayerCount; i++) {
      if (!msDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      msClearTimers();
      msNextHandle = setTimeout(function() { msHandleItemTimeout(); }, 300);
    }
  }
}

function msAllAnswered() {
  for (var i = 0; i < msPlayerCount; i++) {
    if (!msDqSet.has(i)) return false;
  }
  return true;
}

// ── Item timeout ─────────────────────────────────────────────
function msHandleItemTimeout() {
  msSound.play('timeout');
  var currentItem = msItems[msItemIdx];
  for (var i = 0; i < msPlayerCount; i++) {
    msGetBtns(i).forEach(function(btn) {
      if (btn.dataset.ans === currentItem.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    var zone = msGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  msProblemStatus.textContent = '⏰ 정답: ' + currentItem.answer + ' (' + currentItem.counts[currentItem.answer] + '개)';
  msNextHandle = setTimeout(function() { msNextItem(); }, 1300);
}

// ── Load item ─────────────────────────────────────────────────
function msLoadItem() {
  msPhase = 'item-active';
  var currentItem = msItems[msItemIdx];

  msQuestionCounter.textContent = '라운드 ' + (msRoundIdx + 1) + '/' + MS_TOTAL_ROUNDS + '  문항 ' + (msItemIdx + 1) + '/' + MS_ITEMS_PER_ROUND;
  msProblemStatus.textContent = '';
  msProblemTimer.classList.remove('urgent');

  // 흩어진 그림 렌더
  msScatter.innerHTML = '';
  currentItem.items.forEach(function(emoji) {
    var span = document.createElement('span');
    span.className = 'ms-item';
    span.textContent = emoji;
    msScatter.appendChild(span);
  });
  msScatter.classList.remove('num-pop');
  void msScatter.offsetWidth;
  msScatter.classList.add('num-pop');

  msDqSet = new Set();
  msBuildOptionButtons();
  msStartItemTimer();
}

// ── Next item ─────────────────────────────────────────────────
function msNextItem() {
  msItemIdx++;
  if (msItemIdx >= MS_ITEMS_PER_ROUND) {
    msEndRound();
  } else {
    msLoadItem();
  }
}

// ── End round ─────────────────────────────────────────────────
function msEndRound() {
  msPhase = 'done';
  msRoundLog.push({
    roundIdx: msRoundIdx,
    roundScores: msRoundScores.slice(),
  });
  msProblemStatus.textContent = '라운드 ' + (msRoundIdx + 1) + ' 완료!';
  msNextHandle = setTimeout(function() { msNextRound(); }, MS_RESULT_PAUSE_MS);
}

function msNextRound() {
  msRoundIdx++;
  if (msRoundIdx >= MS_TOTAL_ROUNDS) {
    msShowResult();
  } else {
    msStartRound();
  }
}

// ── Start round ───────────────────────────────────────────────
function msStartRound() {
  var plan = MS_ROUND_PLAN[msRoundIdx];
  msItems = msGenerateItems(plan.phase);
  msItemIdx = 0;
  msRoundScores = new Array(msPlayerCount).fill(0);
  msDqSet = new Set();
  msLoadItem();
}

// ── Start game ────────────────────────────────────────────────
function msStartGame() {
  msRoundIdx   = 0;
  msScores     = new Array(msPlayerCount).fill(0);
  msRoundLog   = [];
  msDqSet      = new Set();
  msPhase      = 'idle';

  msClearTimers();
  msBuildZones();
  msBuildScoreBar();
  msShowScreen(msGameScreen);
  msStartRound();
}

// ── Show result ───────────────────────────────────────────────
function msShowResult() {
  msClearTimers();
  msPhase = 'idle';
  msSound.play('fanfare');

  var maxScore = Math.max.apply(null, msScores);
  var winners  = msScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    msResultTitle.textContent  = '무승부!';
    msResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    msResultTitle.textContent  = '게임 종료!';
    msResultWinner.textContent = MS_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w2) { return MS_PLAYER_CONFIG[w2].label; }).join(', ');
    msResultTitle.textContent  = '동점!';
    msResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  var headRow = document.createElement('tr');
  var headHtml = '<th>라운드</th>';
  for (var i = 0; i < msPlayerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + MS_PLAYER_CONFIG[i].dot + '"></span>' + MS_PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  msResultTableHead.innerHTML = '';
  msResultTableHead.appendChild(headRow);

  // Table body
  msResultTableBody.innerHTML = '';
  msRoundLog.forEach(function(log) {
    var tr = document.createElement('tr');
    var plan = MS_ROUND_PLAN[log.roundIdx];
    var phaseLabel = ['', '3종', '3종 빽빽', '4종'][plan.phase];
    var cells = '<td style="text-align:left;font-size:0.82rem;">' + (log.roundIdx + 1) + '라운드 (' + phaseLabel + ')</td>';
    for (var i = 0; i < msPlayerCount; i++) {
      var pts = log.roundScores[i];
      cells += pts > 0
        ? '<td class="cell-win">+' + pts + '</td>'
        : '<td class="cell-none">0</td>';
    }
    tr.innerHTML = cells;
    msResultTableBody.appendChild(tr);
  });

  // Total chips
  msTotalRow.innerHTML = '';
  for (var i = 0; i < msPlayerCount; i++) {
    var cfg   = MS_PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + msScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    msTotalRow.appendChild(chip);
  }

  msShowScreen(msResultScreen);
}
