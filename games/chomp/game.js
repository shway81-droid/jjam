/* games/chomp/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var ROWS = 4;
  var COLS = 5;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];

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
    // 한 입 베어물기
    bite: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.26, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.14);
    },
    tension: function (ctx) {
      [[180, 0], [140, 0.12]].forEach(function (item) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = item[0];
        var t = ctx.currentTime + item[1];
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.18);
      });
    },
    win: function (ctx) {
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
      });
    },
    lose: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.62);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.62);
    },
    turnP1: function (ctx) {
      [659, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    turnP2: function (ctx) {
      [392, 523].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
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
  var present;        // present[r][c] = true/false
  var currentPlayer;  // 0 or 1
  var gameOver;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardEl     = document.getElementById('chocoBoard');
  var chocoCount  = document.getElementById('chocoCount');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 초콜릿 SVG ────────────────────────────────────────────────────────────
  function chocoSVG() {
    return (
      '<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">' +
        '<rect x="3" y="3" width="38" height="38" rx="6" fill="#8D6E63" stroke="#5D4037" stroke-width="2.5"/>' +
        '<rect x="8" y="8" width="12" height="12" rx="2" fill="#A1887F"/>' +
        '<rect x="24" y="8" width="12" height="12" rx="2" fill="#A1887F"/>' +
        '<rect x="8" y="24" width="12" height="12" rx="2" fill="#A1887F"/>' +
        '<rect x="24" y="24" width="12" height="12" rx="2" fill="#A1887F"/>' +
      '</svg>'
    );
  }
  function poisonSVG() {
    return (
      '<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">' +
        '<rect x="3" y="3" width="38" height="38" rx="6" fill="#4E342E" stroke="#3E2723" stroke-width="2.5"/>' +
        '<text x="22" y="31" text-anchor="middle" font-size="22">💀</text>' +
      '</svg>'
    );
  }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    present = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(true);
      present.push(row);
    }
    currentPlayer = 0;
    gameOver = false;

    buildBoard();
    updateCounterUI();
    updateTurnUI();
    showScreen('game');
  }

  // ─── 보드 빌드 ─────────────────────────────────────────────────────────────
  function buildBoard() {
    boardEl.innerHTML = '';
    boardEl.classList.remove('locked', 'tension');
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement('button');
        var isPoison = (r === 0 && c === 0);
        cell.className = 'choco-cell' + (isPoison ? ' poison' : '');
        cell.setAttribute('data-r', r);
        cell.setAttribute('data-c', c);
        cell.innerHTML = isPoison ? poisonSVG() : chocoSVG();
        (function (rr, cc) {
          onTap(cell, function () { handleEat(rr, cc); });
        })(r, c);
        boardEl.appendChild(cell);
      }
    }
  }

  function getCell(r, c) {
    return boardEl.querySelector('.choco-cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function countPresent() {
    var n = 0;
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++)
        if (present[r][c]) n++;
    return n;
  }

  // ─── 턴 UI ─────────────────────────────────────────────────────────────────
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

    if (announce) {
      showTurnOverlay(name, color, pCls);
      sounds.play(currentPlayer === 0 ? 'turnP1' : 'turnP2');
    }
  }

  function showTurnOverlay(name, color, pCls) {
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
    setTimeout(function () { overlay.classList.remove('show'); }, 600);
  }

  // ─── 카운터 UI ────────────────────────────────────────────────────────────
  function updateCounterUI() {
    var n = countPresent();
    chocoCount.textContent = n;
    chocoCount.classList.toggle('danger', n <= 3);
    chocoCount.classList.remove('bump');
    void chocoCount.offsetWidth;
    chocoCount.classList.add('bump');
  }

  // ─── 먹기 처리 ─────────────────────────────────────────────────────────────
  function handleEat(r, c) {
    if (gameOver) return;
    if (!present[r][c]) return;

    boardEl.classList.add('locked');
    sounds.play('bite');

    // 오른쪽·아래(포함) 영역 모두 먹기
    var region = [];
    for (var rr = r; rr < ROWS; rr++) {
      for (var cc = c; cc < COLS; cc++) {
        if (present[rr][cc]) {
          present[rr][cc] = false;
          region.push([rr, cc]);
        }
      }
    }

    var delay = 0;
    region.forEach(function (pos, i) {
      later(function () {
        var el = getCell(pos[0], pos[1]);
        if (el) el.classList.add('eaten');
        if (i > 0) sounds.play('bite');
      }, delay);
      delay += 45;
    });

    var atePoison = (r === 0 && c === 0);

    later(function () {
      updateCounterUI();

      var remaining = countPresent();
      // 독 초콜릿만 남았을 때 긴장 강조
      if (remaining === 1 && present[0][0]) {
        boardEl.classList.add('tension');
        sounds.play('tension');
      }

      if (atePoison) {
        gameOver = true;
        var loser  = currentPlayer;
        var winner = 1 - currentPlayer;
        later(function () {
          sounds.play('lose');
          later(function () {
            sounds.play('win');
            showResult(winner, loser);
          }, 400);
        }, 200);
      } else {
        currentPlayer = 1 - currentPlayer;
        updateTurnUI(true);
        boardEl.classList.remove('locked');
      }
    }, delay + 80);
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
      '<text x="40" y="42" text-anchor="middle" font-size="18" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';

  function showResult(winner, loser) {
    var winColor = PLAYER_COLORS[winner];
    resultIconWrap.innerHTML = SVG_TROPHY;
    resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
    resultTitle.style.color = winColor;
    resultSub.textContent = PLAYER_NAMES[loser] + '가 💀 독 초콜릿을 먹었어요!';
    showScreen('result');
  }

  // ─── 버튼 이벤트 바인딩 ──────────────────────────────────────────────────
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
