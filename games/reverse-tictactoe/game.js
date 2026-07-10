/* games/reverse-tictactoe/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var SIZE = 3;                 // 3×3 격자
  var CELL_COUNT = SIZE * SIZE; // 9칸
  var PLAYER_COLORS = ['#29B6F6', '#EF5350']; // 턴 표시용 (표식 자체는 공통 ✕)
  var PLAYER_NAMES  = ['P1', 'P2'];
  var RESULT_PAUSE_MS = getAutoplayPauseMs(950);

  // 세 칸 라인 8개: 가로3 · 세로3 · 대각선2 (각 칸은 0..8 인덱스)
  // 거꾸로 삼목 — 이 라인을 "완성(3칸 모두 채움)"하면 그 사람이 진다.
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // 가로
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // 세로
    [0, 4, 8], [2, 4, 6]               // 대각선
  ];

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
    drop: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    },

    // 세 칸을 잇고 만 순간 — 김빠지는 하강음 (진 사람)
    bust: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    },

    // 승리 팡파레
    win: function (ctx) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.42);
      });
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
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
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
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
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
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });

  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var board;          // board[i] = 0(빈칸) | 1(표식 놓임)   (i = 0..8)
  var currentPlayer;  // 0 or 1
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금
  var markCount;      // 놓인 표식 수
  var cellEls;        // cellEls[i] = DOM element

  // 공통 표식 ✕ (같은 표식 — 누가 놓았든 동일 모양)
  var MARK_SVG =
    '<svg class="mark-x" viewBox="0 0 40 40" width="100%" height="100%">' +
      '<line x1="10" y1="10" x2="30" y2="30" stroke="#2C2C2C" stroke-width="6" stroke-linecap="round"/>' +
      '<line x1="30" y1="10" x2="10" y2="30" stroke="#2C2C2C" stroke-width="6" stroke-linecap="round"/>' +
    '</svg>';

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid   = document.getElementById('boardGrid');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    board = [];
    for (var i = 0; i < CELL_COUNT; i++) board.push(0);
    currentPlayer = 0;
    gameOver = false;
    locked = false;
    markCount = 0;

    buildBoard();
    updateTurnUI(false);
    updateLockState();

    showScreen('game');
  }

  // ─── 보드 빌드 ────────────────────────────────────────────────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    cellEls = [];
    for (var i = 0; i < CELL_COUNT; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-index', i);
      cell.setAttribute('aria-label', (i + 1) + '번 칸에 놓기');
      (function (idx) {
        onTap(cell, function () { handlePlace(idx); });
      })(i);
      boardGrid.appendChild(cell);
      cellEls.push(cell);
    }
  }

  // ─── 턴 UI 업데이트 ──────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    var color = PLAYER_COLORS[currentPlayer];
    var name  = PLAYER_NAMES[currentPlayer];
    var pCls  = currentPlayer === 0 ? 'p1' : 'p2';

    turnDot.style.background = color;
    turnText.textContent = name + '의 차례';

    turnBanner.classList.remove('p1', 'p2');
    turnBanner.classList.add(pCls);

    boardGrid.classList.remove('p1', 'p2');
    boardGrid.classList.add(pCls);

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

  // ─── 풀스크린 턴 변경 오버레이 ──────────────────────────────────────────
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
    later(function () {
      overlay.classList.remove('show');
    }, 600);
  }

  // ─── 입력 잠금 상태 반영 ──────────────────────────────────────────────────
  function updateLockState() {
    boardGrid.classList.toggle('locked', gameOver || locked);
  }

  // ─── 칸에 표식 놓기 ───────────────────────────────────────────────────────
  function handlePlace(idx) {
    if (gameOver || locked) return;
    if (board[idx] !== 0) return; // 이미 채워진 칸 → 무시

    locked = true;
    updateLockState();

    var p = currentPlayer;
    board[idx] = 1;
    markCount++;

    var cell = cellEls[idx];
    cell.classList.add('marked', 'dropped');
    cell.innerHTML = MARK_SVG;
    sounds.play('drop');

    later(function () {
      cell.classList.remove('dropped');

      // 거꾸로 삼목: 방금 놓아 세 칸이 모두 찬 라인이 생기면 → 놓은 사람이 패배
      var line = findCompletedLine();
      if (line) {
        gameOver = true;
        line.forEach(function (i) {
          cellEls[i].classList.add('lose');
        });
        updateLockState();
        later(function () {
          sounds.play('bust');
          // 놓은 사람(p)이 지고, 상대가 승리
          later(function () {
            sounds.play('win');
            showResult(1 - p);
          }, 250);
        }, RESULT_PAUSE_MS);
        return;
      }

      if (markCount >= CELL_COUNT) {
        // 이론상 도달 불가(먼저 라인이 완성됨) — 안전망: 무승부
        gameOver = true;
        updateLockState();
        later(function () {
          showResult(-1);
        }, RESULT_PAUSE_MS);
        return;
      }

      // 다음 플레이어로 전환
      currentPlayer = 1 - currentPlayer;
      locked = false;
      updateTurnUI(true);
      updateLockState();
    }, 340);
  }

  // ─── 완성된 라인 찾기: 세 칸 모두 채워진 라인 (표식은 공통이라 채움 여부만 검사) ─
  function findCompletedLine() {
    for (var k = 0; k < LINES.length; k++) {
      var line = LINES[k];
      if (board[line[0]] === 1 && board[line[1]] === 1 && board[line[2]] === 1) {
        return line;
      }
    }
    return null;
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

  var SVG_DRAW =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="30" fill="#FFE082" stroke="#FFA726" stroke-width="3"/>' +
      '<circle cx="30" cy="34" r="4" fill="#8D6E63"/>' +
      '<circle cx="50" cy="34" r="4" fill="#8D6E63"/>' +
      '<line x1="28" y1="52" x2="52" y2="52" stroke="#8D6E63" stroke-width="4" stroke-linecap="round"/>' +
    '</svg>';

  function showResult(winner) {
    if (winner < 0) {
      resultIconWrap.innerHTML = SVG_DRAW;
      resultTitle.textContent = '비겼어요!';
      resultTitle.style.color = '#FB8C00';
      resultSub.textContent = '아무도 세 칸을 잇지 않았어요.';
    } else {
      var winColor = PLAYER_COLORS[winner];
      var loser = 1 - winner;
      resultIconWrap.innerHTML = SVG_TROPHY;
      resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
      resultTitle.style.color = winColor;
      resultSub.textContent = PLAYER_NAMES[loser] + '이(가) 세 칸을 잇고 말았어요!';
    }
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
    clearAllTimers();
    goHome();
  });

  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    goHome();
  });

  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    showScreen('intro');
  });

})();
