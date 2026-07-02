/* games/five-row/game.js — 오목 (free-placement five-in-a-row) */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var SIZE = 9;                 // 9x9 판
  var WIN_LEN = 5;              // 다섯 개를 이으면 승리
  var PLAYER_COLORS = ['#37474F', '#B0BEC5']; // P1 어두운 돌 / P2 밝은 돌(배너용)
  var PLAYER_NAMES  = ['P1', 'P2'];
  var RESULT_PAUSE_MS = getAutoplayPauseMs(900);

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
    // 돌 놓는 소리: 짧고 단단한 "딱"
    place: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    },

    // 빈 칸 아닌 곳 탭 → 버즈
    buzz: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
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

    // 무승부
    lose: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    },

    // 턴 변경 - P1 (높은 톤)
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

    // 턴 변경 - P2 (낮은 톤)
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

  [document.getElementById('soundToggleIntro'),
   document.getElementById('soundToggleGame')].forEach(function (btn) {
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });

  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var board;          // board[r][c] = -1(빈칸) | 0 | 1
  var currentPlayer;  // 0 or 1
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금
  var stoneCount;     // 놓인 돌 수
  var cellEls;        // cellEls[r][c] = DOM element

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
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(-1);
      board.push(row);
    }
    currentPlayer = 0;
    gameOver = false;
    locked = false;
    stoneCount = 0;

    buildBoard();
    updateTurnUI(false);
    updateLock();

    showScreen('game');
  }

  // ─── 보드 빌드 (9x9 빈 칸 그리드) ─────────────────────────────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    cellEls = [];
    for (var r = 0; r < SIZE; r++) {
      cellEls.push([]);
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (c === SIZE - 1) cell.classList.add('last-col');
        if (r === SIZE - 1) cell.classList.add('last-row');
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        (function (rr, cc) {
          onTap(cell, function () { handlePlace(rr, cc); });
        })(r, c);
        boardGrid.appendChild(cell);
        cellEls[r].push(cell);
      }
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

    var gameScreen = document.getElementById('gameScreen');
    if (gameScreen) {
      gameScreen.classList.remove('turn-p1', 'turn-p2');
      gameScreen.classList.add('turn-' + pCls);
    }

    if (announce) {
      showTurnOverlay(name, pCls);
      sounds.play(currentPlayer === 0 ? 'turnP1' : 'turnP2');
    }
  }

  // ─── 풀스크린 턴 변경 오버레이 ──────────────────────────────────────────
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
    overlay.querySelector('.turn-overlay-text').textContent = '⚫ ' + name + ' 차례 ⚪';
    void overlay.offsetWidth;
    later(function () {
      overlay.classList.remove('show');
    }, 600);
  }

  // ─── 입력 잠금 갱신 ───────────────────────────────────────────────────────
  function updateLock() {
    boardGrid.classList.toggle('locked', gameOver || locked);
  }

  // ─── 돌 놓기 처리 (자유 배치 — 중력 없음) ───────────────────────────────────
  function handlePlace(row, col) {
    if (gameOver || locked) return;

    // 이미 돌이 있는 칸 = 버즈 후 무시
    if (board[row][col] !== -1) {
      sounds.play('buzz');
      return;
    }

    locked = true;
    updateLock();

    var p = currentPlayer;
    board[row][col] = p;
    stoneCount++;

    var cell = cellEls[row][col];
    var stone = document.createElement('div');
    stone.className = 'stone placed';
    cell.classList.add(p === 0 ? 'p1' : 'p2');
    cell.appendChild(stone);
    sounds.play('place');

    later(function () {
      stone.classList.remove('placed');

      var winLine = findWinLine(board, row, col, p);
      if (winLine) {
        gameOver = true;
        winLine.forEach(function (rc) {
          cellEls[rc[0]][rc[1]].classList.add('win');
        });
        updateLock();
        later(function () {
          sounds.play('win');
          showResult(p);
        }, RESULT_PAUSE_MS);
        return;
      }

      if (stoneCount >= SIZE * SIZE) {
        // 판 가득 → 무승부
        gameOver = true;
        updateLock();
        later(function () {
          sounds.play('lose');
          showResult(-1);
        }, RESULT_PAUSE_MS);
        return;
      }

      // 다음 플레이어로 전환
      currentPlayer = 1 - currentPlayer;
      locked = false;
      updateTurnUI(true);
      updateLock();
    }, 240);
  }

  // ─── 승리 판정: 방금 놓은 돌 기준 4방향 스캔 (5목 이상) ──────────────────────
  // 순수 함수: (board, row, col, p) → 승리한 연속 칸 좌표 배열 또는 null
  function findWinLine(bd, row, col, p) {
    var size = bd.length;
    var dirs = [
      [0, 1],   // 가로 →
      [1, 0],   // 세로 ↓
      [1, 1],   // 대각 ↘
      [1, -1]   // 대각 ↙
    ];
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0], dc = dirs[d][1];
      var line = [[row, col]];

      // 정방향으로 같은 색 연속 수집
      var r = row + dr, c = col + dc;
      while (inBounds(r, c, size) && bd[r][c] === p) {
        line.push([r, c]);
        r += dr; c += dc;
      }
      // 역방향으로 같은 색 연속 수집
      r = row - dr; c = col - dc;
      while (inBounds(r, c, size) && bd[r][c] === p) {
        line.unshift([r, c]);
        r -= dr; c -= dc;
      }

      if (line.length >= WIN_LEN) {
        return line; // 5개 이상 연속 → 승리 (전체 줄 강조)
      }
    }
    return null;
  }

  function inBounds(r, c, size) {
    return r >= 0 && r < size && c >= 0 && c < size;
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
      // 무승부
      resultIconWrap.innerHTML = SVG_DRAW;
      resultTitle.textContent = '무승부!';
      resultTitle.style.color = '#FB8C00';
      resultSub.textContent = '판이 가득 찼지만 아무도 못 이었어요.';
    } else {
      resultIconWrap.innerHTML = SVG_TROPHY;
      resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
      resultTitle.style.color = winner === 0 ? '#37474F' : '#607D8B';
      resultSub.textContent = '돌 다섯 개를 이었어요!';
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
