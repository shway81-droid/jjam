/* games/clock-build/game.js — 시계 함께 맞추기 (2인 협력 시각 만들기) */

(function () {
  'use strict';

  // ─── 시계 협력 ───────────────────────────────────────────────────────────
  // 목표 시계(아날로그)를 읽고 P1은 '시', P2는 '분' 카드를 골라 시각을 맞춘다.
  // 두 보드 모두 항상 활성 — 둘 다 골라야 채점, 틀리면 그 라운드 실패.
  var TOTAL_ROUNDS = 5;

  // 라운드별 난이도: 분 목표 후보 + 보기 후보 풀
  // phase 1: 정각/30분, phase 2: 15분 단위, phase 3: 5분 단위
  var ROUND_PLAN = [
    { phase: 1 },
    { phase: 1 },
    { phase: 2 },
    { phase: 3 },
    { phase: 3 }
  ];

  var MIN_TARGETS = {
    1: [0, 30],
    2: [0, 15, 30, 45],
    3: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  };
  var MIN_POOL = {
    1: [0, 15, 30, 45],
    2: [0, 10, 15, 20, 30, 40, 45, 50],
    3: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  };

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
  [document.getElementById('soundToggleIntro'), document.getElementById('soundToggleGame')]
    .forEach(function (btn) {
      if (!btn) return;
      onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
    });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var currentRound, score, problems, p1Selected, p2Selected, locked;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1Pick       = document.getElementById('p1Pick');
  var p2Pick       = document.getElementById('p2Pick');
  var targetClock  = document.getElementById('targetClock');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 유틸 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // 정답 1개 + 무작위 보기로 4장 (중복 없음)
  function pickFour(correct, pool) {
    var set = [correct];
    var bag = shuffleArr(pool);
    for (var i = 0; i < bag.length && set.length < 4; i++) {
      if (set.indexOf(bag[i]) === -1) set.push(bag[i]);
    }
    return shuffleArr(set);
  }

  // ─── 아날로그 시계 SVG ─────────────────────────────────────────────────────
  function handXY(angleDeg, len) {
    var rad = angleDeg * Math.PI / 180;
    return { x: 60 + len * Math.sin(rad), y: 60 - len * Math.cos(rad) };
  }
  function clockSVG(hour, minute) {
    var hourAngle = (hour % 12) * 30 + minute * 0.5;
    var minAngle = minute * 6;
    var h = handXY(hourAngle, 28);
    var m = handXY(minAngle, 42);
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = handXY(i * 30, 50);
      var b = handXY(i * 30, (i % 3 === 0) ? 42 : 46);
      ticks += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
               '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
               '" stroke="#2C2C2C" stroke-width="' + (i % 3 === 0 ? 3 : 1.5) + '" stroke-linecap="round"/>';
    }
    var nums = '';
    var labels = [[12, 0, -36], [3, 36, 0], [6, 0, 36], [9, -36, 0]];
    labels.forEach(function (l) {
      nums += '<text x="' + (60 + l[1]) + '" y="' + (60 + l[2] + 6) + '" text-anchor="middle" font-size="13" font-weight="900" fill="#2C2C2C">' + l[0] + '</text>';
    });
    return '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="55" fill="#FFFFFF" stroke="#2C2C2C" stroke-width="3"/>' +
      ticks + nums +
      '<line x1="60" y1="60" x2="' + h.x.toFixed(1) + '" y2="' + h.y.toFixed(1) + '" stroke="#2C2C2C" stroke-width="6" stroke-linecap="round"/>' +
      '<line x1="60" y1="60" x2="' + m.x.toFixed(1) + '" y2="' + m.y.toFixed(1) + '" stroke="#5C6BC0" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="5" fill="#2C2C2C"/>' +
      '</svg>';
  }

  // ─── 문제 빌드 ─────────────────────────────────────────────────────────────
  function buildProblem(plan) {
    var hour = randInt(1, 12);
    var minTargets = MIN_TARGETS[plan.phase];
    var minute = minTargets[Math.floor(Math.random() * minTargets.length)];
    var hourPool = [];
    for (var h = 1; h <= 12; h++) hourPool.push(h);
    return {
      hour: hour,
      minute: minute,
      p1: pickFour(hour, hourPool),
      p2: pickFour(minute, MIN_POOL[plan.phase])
    };
  }
  function buildProblems() {
    return ROUND_PLAN.map(function (plan) { return buildProblem(plan); });
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, items, player) {
    grid.innerHTML = '';
    items.forEach(function (val, idx) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = player === 2 ? pad2(val) : String(val);
      btn.setAttribute('data-idx', idx);
      btn.setAttribute('data-val', val);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, val, grid);
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

    if (player === 1) {
      p1Selected = { idx: idx, val: val };
      p1Pick.textContent = String(val);
    } else {
      p2Selected = { idx: idx, val: val };
      p2Pick.textContent = pad2(val);
    }

    if (p1Selected && p2Selected) {
      locked = true;
      boardsEl.classList.add('locked');
      later(checkAnswer, 500);
    }
  }

  // ─── 채점 ────────────────────────────────────────────────────────────────
  function checkAnswer() {
    var problem = problems[currentRound];
    var ok = (p1Selected.val === problem.hour) && (p2Selected.val === problem.minute);

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      showBanner('성공! ' + problem.hour + '시 ' + problem.minute + '분', 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      showBanner('아쉬워요! 정답은 ' + problem.hour + '시 ' + problem.minute + '분', 'ng');
      sounds.play('wrong');
    }
    updateScoreUI();

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) showResult();
      else nextRound();
    }, 1600);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    boardsEl.classList.remove('locked');
    p1Selected = null;
    p2Selected = null;
    p1Pick.textContent = '?';
    p2Pick.textContent = '?';
    hideBanner();

    var problem = problems[currentRound];
    targetClock.innerHTML = clockSVG(problem.hour, problem.minute);
    buildCards(p1Grid, problem.p1, 1);
    buildCards(p2Grid, problem.p2, 2);
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
    problems = buildProblems();
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
  var SVG_CLOCK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C5CAE9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🕐</text>' +
    '</svg>';
  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    var title = score + '/' + TOTAL_ROUNDS, sub, icon;
    if (score === TOTAL_ROUNDS) { sub = '완벽한 시계 마스터! 👏'; icon = SVG_TROPHY; }
    else if (score >= 3) { sub = '훌륭한 팀워크! 다시 도전해봐요'; icon = SVG_OK; }
    else { sub = '시침과 분침을 다시 살펴봐요!'; icon = SVG_CLOCK; }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () { startCountdown(function() { initGame(); }); });
  onTap(document.getElementById('retryBtn'), function () { startCountdown(function() { initGame(); }); });
  onTap(document.getElementById('homeBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('backBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('closeBtn'), function () { clearAllTimers(); showScreen('intro'); });

})();
