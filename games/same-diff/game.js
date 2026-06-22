/* games/same-diff/game.js — 같을까 다를까 (빠른 같다/다르다 판단 2~4인) */

'use strict';

// ── Constants ────────────────────────────────────────────────
const SD_TOTAL_ROUNDS    = 8;
const SD_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const SD_ITEMS_PER_ROUND = 5;

// 라운드별 난이도
// phase 1: 그림 1개 비교 (5초)
// phase 2: 색 + 모양 두 속성 비교 (4초)
// phase 3: 그림 3개 줄 비교 — 한 곳만 달라도 '다르다' (4초)
const SD_ROUND_PLAN = [
  { phase: 1, timeLimit: 5 },
  { phase: 1, timeLimit: 5 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 3, timeLimit: 4 },
  { phase: 3, timeLimit: 4 },
  { phase: 3, timeLimit: 4 },
];

const SD_EMOJIS = ['🐶','🐱','🐰','🐭','🦊','🐻','🐼','🐯','🦁','🐸','🐵','🐔'];
const SD_SHAPES = ['●','■','▲','★','♥'];
const SD_COLORS = ['#E53935','#1E88E5','#43A047','#FB8C00','#8E24AA'];

const SD_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sdSound = createSoundManager({
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
let sdPlayerCount   = 2;
let sdRoundIdx      = 0;
let sdScores        = [];
let sdRoundLog      = [];
let sdDqSet         = new Set();
let sdPhase         = 'idle';
let sdTimerHandle   = null;
let sdNextHandle    = null;
let sdTimeRemaining = 5;

let sdItems         = [];
let sdItemIdx       = 0;
let sdRoundScores   = [];

// ── DOM refs ─────────────────────────────────────────────────
const sdIntroScreen     = document.getElementById('introScreen');
const sdCountdownScreen = document.getElementById('countdownScreen');
const sdCountdownNumber = document.getElementById('countdownNumber');
const sdGameScreen      = document.getElementById('gameScreen');
const sdResultScreen    = document.getElementById('resultScreen');

const sdBackBtn   = document.getElementById('backBtn');
const sdPlayBtn   = document.getElementById('playBtn');
const sdCloseBtn  = document.getElementById('closeBtn');
const sdRetryBtn  = document.getElementById('retryBtn');
const sdHomeBtn   = document.getElementById('homeBtn');

const sdZonesWrap       = document.getElementById('zonesWrap');
const sdQuestionCounter = document.getElementById('questionCounter');
const sdProblemTimer    = document.getElementById('problemTimer');
const sdLeftBox         = document.getElementById('sdLeftBox');
const sdRightBox        = document.getElementById('sdRightBox');
const sdProblemStatus   = document.getElementById('problemStatus');
const sdScoreBar        = document.getElementById('scoreBar');

const sdSoundToggle     = document.getElementById('soundToggleIntro');

const sdResultTitle     = document.getElementById('resultTitle');
const sdResultWinner    = document.getElementById('resultWinner');
const sdResultTableHead = document.getElementById('resultTableHead');
const sdResultTableBody = document.getElementById('resultTableBody');
const sdTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function sdShowScreen(s) {
  [sdIntroScreen, sdCountdownScreen, sdGameScreen, sdResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var sdCountdownInterval = null;
function sdStartPreCountdown(onDone) {
  sdShowScreen(sdCountdownScreen);
  sdCountdownInterval = runCountdown(sdCountdownNumber, onDone);
}

function sdClearTimers() {
  if (sdCountdownInterval) { clearInterval(sdCountdownInterval); sdCountdownInterval = null; }
  if (sdTimerHandle) { clearInterval(sdTimerHandle); sdTimerHandle = null; }
  if (sdNextHandle)  { clearTimeout(sdNextHandle);   sdNextHandle  = null; }
}

function sdRandInt(n) {
  return Math.floor(Math.random() * n);
}
function sdPick(arr) {
  return arr[sdRandInt(arr.length)];
}

// 색·모양 한 칸 렌더
function sdShapeHtml(shape, color) {
  return '<span class="sd-shape" style="color:' + color + '">' + shape + '</span>';
}

// 문항 생성: { leftHtml, rightHtml, answer:'same'|'diff' }
function sdGenerateItem(phaseNum) {
  var wantSame = Math.random() < 0.5;

  if (phaseNum === 1) {
    var a = sdPick(SD_EMOJIS);
    if (wantSame) {
      return { leftHtml: a, rightHtml: a, answer: 'same' };
    }
    var b = a;
    while (b === a) b = sdPick(SD_EMOJIS);
    return { leftHtml: a, rightHtml: b, answer: 'diff' };
  }

  if (phaseNum === 2) {
    var s1 = sdPick(SD_SHAPES), c1 = sdPick(SD_COLORS);
    if (wantSame) {
      return { leftHtml: sdShapeHtml(s1, c1), rightHtml: sdShapeHtml(s1, c1), answer: 'same' };
    }
    // 다르다: 모양 또는 색 (또는 둘 다)을 바꿈
    var s2 = s1, c2 = c1;
    var mode = sdRandInt(3); // 0:모양만 1:색만 2:둘다
    if (mode === 0 || mode === 2) { while (s2 === s1) s2 = sdPick(SD_SHAPES); }
    if (mode === 1 || mode === 2) { while (c2 === c1) c2 = sdPick(SD_COLORS); }
    return { leftHtml: sdShapeHtml(s1, c1), rightHtml: sdShapeHtml(s2, c2), answer: 'diff' };
  }

  // phase 3: 그림 3개 줄
  var seq = [];
  for (var i = 0; i < 3; i++) seq.push(sdPick(SD_EMOJIS));
  if (wantSame) {
    var seqHtml = seq.join('');
    return { leftHtml: '<span class="sd-seq">' + seqHtml + '</span>',
             rightHtml: '<span class="sd-seq">' + seqHtml + '</span>', answer: 'same' };
  }
  // 다르다: 한 위치만 다른 그림으로
  var seq2 = seq.slice();
  var pos = sdRandInt(3);
  var rep = seq2[pos];
  while (rep === seq2[pos]) rep = sdPick(SD_EMOJIS);
  seq2[pos] = rep;
  return { leftHtml: '<span class="sd-seq">' + seq.join('') + '</span>',
           rightHtml: '<span class="sd-seq">' + seq2.join('') + '</span>', answer: 'diff' };
}

function sdGenerateItems(phaseNum) {
  var items = [];
  for (var i = 0; i < SD_ITEMS_PER_ROUND; i++) {
    items.push(sdGenerateItem(phaseNum));
  }
  return items;
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  var el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
      '<rect x="20" y="26" width="56" height="56" rx="12" fill="#EDE7F6" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="48" y="66" text-anchor="middle" font-size="30">🐶</text>' +
      '<rect x="144" y="26" width="56" height="56" rx="12" fill="#EDE7F6" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="172" y="66" text-anchor="middle" font-size="30">🐱</text>' +
      '<text x="110" y="60" text-anchor="middle" font-size="16" font-weight="900" fill="#7E57C2">vs</text>' +
      '</svg>';
  }
})();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { sdPlayerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sdSound, sdSoundToggle);

// ── Navigation ───────────────────────────────────────────────
onTap(sdBackBtn,  function() { goHome(); });
onTap(sdCloseBtn, function() { sdClearTimers(); goHome(); });
onTap(sdHomeBtn,  function() { goHome(); });
onTap(sdRetryBtn, function() { sdStartPreCountdown(function() { sdStartGame(); }); });
onTap(sdPlayBtn,  function() { sdStartPreCountdown(function() { sdStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function sdBuildZones() {
  sdZonesWrap.innerHTML = '';
  sdZonesWrap.className = 'zones-wrap p' + sdPlayerCount;

  for (var i = 0; i < sdPlayerCount; i++) {
    var cfg  = SD_PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="sd-score-chip-' + i + '">0점</span>';

    var btnGroup = document.createElement('div');
    btnGroup.className = 'sd-btn-group';

    var sameBtn = document.createElement('button');
    sameBtn.className = 'sd-btn sd-btn-same';
    sameBtn.dataset.player = i;
    sameBtn.dataset.ans = 'same';
    sameBtn.setAttribute('aria-label', cfg.label + ' 같다');
    sameBtn.textContent = '같다';
    (function(pi, btn) { onTap(btn, function() { sdHandleTap(pi, 'same', btn); }); })(i, sameBtn);

    var diffBtn = document.createElement('button');
    diffBtn.className = 'sd-btn sd-btn-diff';
    diffBtn.dataset.player = i;
    diffBtn.dataset.ans = 'diff';
    diffBtn.setAttribute('aria-label', cfg.label + ' 다르다');
    diffBtn.textContent = '다르다';
    (function(pi, btn) { onTap(btn, function() { sdHandleTap(pi, 'diff', btn); }); })(i, diffBtn);

    btnGroup.appendChild(sameBtn);
    btnGroup.appendChild(diffBtn);

    zone.appendChild(header);
    zone.appendChild(btnGroup);
    sdZonesWrap.appendChild(zone);
  }
}

function sdGetZone(idx) {
  return sdZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function sdGetBtns(playerIdx) {
  var zone = sdGetZone(playerIdx);
  return zone ? Array.from(zone.querySelectorAll('.sd-btn')) : [];
}

function sdUpdateScoreChip(playerIdx) {
  var chip = document.getElementById('sd-score-chip-' + playerIdx);
  if (chip) chip.textContent = sdScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function sdBuildScoreBar() {
  sdScoreBar.innerHTML = '';
  for (var i = 0; i < sdPlayerCount; i++) {
    var cfg  = SD_PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="sd-bar-score-' + i + '">0</span>';
    sdScoreBar.appendChild(chip);
  }
}

function sdUpdateBarScore(playerIdx) {
  var el = document.getElementById('sd-bar-score-' + playerIdx);
  if (el) el.textContent = sdScores[playerIdx];
}

// ── Reset buttons for new item ────────────────────────────────
function sdResetItemBtns() {
  for (var i = 0; i < sdPlayerCount; i++) {
    sdGetBtns(i).forEach(function(btn) {
      btn.className = 'sd-btn ' + (btn.dataset.ans === 'same' ? 'sd-btn-same' : 'sd-btn-diff');
      btn.disabled = false;
    });
    var zone = sdGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  sdDqSet = new Set();
}

function sdDisablePlayerBtns(playerIdx) {
  sdGetBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Timer ─────────────────────────────────────────────────────
function sdStartItemTimer() {
  var plan = SD_ROUND_PLAN[sdRoundIdx];
  sdTimeRemaining = plan.timeLimit;
  sdProblemTimer.textContent = sdTimeRemaining;
  sdProblemTimer.classList.remove('urgent');

  sdTimerHandle = setInterval(function() {
    sdTimeRemaining--;
    sdProblemTimer.textContent = sdTimeRemaining;
    if (sdTimeRemaining <= 2 && sdTimeRemaining > 0) {
      sdProblemTimer.classList.add('urgent');
      sdSound.play('tick');
    }
    if (sdTimeRemaining <= 0) {
      sdClearTimers();
      sdHandleItemTimeout();
    }
  }, 1000);
}

// ── Tap handler ───────────────────────────────────────────────
function sdHandleTap(playerIdx, ans, btn) {
  if (sdPhase !== 'item-active') return;
  if (sdDqSet.has(playerIdx)) return;

  var currentItem = sdItems[sdItemIdx];

  if (ans === currentItem.answer) {
    sdSound.play('ding');
    btn.classList.add('state-correct');
    sdDqSet.add(playerIdx);
    sdScores[playerIdx]++;
    sdRoundScores[playerIdx]++;
    sdUpdateScoreChip(playerIdx);
    sdUpdateBarScore(playerIdx);

    sdGetBtns(playerIdx).forEach(function(b) {
      if (b !== btn) { b.classList.add('state-disabled'); b.disabled = true; }
    });

    if (sdAllAnswered()) {
      sdClearTimers();
      sdNextHandle = setTimeout(function() { sdNextItem(); }, 600);
    }
  } else {
    sdSound.play('buzz');
    btn.classList.add('state-wrong');
    sdDqSet.add(playerIdx);

    var zone = sdGetZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    sdDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    var anyActive = false;
    for (var i = 0; i < sdPlayerCount; i++) {
      if (!sdDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      sdClearTimers();
      sdNextHandle = setTimeout(function() { sdHandleItemTimeout(); }, 300);
    }
  }
}

function sdAllAnswered() {
  for (var i = 0; i < sdPlayerCount; i++) {
    if (!sdDqSet.has(i)) return false;
  }
  return true;
}

// ── Item timeout ─────────────────────────────────────────────
function sdHandleItemTimeout() {
  sdSound.play('timeout');
  var currentItem = sdItems[sdItemIdx];
  for (var i = 0; i < sdPlayerCount; i++) {
    sdGetBtns(i).forEach(function(btn) {
      if (btn.dataset.ans === currentItem.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    var zone = sdGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  sdProblemStatus.textContent = '⏰ 정답: ' + (currentItem.answer === 'same' ? '같다' : '다르다');
  sdNextHandle = setTimeout(function() { sdNextItem(); }, 1200);
}

// ── Load item ─────────────────────────────────────────────────
function sdLoadItem() {
  sdPhase = 'item-active';
  var currentItem = sdItems[sdItemIdx];

  sdQuestionCounter.textContent = '라운드 ' + (sdRoundIdx + 1) + '/' + SD_TOTAL_ROUNDS + '  문항 ' + (sdItemIdx + 1) + '/' + SD_ITEMS_PER_ROUND;
  sdProblemStatus.textContent = '';
  sdProblemTimer.classList.remove('urgent');

  sdLeftBox.innerHTML = currentItem.leftHtml;
  sdRightBox.innerHTML = currentItem.rightHtml;
  [sdLeftBox, sdRightBox].forEach(function(box) {
    box.classList.remove('num-pop');
    void box.offsetWidth;
    box.classList.add('num-pop');
  });

  sdResetItemBtns();
  sdStartItemTimer();
}

// ── Next item ─────────────────────────────────────────────────
function sdNextItem() {
  sdItemIdx++;
  if (sdItemIdx >= SD_ITEMS_PER_ROUND) {
    sdEndRound();
  } else {
    sdLoadItem();
  }
}

// ── End round ─────────────────────────────────────────────────
function sdEndRound() {
  sdPhase = 'done';
  sdRoundLog.push({
    roundIdx: sdRoundIdx,
    roundScores: sdRoundScores.slice(),
  });
  sdProblemStatus.textContent = '라운드 ' + (sdRoundIdx + 1) + ' 완료!';
  sdNextHandle = setTimeout(function() { sdNextRound(); }, SD_RESULT_PAUSE_MS);
}

function sdNextRound() {
  sdRoundIdx++;
  if (sdRoundIdx >= SD_TOTAL_ROUNDS) {
    sdShowResult();
  } else {
    sdStartRound();
  }
}

// ── Start round ───────────────────────────────────────────────
function sdStartRound() {
  var plan = SD_ROUND_PLAN[sdRoundIdx];
  sdItems = sdGenerateItems(plan.phase);
  sdItemIdx = 0;
  sdRoundScores = new Array(sdPlayerCount).fill(0);
  sdDqSet = new Set();
  sdLoadItem();
}

// ── Start game ────────────────────────────────────────────────
function sdStartGame() {
  sdRoundIdx   = 0;
  sdScores     = new Array(sdPlayerCount).fill(0);
  sdRoundLog   = [];
  sdDqSet      = new Set();
  sdPhase      = 'idle';

  sdClearTimers();
  sdBuildZones();
  sdBuildScoreBar();
  sdShowScreen(sdGameScreen);
  sdStartRound();
}

// ── Show result ───────────────────────────────────────────────
function sdShowResult() {
  sdClearTimers();
  sdPhase = 'idle';
  sdSound.play('fanfare');

  var maxScore = Math.max.apply(null, sdScores);
  var winners  = sdScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    sdResultTitle.textContent  = '무승부!';
    sdResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    sdResultTitle.textContent  = '게임 종료!';
    sdResultWinner.textContent = SD_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w2) { return SD_PLAYER_CONFIG[w2].label; }).join(', ');
    sdResultTitle.textContent  = '동점!';
    sdResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  var headRow = document.createElement('tr');
  var headHtml = '<th>라운드</th>';
  for (var i = 0; i < sdPlayerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + SD_PLAYER_CONFIG[i].dot + '"></span>' + SD_PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  sdResultTableHead.innerHTML = '';
  sdResultTableHead.appendChild(headRow);

  // Table body
  sdResultTableBody.innerHTML = '';
  sdRoundLog.forEach(function(log) {
    var tr = document.createElement('tr');
    var plan = SD_ROUND_PLAN[log.roundIdx];
    var phaseLabel = ['', '그림 1개', '색·모양', '그림 3개'][plan.phase];
    var cells = '<td style="text-align:left;font-size:0.82rem;">' + (log.roundIdx + 1) + '라운드 (' + phaseLabel + ')</td>';
    for (var i = 0; i < sdPlayerCount; i++) {
      var pts = log.roundScores[i];
      cells += pts > 0
        ? '<td class="cell-win">+' + pts + '</td>'
        : '<td class="cell-none">0</td>';
    }
    tr.innerHTML = cells;
    sdResultTableBody.appendChild(tr);
  });

  // Total chips
  sdTotalRow.innerHTML = '';
  for (var i = 0; i < sdPlayerCount; i++) {
    var cfg   = SD_PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + sdScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    sdTotalRow.appendChild(chip);
  }

  sdShowScreen(sdResultScreen);
}
