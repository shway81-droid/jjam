/* games/three-mill/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var CELL_COUNT = 9;           // 3×3 격자 (인덱스 0..8: 위→아래, 왼→오)
  var PIECES_PER = 3;           // 한 사람이 가진 말 개수
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];
  var RESULT_PAUSE_MS = getAutoplayPauseMs(900);

  // 승리 라인 8개: 가로3 · 세로3 · 대각선2
  var WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  // 이웃 칸(옮길 수 있는 칸): 판에 그어진 선(가로·세로·대각선)으로 이어진 칸.
  // 가운데(4)는 모든 칸과 이어지고, 변(1,3,5,7)·모서리(0,2,6,8)는 가운데 + 인접 두 칸.
  var ADJ = {
    0: [1, 3, 4],
    1: [0, 2, 4],
    2: [1, 5, 4],
    3: [0, 4, 6],
    4: [0, 1, 2, 3, 5, 6, 7, 8],
    5: [2, 4, 8],
    6: [3, 4, 7],
    7: [4, 6, 8],
    8: [4, 5, 7]
  };

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
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    },
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
  var board;          // board[i] = -1(빈칸) | 0 | 1
  var currentPlayer;  // 0 or 1
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금
  var phase;          // 'place'(놓기) | 'move'(옮기기)
  var placedCount;    // 놓인 말 총 개수 (0..6)
  var selected;       // 옮기기 단계에서 고른 내 말 인덱스 | null
  var cellEls;        // cellEls[i] = DOM element

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
    for (var i = 0; i < CELL_COUNT; i++) board.push(-1);
    currentPlayer = 0;
    gameOver = false;
    locked = false;
    phase = 'place';
    placedCount = 0;
    selected = null;

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
      cell.setAttribute('aria-label', (i + 1) + '번 칸');
      (function (idx) {
        onTap(cell, function () { handleTap(idx); });
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
    var hint  = phase === 'place' ? '말 놓기' : '말 옮기기';

    turnDot.style.background = color;
    turnText.textContent = name + '의 차례 · ' + hint;

    turnBanner.classList.remove('p1', 'p2');
    turnBanner.classList.add(pCls);

    boardGrid.classList.remove('p1', 'p2');
    boardGrid.classList.add(pCls);
    boardGrid.classList.toggle('movephase', phase === 'move');

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

  // ─── 탭 처리: 단계에 따라 놓기 / 옮기기 ────────────────────────────────────
  function handleTap(idx) {
    if (gameOver || locked) return;

    if (phase === 'place') {
      if (board[idx] !== -1) return;   // 이미 찬 칸
      placePiece(idx);
      return;
    }

    // 옮기기 단계
    if (selected === null) {
      if (board[idx] === currentPlayer) selectPiece(idx);
      return;
    }
    if (idx === selected) { clearSelection(); return; }         // 다시 눌러 선택 해제
    if (board[idx] === currentPlayer) { selectPiece(idx); return; } // 다른 내 말 선택
    if (board[idx] === -1 && ADJ[selected].indexOf(idx) !== -1) {
      movePiece(selected, idx);                                 // 이웃 빈 칸으로 이동
    }
    // 그 밖의(멀거나 상대 말) 칸은 무시
  }

  // ─── 말 놓기 (놓기 단계) ───────────────────────────────────────────────────
  function placePiece(idx) {
    locked = true;
    updateLockState();

    var p = currentPlayer;
    board[idx] = p;
    placedCount++;

    var cell = cellEls[idx];
    cell.classList.add(p === 0 ? 'p1' : 'p2', 'dropped');
    sounds.play('drop');

    later(function () {
      cell.classList.remove('dropped');

      var winLine = findWinLine(p);
      if (winLine) { finishWin(p, winLine); return; }

      if (placedCount >= PIECES_PER * 2) phase = 'move'; // 여섯 개 다 놓음 → 옮기기 단계
      advanceTurn();
    }, 340);
  }

  // ─── 내 말 선택 (옮기기 단계) ──────────────────────────────────────────────
  function selectPiece(idx) {
    clearSelectionUI();
    selected = idx;
    cellEls[idx].classList.add('selected');
    sounds.play('pick');
    // 옮길 수 있는 이웃 빈 칸 표시
    ADJ[idx].forEach(function (j) {
      if (board[j] === -1) cellEls[j].classList.add('movable');
    });
  }

  function clearSelection() {
    selected = null;
    clearSelectionUI();
  }

  function clearSelectionUI() {
    for (var i = 0; i < CELL_COUNT; i++) {
      cellEls[i].classList.remove('selected', 'movable');
    }
  }

  // ─── 말 옮기기 (옮기기 단계) ───────────────────────────────────────────────
  function movePiece(from, to) {
    locked = true;
    updateLockState();

    var p = currentPlayer;
    clearSelectionUI();
    selected = null;

    board[from] = -1;
    board[to] = p;

    var fromCell = cellEls[from];
    fromCell.classList.remove('p1', 'p2');

    var toCell = cellEls[to];
    toCell.classList.add(p === 0 ? 'p1' : 'p2', 'dropped');
    sounds.play('drop');

    later(function () {
      toCell.classList.remove('dropped');

      var winLine = findWinLine(p);
      if (winLine) { finishWin(p, winLine); return; }

      advanceTurn();
    }, 340);
  }

  // ─── 다음 차례로 (승리 없음) ───────────────────────────────────────────────
  function advanceTurn() {
    currentPlayer = 1 - currentPlayer;
    selected = null;
    locked = false;

    // 옮기기 단계인데 이번 차례가 움직일 수 없으면(모두 막힘) 상대 승리
    if (phase === 'move' && !hasLegalMove(currentPlayer)) {
      gameOver = true;
      updateLockState();
      later(function () {
        sounds.play('win');
        showResult(1 - currentPlayer, null);
      }, RESULT_PAUSE_MS);
      return;
    }

    updateTurnUI(true);
    updateLockState();
  }

  function hasLegalMove(p) {
    for (var i = 0; i < CELL_COUNT; i++) {
      if (board[i] !== p) continue;
      for (var k = 0; k < ADJ[i].length; k++) {
        if (board[ADJ[i][k]] === -1) return true;
      }
    }
    return false;
  }

  // ─── 승리 처리 ─────────────────────────────────────────────────────────────
  function finishWin(p, winLine) {
    gameOver = true;
    clearSelectionUI();
    winLine.forEach(function (i) { cellEls[i].classList.add('win'); });
    updateLockState();
    later(function () {
      sounds.play('win');
      showResult(p, winLine);
    }, RESULT_PAUSE_MS);
  }

  // ─── 승리 판정: 8개 라인 검사 ──────────────────────────────────────────────
  function findWinLine(p) {
    for (var k = 0; k < WIN_LINES.length; k++) {
      var line = WIN_LINES[k];
      if (board[line[0]] === p && board[line[1]] === p && board[line[2]] === p) {
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

  function showResult(winner, winLine) {
    if (winner < 0) {
      resultIconWrap.innerHTML = SVG_DRAW;
      resultTitle.textContent = '비겼어요!';
      resultTitle.style.color = '#FB8C00';
      resultSub.textContent = '아무도 세 줄을 만들지 못했어요.';
    } else {
      var winColor = PLAYER_COLORS[winner];
      resultIconWrap.innerHTML = SVG_TROPHY;
      resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
      resultTitle.style.color = winColor;
      resultSub.textContent = '말 세 개를 나란히 이었어요!';
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
