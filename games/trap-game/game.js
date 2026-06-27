/* games/trap-game/game.js — 패턴 C (2인 전략) — 가두기 대결
   5×5 격자에서 두 말이 번갈아 이웃 칸으로 이동. 지나온 칸은 벽이 됨.
   자기 차례에 갈 수 있는 칸이 하나도 없으면 패배(상대 승리).
*/

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var SIZE = 5;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];
  var PLAYER_PAWNS  = ['🐰', '🦊'];

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
    move: function (ctx) {
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
    lose: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
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
  var walls;          // [SIZE][SIZE] boolean — 지나온(막힌) 칸
  var pawns;          // [{r,c},{r,c}]
  var currentPlayer;  // 0 or 1
  var gameOver;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid  = document.getElementById('boardGrid');
  var boardHint  = document.getElementById('boardHint');
  var turnBanner = document.getElementById('turnBanner');
  var turnDot    = document.getElementById('turnDot');
  var turnText   = document.getElementById('turnText');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 좌표 헬퍼 ────────────────────────────────────────────────────────────
  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function pawnAt(r, c) {
    for (var p = 0; p < 2; p++) if (pawns[p].r === r && pawns[p].c === c) return p;
    return -1;
  }
  function cellFree(r, c) {
    return inBounds(r, c) && !walls[r][c] && pawnAt(r, c) === -1;
  }
  // 현재 player가 갈 수 있는 이웃 칸 목록
  function legalMoves(player) {
    var p = pawns[player];
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var moves = [];
    dirs.forEach(function (d) {
      var nr = p.r + d[0], nc = p.c + d[1];
      if (cellFree(nr, nc)) moves.push({ r: nr, c: nc });
    });
    return moves;
  }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    walls = [];
    for (var r = 0; r < SIZE; r++) {
      walls.push([]);
      for (var c = 0; c < SIZE; c++) walls[r].push(false);
    }
    pawns = [{ r: 0, c: 0 }, { r: SIZE - 1, c: SIZE - 1 }];
    currentPlayer = 0;
    gameOver = false;

    buildBoard();
    renderBoard();
    updateTurnUI(false);

    showScreen('game');
  }

  // ─── 보드 빌드 (한 번만 셀 DOM 생성) ──────────────────────────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('button');
        cell.className = 'cell';
        cell.setAttribute('data-r', r);
        cell.setAttribute('data-c', c);
        (function (rr, cc) {
          onTap(cell, function () { handleCellTap(rr, cc); });
        })(r, c);
        boardGrid.appendChild(cell);
      }
    }
  }

  function getCellEl(r, c) {
    return boardGrid.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  // ─── 보드 렌더 ────────────────────────────────────────────────────────────
  function renderBoard() {
    var legal = gameOver ? [] : legalMoves(currentPlayer);
    var legalSet = {};
    legal.forEach(function (m) { legalSet[m.r + ',' + m.c] = true; });

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = getCellEl(r, c);
        cell.className = 'cell';
        cell.textContent = '';
        var who = pawnAt(r, c);
        if (who !== -1) {
          cell.classList.add('pawn', who === 0 ? 'p1' : 'p2');
          cell.textContent = PLAYER_PAWNS[who];
        } else if (walls[r][c]) {
          cell.classList.add('wall');
        } else if (legalSet[r + ',' + c]) {
          cell.classList.add('target', currentPlayer === 0 ? 'p1' : 'p2');
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

    var legal = legalMoves(currentPlayer);
    var ok = legal.some(function (m) { return m.r === r && m.c === c; });
    if (!ok) return; // 이동 가능한 칸이 아니면 무시

    // 이동: 떠난 칸은 벽이 됨
    var p = pawns[currentPlayer];
    walls[p.r][p.c] = true;
    pawns[currentPlayer] = { r: r, c: c };
    sounds.play('move');

    // 상대로 턴 전환
    var mover = currentPlayer;
    currentPlayer = 1 - currentPlayer;

    // 다음 플레이어가 움직일 수 있는지 검사
    if (legalMoves(currentPlayer).length === 0) {
      gameOver = true;
      renderBoard();
      var winner = mover;
      var loser  = currentPlayer;
      later(function () {
        sounds.play('lose');
        later(function () {
          sounds.play('win');
          showResult(winner, loser);
        }, 400);
      }, 250);
      return;
    }

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
    resultSub.textContent = PLAYER_NAMES[loser] + '가 더 이상 움직일 수 없어요!';
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
