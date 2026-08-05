/* games/op-combo/game.js — 패턴 D (협력 조합) — 연산 콤비
 * P1은 연산 기호(＋−×), P2는 숫자를 골라 "앞의 수 op 숫자 = 목표"를 함께 만든다. */

(function () {
  'use strict';

  var TOTAL_ROUNDS = 5;

  // ─── 연산 정의 ────────────────────────────────────────────────────────────
  var OPS = [
    { key: 'add', sym: '+' },
    { key: 'sub', sym: '−' },
    { key: 'mul', sym: '×' }
  ];

  function applyOp(a, key, n) {
    if (key === 'add') return a + n;
    if (key === 'sub') return a - n;
    return a * n;
  }

  function ri(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // 한 라운드 생성: 정답 (연산, 숫자)이 반드시 존재하도록 구성.
  // 반환: { a, target, ops(3), nums(4), solKey, solN }
  function makeRound() {
    var solKey = OPS[ri(0, 2)].key;
    var a, n, target;
    if (solKey === 'add') {
      a = ri(2, 9); n = ri(1, 9); target = a + n;
    } else if (solKey === 'sub') {
      a = ri(4, 9); n = ri(1, a - 1); target = a - n;
    } else {
      a = ri(2, 6); n = ri(2, 4); target = a * n;
    }

    // P2 숫자 카드: 정답 숫자 + 오답 3개
    var maxCard = (solKey === 'mul') ? 9 : 12;
    var numSet = {}; var nums = [n]; numSet[n] = true;
    while (nums.length < 4) {
      var cand = ri(1, maxCard);
      if (!numSet[cand]) { numSet[cand] = true; nums.push(cand); }
    }

    return {
      a: a,
      target: target,
      ops: shuffleArr(OPS.slice()),   // 세 기호 모두 제공
      nums: shuffleArr(nums),
      solKey: solKey,
      solN: n
    };
  }

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
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
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
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
  var currentRound;
  var score;
  var problems;       // 이번 게임 5개 라운드
  var p1Selected;     // { idx, op }
  var p2Selected;     // { idx, val }
  var locked;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1Pick       = document.getElementById('p1Pick');
  var p2Pick       = document.getElementById('p2Pick');
  var aValEl       = document.getElementById('aVal');
  var targetVal    = document.getElementById('targetVal');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildBoard(grid, items, player) {
    grid.innerHTML = '';
    items.forEach(function (item, idx) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = item.label;
      btn.setAttribute('data-idx', idx);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, item, grid);
      });
      grid.appendChild(btn);
    });
  }

  function buildCards(round) {
    buildBoard(p1Grid, round.ops.map(function (o) { return { label: o.sym, op: o }; }), 1);
    buildBoard(p2Grid, round.nums.map(function (v) { return { label: String(v), val: v }; }), 2);
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(player, idx, item, grid) {
    sounds.play('pick');

    var cards = grid.querySelectorAll('.num-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cards[idx].classList.add('selected');

    if (player === 1) {
      p1Selected = { idx: idx, op: item.op };
      p1Pick.textContent = item.op.sym;
    } else {
      p2Selected = { idx: idx, val: item.val };
      p2Pick.textContent = item.val;
    }

    if (p1Selected && p2Selected) {
      locked = true;
      boardsEl.classList.add('locked');
      later(checkAnswer, 500);
    }
  }

  // ─── 채점 ────────────────────────────────────────────────────────────────
  function checkAnswer() {
    var round = problems[currentRound];
    var result = applyOp(round.a, p1Selected.op.key, p2Selected.val);
    var ok = result === round.target;
    var expr = round.a + ' ' + p1Selected.op.sym + ' ' + p2Selected.val;

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      showBanner('성공! ' + expr + ' = ' + round.target, 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      showBanner('아쉬워요! ' + expr + ' = ' + result + ' (목표 ' + round.target + ')', 'ng');
      sounds.play('wrong');
    }

    updateScoreUI();

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        nextRound();
      }
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

    var round = problems[currentRound];
    aValEl.textContent = round.a;
    targetVal.textContent = round.target;
    buildCards(round);
    updateRoundUI();
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng');
    bannerEl.textContent = '';
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    currentRound = 0;
    score = 0;
    p1Selected = null;
    p2Selected = null;
    locked = false;
    problems = [];
    for (var i = 0; i < TOTAL_ROUNDS; i++) problems.push(makeRound());
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
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    var title, sub, icon;
    if (score === TOTAL_ROUNDS) {
      title = score + '/' + TOTAL_ROUNDS; sub = '완벽한 협력이에요! 👏'; icon = SVG_TROPHY;
    } else if (score >= 3) {
      title = score + '/' + TOTAL_ROUNDS; sub = '훌륭한 팀워크! 다시 도전해봐요'; icon = SVG_OK;
    } else {
      title = score + '/' + TOTAL_ROUNDS; sub = '조금 더 호흡을 맞춰봐요!'; icon = SVG_HAND;
    }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function () { initGame(); });
  });
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function () { initGame(); });
  });
  onTap(document.getElementById('homeBtn'), function () {
    clearAllTimers(); goHome();
  });
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers(); goHome();
  });
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers(); showScreen('intro');
  });

})();
