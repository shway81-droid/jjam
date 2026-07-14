/* games/carpet-duel/game.js
 * 카펫 깔기 대결 — Domineering
 * P1(가로): 빈 두 칸을 오른쪽으로 이어 카펫을 깐다.
 * P2(세로): 빈 두 칸을 아래로 이어 카펫을 깐다.
 * 자기 차례에 더 이상 카펫을 못 까는 사람이 진다.
 */
(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var ROWS = 6;
  var COLS = 6;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];
  // P1=가로(horizontal), P2=세로(vertical)
  var RESULT_PAUSE_MS = getAutoplayPauseMs(900);

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
      osc.frequency.setValueAtTime(360, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.26, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.16);
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
  var board;          // board[r][c] = -1(빈칸) | 0 | 1
  var currentPlayer;  // 0(P1 가로) or 1(P2 세로)
  var gameOver;
  var locked;
  var cellEls;        // cellEls[r][c] = DOM element

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid   = document.getElementById('boardGrid');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var turnHint    = document.getElementById('turnHint');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

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

    buildBoard();
    updateTurnUI(false);
    refreshHints();

    showScreen('game');
  }

  // ─── 보드 빌드 ────────────────────────────────────────────────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    boardGrid.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
    cellEls = [];
    for (var r = 0; r < ROWS; r++) {
      cellEls.push([]);
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        (function (rr, cc) {
          onTap(cell, function () { handleTap(rr, cc); });
        })(r, c);
        boardGrid.appendChild(cell);
        cellEls[r].push(cell);
      }
    }
  }

  // ─── 규칙: 유효한 시작 칸(anchor) 판정 ────────────────────────────────────
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  // player가 (r,c)를 시작 칸으로 카펫을 깔 수 있는가?
  // P1(0): (r,c)+(r,c+1) 가로 / P2(1): (r,c)+(r+1,c) 세로
  function validAnchor(player, r, c) {
    if (board[r][c] !== -1) return false;
    if (player === 0) {
      return c + 1 < COLS && board[r][c + 1] === -1;
    } else {
      return r + 1 < ROWS && board[r + 1][c] === -1;
    }
  }

  function hasMove(player) {
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++)
        if (validAnchor(player, r, c)) return true;
    return false;
  }

  // ─── 카펫 깔기 (탭 처리) ──────────────────────────────────────────────────
  function handleTap(r, c) {
    if (gameOver || locked) return;
    if (!validAnchor(currentPlayer, r, c)) {
      // 잘못된 칸 — 흔들림 피드백
      var bad = cellEls[r][c];
      if (bad && board[r][c] === -1) {
        bad.classList.add('nudge');
        later(function () { bad.classList.remove('nudge'); }, 300);
      }
      return;
    }

    locked = true;
    var p = currentPlayer;

    var r2 = p === 0 ? r : r + 1;
    var c2 = p === 0 ? c + 1 : c;
    board[r][c]   = p;
    board[r2][c2] = p;

    var pcls = p === 0 ? 'p1' : 'p2';
    var a = cellEls[r][c];
    var b = cellEls[r2][c2];
    a.classList.add('filled', pcls, 'placed', p === 0 ? 'th-l' : 'tv-t');
    b.classList.add('filled', pcls, 'placed', p === 0 ? 'th-r' : 'tv-b');
    sounds.play('place');

    refreshHints(); // 놓은 즉시 힌트 제거 (locked 상태)

    later(function () {
      a.classList.remove('placed');
      b.classList.remove('placed');

      // 다음 플레이어로 전환 후, 그 사람이 놓을 자리가 없으면 진다.
      currentPlayer = 1 - currentPlayer;
      if (!hasMove(currentPlayer)) {
        gameOver = true;
        var winner = 1 - currentPlayer; // 방금 놓은 사람
        later(function () {
          sounds.play('win');
          showResult(winner);
        }, RESULT_PAUSE_MS);
        return;
      }

      locked = false;
      updateTurnUI(true);
      refreshHints();
    }, 260);
  }

  // ─── 힌트: 현재 플레이어가 놓을 수 있는 시작 칸 표시 ──────────────────────
  function refreshHints() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = cellEls[r][c];
        cell.classList.remove('valid', 'hint-h', 'hint-v');
        if (!gameOver && !locked && validAnchor(currentPlayer, r, c)) {
          cell.classList.add('valid', currentPlayer === 0 ? 'hint-h' : 'hint-v');
        }
      }
    }
    boardGrid.classList.remove('p1', 'p2');
    boardGrid.classList.add(currentPlayer === 0 ? 'p1' : 'p2');
  }

  // ─── 턴 UI ─────────────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    var color = PLAYER_COLORS[currentPlayer];
    var name  = PLAYER_NAMES[currentPlayer];
    var pCls  = currentPlayer === 0 ? 'p1' : 'p2';
    var dir   = currentPlayer === 0 ? '가로(→)로 깔기' : '세로(↓)로 깔기';

    turnDot.style.background = color;
    turnText.textContent = name + '의 차례';
    if (turnHint) turnHint.textContent = name + ' — ' + dir;

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
    later(function () { overlay.classList.remove('show'); }, 600);
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

  function showResult(winner) {
    var winColor = PLAYER_COLORS[winner];
    resultIconWrap.innerHTML = SVG_TROPHY;
    resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
    resultTitle.style.color = winColor;
    resultSub.textContent = '상대가 더 이상 카펫을 깔 자리가 없어요!';
    showScreen('result');
  }

  // ─── 버튼 이벤트 ──────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'),  function () { startCountdown(function () { initGame(); }); });
  onTap(document.getElementById('retryBtn'), function () { startCountdown(function () { initGame(); }); });
  onTap(document.getElementById('homeBtn'),  function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('backBtn'),  function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('closeBtn'), function () { clearAllTimers(); showScreen('intro'); });

})();
