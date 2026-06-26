/* games/pick-ends/game.js — 패턴 C, 2인 전략 (양끝 동전 집기) */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var COIN_COUNT     = 8;            // 짝수 — 두 사람이 같은 횟수만큼 가져감
  var COIN_MIN       = 1;
  var COIN_MAX       = 9;
  var PLAYER_COLORS  = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES   = ['P1', 'P2'];

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
    // 동전 집기: 짧고 맑은 "팅"
    coin: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
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
    },
    draw: function (ctx) {
      [440, 440].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.24);
      });
    },
    turnP1: function (ctx) {
      [659, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    turnP2: function (ctx) {
      [392, 523].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    }
  });

  // ─── 사운드 버튼 ──────────────────────────────────────────────────────────
  var soundBtns = [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ];
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
  soundBtns.forEach(function (btn) {
    onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var coins;          // [{ value, taken }]
  var leftPtr;        // 남아있는 맨 왼쪽 인덱스
  var rightPtr;       // 남아있는 맨 오른쪽 인덱스
  var currentPlayer;  // 0 or 1
  var totals;         // [p1, p2]
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var coinsRow   = document.getElementById('coinsRow');
  var turnBanner = document.getElementById('turnBanner');
  var turnDot    = document.getElementById('turnDot');
  var turnText   = document.getElementById('turnText');
  var hintText   = document.getElementById('hintText');
  var totalEls   = [document.getElementById('total-0'), document.getElementById('total-1')];
  var totalCards = [document.getElementById('totalCard0'), document.getElementById('totalCard1')];
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    coins = [];
    for (var i = 0; i < COIN_COUNT; i++) {
      coins.push({ value: randInt(COIN_MIN, COIN_MAX), taken: false });
    }
    leftPtr = 0;
    rightPtr = COIN_COUNT - 1;
    currentPlayer = 0;
    totals = [0, 0];
    gameOver = false;
    locked = false;

    buildCoins();
    updateTotalsUI();
    updateTurnUI(false);
    refreshEnds();

    showScreen('game');
  }

  // ─── 동전 줄 빌드 ─────────────────────────────────────────────────────────
  function buildCoins() {
    coinsRow.innerHTML = '';
    coins.forEach(function (coin, idx) {
      var btn = document.createElement('button');
      btn.className = 'coin';
      btn.setAttribute('data-idx', idx);
      btn.innerHTML = '<span class="coin-val">' + coin.value + '</span>';
      onTap(btn, function () { handlePick(idx); });
      coinsRow.appendChild(btn);
      coin.el = btn;
    });
  }

  // ─── 양끝 강조 / 입력 가능 표시 ───────────────────────────────────────────
  function refreshEnds() {
    var pCls = currentPlayer === 0 ? 'p1' : 'p2';
    coins.forEach(function (coin, idx) {
      var btn = coin.el;
      btn.classList.remove('end', 'p1', 'p2');
      var isEnd = !gameOver && !coin.taken && (idx === leftPtr || idx === rightPtr);
      btn.disabled = !isEnd || locked;
      if (isEnd) { btn.classList.add('end', pCls); }
    });
  }

  // ─── 합계 UI ──────────────────────────────────────────────────────────────
  function updateTotalsUI() {
    for (var i = 0; i < 2; i++) {
      totalEls[i].textContent = totals[i];
      totalCards[i].classList.toggle('active', i === currentPlayer && !gameOver);
    }
  }

  // ─── 턴 UI ────────────────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    var color = PLAYER_COLORS[currentPlayer];
    var name  = PLAYER_NAMES[currentPlayer];
    var pCls  = currentPlayer === 0 ? 'p1' : 'p2';

    turnDot.style.background = color;
    turnText.textContent = name + '의 차례';
    turnBanner.classList.remove('p1', 'p2');
    turnBanner.classList.add(pCls);

    var gameScreen = document.getElementById('gameScreen');
    if (gameScreen) {
      gameScreen.classList.remove('turn-p1', 'turn-p2');
      gameScreen.classList.add('turn-' + pCls);
    }
    hintText.textContent = name + ' 차례 — 양쪽 끝(반짝이는 동전) 중 하나를 가져가요';

    if (announce) {
      showTurnOverlay(name, pCls);
      sounds.play(currentPlayer === 0 ? 'turnP1' : 'turnP2');
    }
  }

  function showTurnOverlay(name, pCls) {
    var overlay = document.getElementById('turnOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'turnOverlay';
      overlay.className = 'turn-overlay';
      overlay.innerHTML = '<div class="turn-overlay-text"></div>';
      document.body.appendChild(overlay);
    }
    overlay.className = 'turn-overlay show ' + pCls;
    overlay.querySelector('.turn-overlay-text').textContent = '⚡ ' + name + ' 차례 ⚡';
    void overlay.offsetWidth;
    later(function () { overlay.classList.remove('show'); }, 550);
  }

  // ─── 동전 가져가기 ────────────────────────────────────────────────────────
  function handlePick(idx) {
    if (gameOver || locked) return;
    if (idx !== leftPtr && idx !== rightPtr) return; // 양끝만 허용
    var coin = coins[idx];
    if (coin.taken) return;

    locked = true;
    coin.taken = true;
    totals[currentPlayer] += coin.value;

    sounds.play('coin');
    coin.el.classList.remove('end', 'p1', 'p2');
    coin.el.classList.add('taken', currentPlayer === 0 ? 'taken-p1' : 'taken-p2');
    coin.el.disabled = true;

    // 포인터 이동
    if (idx === leftPtr) leftPtr++;
    else rightPtr--;

    updateTotalsUI();

    later(function () {
      if (leftPtr > rightPtr) {
        endGame();
        return;
      }
      currentPlayer = 1 - currentPlayer;
      locked = false;
      updateTurnUI(true);
      updateTotalsUI();
      refreshEnds();
    }, 360);
  }

  // ─── 결과 ──────────────────────────────────────────────────────────────────
  var SVG_TROPHY =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<rect x="28" y="62" width="24" height="6" rx="3" fill="#FFA726"/>' +
      '<rect x="22" y="68" width="36" height="6" rx="3" fill="#FFA726"/>' +
      '<path d="M15 18 Q15 50 40 54 Q65 50 65 18 Z" fill="#FFD54F" stroke="#FFA726" stroke-width="2"/>' +
      '<path d="M15 18 Q8 18 8 28 Q8 40 20 42 Q15 35 15 26 Z" fill="#FFA726"/>' +
      '<path d="M65 18 Q72 18 72 28 Q72 40 60 42 Q65 35 65 26 Z" fill="#FFA726"/>' +
      '<ellipse cx="40" cy="20" rx="22" ry="6" fill="#FFE082"/>' +
      '<text x="40" y="42" text-anchor="middle" font-size="18" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';
  var SVG_DRAW =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="30" fill="#FFE082" stroke="#FFA726" stroke-width="3"/>' +
      '<text x="40" y="48" text-anchor="middle" font-size="18" font-weight="900" fill="#E65100">=</text>' +
    '</svg>';

  function endGame() {
    gameOver = true;
    locked = true;
    refreshEnds();
    updateTotalsUI();

    var scoreLine = 'P1 ' + totals[0] + ' : ' + totals[1] + ' P2';

    later(function () {
      if (totals[0] === totals[1]) {
        sounds.play('draw');
        resultIconWrap.innerHTML = SVG_DRAW;
        resultTitle.textContent = '무승부!';
        resultTitle.style.color = '#F9A825';
        resultSub.textContent = '두 사람 모두 ' + totals[0] + '점 — ' + scoreLine;
      } else {
        var winner = totals[0] > totals[1] ? 0 : 1;
        sounds.play('win');
        resultIconWrap.innerHTML = SVG_TROPHY;
        resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
        resultTitle.style.color = PLAYER_COLORS[winner];
        resultSub.textContent = scoreLine + '  (' + Math.abs(totals[0] - totals[1]) + '점 차)';
      }
      showScreen('result');
    }, 450);
  }

  // ─── 버튼 이벤트 ──────────────────────────────────────────────────────────
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
