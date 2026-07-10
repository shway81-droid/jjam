/* games/midpoint-pair/game.js */

(function () {
  'use strict';

  var LINE_MAX = 20;

  // ─── 라운드 데이터 (풀에서 5개 선택) ───────────────────────────────────────
  // 각 항목: target(목표), p1(왼쪽 수 4개 <target), p2(오른쪽 수 4개 >target)
  // 목표에서 같은 거리(대칭)인 (a,b) 쌍이 적어도 하나 존재하도록 구성.
  var PROBLEM_POOL = [
    { target: 10, p1: [7, 4, 6, 2],   p2: [13, 15, 12, 17] }, // (7,13) d3
    { target: 9,  p1: [6, 4, 7, 2],   p2: [12, 13, 15, 16] }, // (6,12)d3 (2,16)d7
    { target: 12, p1: [8, 9, 5, 10],  p2: [15, 17, 14, 20] }, // (9,15)d3 (10,14)d2
    { target: 8,  p1: [5, 3, 6, 2],   p2: [11, 12, 10, 15] }, // (5,11)d3 (6,10)d2
    { target: 11, p1: [7, 5, 8, 3],   p2: [15, 16, 18, 13] }, // (7,15) d4
    { target: 7,  p1: [5, 3, 2, 1],   p2: [9, 10, 12, 8]   }, // (5,9)d2 (2,12)d5
    { target: 13, p1: [8, 10, 6, 11], p2: [18, 17, 19, 14] }, // (8,18) d5
    { target: 6,  p1: [4, 3, 2, 1],   p2: [8, 7, 11, 13]   }, // (4,8)d2 (1,11)d5
    { target: 14, p1: [10, 8, 11, 6], p2: [18, 16, 19, 15] }, // (10,18) d4
    { target: 10, p1: [8, 5, 3, 1],   p2: [12, 14, 16, 18] }  // (8,12) d2
  ];

  var TOTAL_ROUNDS = 5;

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
  }

  // ─── 화면 전환 ────────────────────────────────────────────────────────────
  var screens = {
    intro:     document.getElementById('introScreen'),
    countdown: document.getElementById('countdownScreen'),
    game:      document.getElementById('gameScreen'),
    result:    document.getElementById('resultScreen')
  };
  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
    });
  }

  var countdownInterval = null;
  function startCountdown(onDone) {
    var countdownNumber = document.getElementById('countdownNumber');
    showScreen('countdown');
    countdownInterval = runCountdown(countdownNumber, onDone);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    pick: function (ctx) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    correct: function (ctx) {
      [659, 784, 988].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.22);
      });
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    },
    win: function (ctx) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
      });
    }
  });

  // ─── 사운드 버튼 ──────────────────────────────────────────────────────────
  var soundIconIds = ['soundIconIntro', 'soundIconGame'];
  var SVG_SOUND_ON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_SOUND_OFF = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  function updateSoundIcons() {
    var muted = sounds.isMuted();
    soundIconIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
    });
  }
  [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ].forEach(function (btn) {
    if (!btn) return;
    onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var currentRound, score, problems;
  var p1Selected, p2Selected, locked;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var targetVal    = document.getElementById('targetVal');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  var nlTicks   = document.getElementById('nlTicks');
  var nlTarget  = document.getElementById('nlTarget');
  var nlP1       = document.getElementById('nlP1');
  var nlP2       = document.getElementById('nlP2');
  var nlP1Val    = document.getElementById('nlP1Val');
  var nlP2Val    = document.getElementById('nlP2Val');
  var p1DistEl   = document.getElementById('p1Dist');
  var p2DistEl   = document.getElementById('p2Dist');
  var distEqEl   = document.getElementById('distEq');

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pct(val) { return (val / LINE_MAX) * 100; }

  // ─── 수직선 눈금 렌더 ─────────────────────────────────────────────────────
  function buildTicks() {
    nlTicks.innerHTML = '';
    for (var v = 0; v <= LINE_MAX; v++) {
      var tick = document.createElement('div');
      var major = (v % 5 === 0);
      tick.className = 'nl-tick' + (major ? ' major' : '');
      tick.style.left = pct(v) + '%';
      if (major) {
        var lab = document.createElement('span');
        lab.className = 'nl-tick-label';
        lab.textContent = v;
        tick.appendChild(lab);
      }
      nlTicks.appendChild(tick);
    }
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, nums, player) {
    grid.innerHTML = '';
    nums.forEach(function (n, idx) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = n;
      btn.setAttribute('data-idx', idx);
      btn.setAttribute('data-val', n);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, n, grid);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(player, idx, val, grid) {
    sounds.play('pick');
    var cards = grid.querySelectorAll('.num-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cards[idx].classList.add('selected');

    var problem = problems[currentRound];
    if (player === 1) {
      p1Selected = { idx: idx, val: val };
      placeMarker(nlP1, nlP1Val, val);
      p1DistEl.textContent = problem.target - val;
    } else {
      p2Selected = { idx: idx, val: val };
      placeMarker(nlP2, nlP2Val, val);
      p2DistEl.textContent = val - problem.target;
    }

    if (p1Selected && p2Selected) {
      locked = true;
      boardsEl.classList.add('locked');
      later(checkAnswer, 550);
    }
  }

  function placeMarker(markerEl, valEl, val) {
    markerEl.style.left = pct(val) + '%';
    markerEl.classList.add('show');
    markerEl.classList.remove('ok');
    if (valEl) valEl.textContent = val;
  }

  // ─── 채점 ────────────────────────────────────────────────────────────────
  function checkAnswer() {
    var problem = problems[currentRound];
    var dA = problem.target - p1Selected.val;   // 왼쪽 거리 (양수: a<target)
    var dB = p2Selected.val - problem.target;   // 오른쪽 거리 (양수: b>target)
    var ok = (dA === dB);

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      nlP1.classList.add('ok');
      nlP2.classList.add('ok');
      distEqEl.textContent = '=';
      distEqEl.classList.add('match');
      showBanner('성공! 목표 ' + problem.target + '에서 양쪽 ' + dA + '칸 대칭!', 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      distEqEl.textContent = '≠';
      distEqEl.classList.add('mismatch');
      showBanner('아쉬워요! 왼쪽 ' + dA + '칸 · 오른쪽 ' + dB + '칸 (거리가 달라요)', 'ng');
      sounds.play('wrong');
    }
    updateScoreUI();

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) showResult();
      else nextRound();
    }, 1700);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    boardsEl.classList.remove('locked');
    p1Selected = null;
    p2Selected = null;
    hideBanner();

    nlP1.classList.remove('show', 'ok');
    nlP2.classList.remove('show', 'ok');
    p1DistEl.textContent = '?';
    p2DistEl.textContent = '?';
    distEqEl.textContent = '=?';
    distEqEl.classList.remove('match', 'mismatch');

    var problem = problems[currentRound];
    targetVal.textContent = problem.target;
    nlTarget.style.left = pct(problem.target) + '%';
    nlTarget.setAttribute('data-val', problem.target);

    buildCards(p1Grid, shuffleArr(problem.p1), 1);
    buildCards(p2Grid, shuffleArr(problem.p2), 2);
    updateRoundUI();
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() { roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS; }
  function updateScoreUI() { roundScoreEl.textContent = '★ ' + score; }
  function showBanner(text, cls) { bannerEl.textContent = text; bannerEl.className = 'banner show ' + cls; }
  function hideBanner() { bannerEl.classList.remove('show', 'ok', 'ng'); bannerEl.textContent = ''; }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    currentRound = 0;
    score = 0;
    p1Selected = null;
    p2Selected = null;
    locked = false;
    problems = shuffleArr(PROBLEM_POOL).slice(0, TOTAL_ROUNDS);
    buildTicks();
    updateScoreUI();
    nextRound();
    showScreen('game');
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  var SVG_TROPHY =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<rect x="28" y="62" width="24" height="6" rx="3" fill="#FFA726"/>' +
      '<rect x="22" y="68" width="36" height="6" rx="3" fill="#FFA726"/>' +
      '<path d="M15 18 Q15 50 40 54 Q65 50 65 18 Z" fill="#FFD54F" stroke="#FFA726" stroke-width="2"/>' +
      '<path d="M15 18 Q8 18 8 28 Q8 40 20 42 Q15 35 15 26 Z" fill="#FFA726"/>' +
      '<path d="M65 18 Q72 18 72 28 Q72 40 60 42 Q65 35 65 26 Z" fill="#FFA726"/>' +
      '<ellipse cx="40" cy="20" rx="22" ry="6" fill="#FFE082"/>' +
      '<text x="40" y="42" text-anchor="middle" font-size="16" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';
  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';
  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#B2EBF2" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#00838F" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    var title = score + '/' + TOTAL_ROUNDS, sub, icon;
    if (score === TOTAL_ROUNDS) { sub = '완벽한 협력이에요! 👏'; icon = SVG_TROPHY; }
    else if (score >= 3) { sub = '훌륭한 팀워크! 다시 도전해봐요'; icon = SVG_OK; }
    else { sub = '조금 더 호흡을 맞춰봐요!'; icon = SVG_HAND; }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () { startCountdown(function () { initGame(); }); });
  onTap(document.getElementById('retryBtn'), function () { startCountdown(function () { initGame(); }); });
  onTap(document.getElementById('homeBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('backBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('closeBtn'), function () { clearAllTimers(); showScreen('intro'); });

})();
