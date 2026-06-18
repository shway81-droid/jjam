/* games/connect-four/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var COLS = 7;
  var ROWS = 6;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
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
    // 디스크 떨어지는 소리: 짧고 단단하게 하강
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

    // 무승부 / 김빠지는 소리
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

    // 턴 변경 - P1 (높은 톤 "딩")
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

    // 턴 변경 - P2 (낮은 톤 "동")
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
  var board;          // board[r][c] = -1(빈칸) | 0 | 1
  var currentPlayer;  // 0 or 1
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금
  var discCount;      // 놓인 디스크 수
  var cellEls;        // cellEls[r][c] = DOM element

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid   = document.getElementById('boardGrid');
  var dropRow     = document.getElementById('dropRow');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  var dropBtns = [];  // 열별 드롭 버튼

  // 아래 화살표 SVG (드롭 버튼 안)
  var SVG_DROP_ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="12" y1="4" x2="12" y2="18"/>' +
      '<polyline points="6 12 12 18 18 12"/>' +
    '</svg>';

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    board = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(-1);
      board.push(row);
    }
    currentPlayer = 0;
    gameOver = false;
    locked = false;
    discCount = 0;

    buildBoard();
    updateTurnUI(false);
    updateDropButtons();

    showScreen('game');
  }

  // ─── 보드 빌드 ────────────────────────────────────────────────────────────
  function buildBoard() {
    // 드롭 버튼 (7열)
    dropRow.innerHTML = '';
    dropBtns = [];
    for (var c = 0; c < COLS; c++) {
      var btn = document.createElement('button');
      btn.className = 'drop-btn';
      btn.setAttribute('data-col', c);
      btn.setAttribute('aria-label', (c + 1) + '번 열에 놓기');
      btn.innerHTML = SVG_DROP_ARROW;
      (function (col) {
        onTap(btn, function () { handleDrop(col); });
      })(c);
      dropRow.appendChild(btn);
      dropBtns.push(btn);
    }

    // 칸 그리드 (행 우선: 위→아래)
    boardGrid.innerHTML = '';
    cellEls = [];
    for (var r = 0; r < ROWS; r++) {
      cellEls.push([]);
      for (var cc = 0; cc < COLS; cc++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', cc);
        // 칸을 탭해도 그 열에 떨어지도록
        (function (col) {
          onTap(cell, function () { handleDrop(col); });
        })(cc);
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

    dropRow.classList.remove('p1', 'p2');
    dropRow.classList.add(pCls);

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

  // ─── 드롭 버튼 활성/비활성 ────────────────────────────────────────────────
  function updateDropButtons() {
    for (var c = 0; c < COLS; c++) {
      var full = board[0][c] !== -1; // 맨 위 칸이 차면 열이 가득 참
      dropBtns[c].disabled = full || gameOver;
    }
    dropRow.classList.toggle('locked', gameOver || locked);
  }

  // ─── 가장 낮은 빈 행 찾기 ─────────────────────────────────────────────────
  function lowestEmptyRow(col) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === -1) return r;
    }
    return -1; // 열이 가득 참
  }

  // ─── 드롭 처리 ────────────────────────────────────────────────────────────
  function handleDrop(col) {
    if (gameOver || locked) return;
    var row = lowestEmptyRow(col);
    if (row < 0) return; // 열 가득 참 → 무시

    locked = true;
    updateDropButtons();

    var p = currentPlayer;
    board[row][col] = p;
    discCount++;

    var cell = cellEls[row][col];
    cell.classList.add(p === 0 ? 'p1' : 'p2', 'dropped');
    sounds.play('drop');

    later(function () {
      cell.classList.remove('dropped');

      var winLine = findWinLine(row, col, p);
      if (winLine) {
        gameOver = true;
        winLine.forEach(function (rc) {
          cellEls[rc[0]][rc[1]].classList.add('win');
        });
        updateDropButtons();
        later(function () {
          sounds.play('win');
          showResult(p, winLine);
        }, RESULT_PAUSE_MS);
        return;
      }

      if (discCount >= ROWS * COLS) {
        // 판 가득 → 무승부
        gameOver = true;
        updateDropButtons();
        later(function () {
          sounds.play('lose');
          showResult(-1, null);
        }, RESULT_PAUSE_MS);
        return;
      }

      // 다음 플레이어로 전환
      currentPlayer = 1 - currentPlayer;
      locked = false;
      updateTurnUI(true);
      updateDropButtons();
    }, 340);
  }

  // ─── 승리 판정: 방금 놓은 디스크 기준 4방향 스캔 ──────────────────────────
  // 반환: 4칸 좌표 배열 [[r,c],...] 또는 null
  function findWinLine(row, col, p) {
    var dirs = [
      [0, 1],   // 가로
      [1, 0],   // 세로
      [1, 1],   // 대각 ↘
      [1, -1]   // 대각 ↙
    ];
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0], dc = dirs[d][1];
      var line = [[row, col]];

      // 정방향
      var r = row + dr, c = col + dc;
      while (inBounds(r, c) && board[r][c] === p) {
        line.push([r, c]);
        r += dr; c += dc;
      }
      // 역방향
      r = row - dr; c = col - dc;
      while (inBounds(r, c) && board[r][c] === p) {
        line.unshift([r, c]);
        r -= dr; c -= dc;
      }

      if (line.length >= 4) {
        // 방금 놓은 디스크를 포함하는 연속 4칸을 반환
        for (var i = 0; i + 4 <= line.length; i++) {
          var window = line.slice(i, i + 4);
          for (var j = 0; j < window.length; j++) {
            if (window[j][0] === row && window[j][1] === col) {
              return window;
            }
          }
        }
        return line.slice(0, 4);
      }
    }
    return null;
  }

  function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
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

  function showResult(winner, winLine) {
    if (winner < 0) {
      // 무승부
      resultIconWrap.innerHTML = SVG_DRAW;
      resultTitle.textContent = '무승부!';
      resultTitle.style.color = '#FB8C00';
      resultSub.textContent = '판이 가득 찼지만 아무도 못 이었어요.';
    } else {
      var winColor = PLAYER_COLORS[winner];
      resultIconWrap.innerHTML = SVG_TROPHY;
      resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
      resultTitle.style.color = winColor;
      resultSub.textContent = '같은 색 네 개를 이었어요!';
    }
    showScreen('result');
  }

  // ─── 버튼 이벤트 바인딩 ──────────────────────────────────────────────────
  // PLAY
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function () { initGame(); });
  });

  // 다시하기
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function () { initGame(); });
  });

  // 홈으로
  onTap(document.getElementById('homeBtn'), function () {
    clearAllTimers();
    goHome();
  });

  // 뒤로 (인트로에서)
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    goHome();
  });

  // 닫기 (게임에서 인트로로)
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    showScreen('intro');
  });

})();
