/* games/hex-link/game.js — 패턴 C (2인 전략) — 맞은편 잇기 (Hex)
   6×6 평행사변형(육각 인접) 보드. 두 사람이 번갈아 빈 칸에 자기 색 돌을 놓는다.
   P1(파랑)은 위↕아래, P2(빨강)는 왼↔오른쪽 맞은편 변을 자기 색 돌로 끊김 없이
   먼저 이으면 승리. 육각 위상이라 무승부가 없다(누군가는 반드시 잇는다).
*/

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var SIZE = 6;
  var EMPTY = -1;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];
  // 육각 인접: 좌·우·위2·아래2 (오른쪽으로 밀린 평행사변형 기준)
  var NEIGHBORS = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]];

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
    place: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
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
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
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
  [document.getElementById('soundToggleIntro'), document.getElementById('soundToggleGame')].forEach(function (btn) {
    onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var cells;          // [SIZE][SIZE] : EMPTY / 0 / 1
  var currentPlayer;  // 0 or 1
  var gameOver;
  var lastMove;       // {r,c} or null

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid  = document.getElementById('boardGrid');
  var boardHint  = document.getElementById('boardHint');
  var turnBanner = document.getElementById('turnBanner');
  var turnDot    = document.getElementById('turnDot');
  var turnText   = document.getElementById('turnText');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 승리 판정 (BFS) ──────────────────────────────────────────────────────
  // player 0: 위(row 0) → 아래(row SIZE-1). player 1: 왼(col 0) → 오른(col SIZE-1).
  function checkWin(player) {
    var visited = {};
    var stack = [];
    var i;
    for (i = 0; i < SIZE; i++) {
      if (player === 0) {
        if (cells[0][i] === 0) { stack.push([0, i]); visited['0,' + i] = true; }
      } else {
        if (cells[i][0] === 1) { stack.push([i, 0]); visited[i + ',0'] = true; }
      }
    }
    while (stack.length) {
      var cur = stack.pop();
      var r = cur[0], c = cur[1];
      if (player === 0 && r === SIZE - 1) return true;
      if (player === 1 && c === SIZE - 1) return true;
      for (var k = 0; k < NEIGHBORS.length; k++) {
        var nr = r + NEIGHBORS[k][0];
        var nc = c + NEIGHBORS[k][1];
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE &&
            cells[nr][nc] === player && !visited[nr + ',' + nc]) {
          visited[nr + ',' + nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
    return false;
  }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    cells = [];
    for (var r = 0; r < SIZE; r++) {
      cells.push([]);
      for (var c = 0; c < SIZE; c++) cells[r].push(EMPTY);
    }
    currentPlayer = 0;
    gameOver = false;
    lastMove = null;

    buildBoard();
    renderBoard();
    updateTurnUI(false);

    showScreen('game');
  }

  // ─── 보드 빌드 (평행사변형: 행마다 오른쪽으로 반 칸 밀기) ───────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    for (var r = 0; r < SIZE; r++) {
      var row = document.createElement('div');
      row.className = 'hex-row';
      // 육각 위상을 보이도록 행을 반 칸씩 오른쪽으로 이동
      row.style.marginLeft = 'calc((var(--cell) + var(--hex-gap)) * ' + (r * 0.5) + ')';
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('button');
        cell.className = 'cell';
        cell.setAttribute('data-r', r);
        cell.setAttribute('data-c', c);
        if (r === 0) cell.classList.add('edge-top');
        if (r === SIZE - 1) cell.classList.add('edge-bottom');
        if (c === 0) cell.classList.add('edge-left');
        if (c === SIZE - 1) cell.classList.add('edge-right');
        (function (rr, cc) {
          onTap(cell, function () { handleCellTap(rr, cc); });
        })(r, c);
        row.appendChild(cell);
      }
      boardGrid.appendChild(row);
    }
  }

  function getCellEl(r, c) {
    return boardGrid.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  // ─── 보드 렌더 ────────────────────────────────────────────────────────────
  function renderBoard() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = getCellEl(r, c);
        cell.classList.remove('stone', 'p1', 'p2', 'last');
        var who = cells[r][c];
        if (who !== EMPTY) {
          cell.classList.add('stone', who === 0 ? 'p1' : 'p2');
          if (lastMove && lastMove.r === r && lastMove.c === c) cell.classList.add('last');
        }
      }
    }
  }

  // ─── 턴 UI 업데이트 ──────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    var color = PLAYER_COLORS[currentPlayer];
    var name  = PLAYER_NAMES[currentPlayer];
    var pCls  = currentPlayer === 0 ? 'p1' : 'p2';

    turnDot.style.background = color;
    turnText.textContent = name + ' 차례 · ' + (currentPlayer === 0 ? '위·아래 잇기' : '왼·오른쪽 잇기');

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
    setTimeout(function () { overlay.classList.remove('show'); }, 600);
  }

  // ─── 칸 탭 처리 ──────────────────────────────────────────────────────────
  function handleCellTap(r, c) {
    if (gameOver) return;
    if (cells[r][c] !== EMPTY) return; // 이미 놓인 칸이면 무시

    cells[r][c] = currentPlayer;
    lastMove = { r: r, c: c };
    sounds.play('place');

    var mover = currentPlayer;
    if (checkWin(mover)) {
      gameOver = true;
      renderBoard();
      later(function () {
        sounds.play('win');
        showResult(mover, 1 - mover);
      }, 300);
      return;
    }

    currentPlayer = 1 - currentPlayer;
    renderBoard();
    updateTurnUI(true);
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
    resultSub.textContent = (winner === 0 ? '위·아래' : '왼·오른쪽') + '를 먼저 이었어요!';
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
