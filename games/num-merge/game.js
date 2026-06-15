/* games/num-merge/game.js */

(function () {
  'use strict';

  // ─── 규칙 ────────────────────────────────────────────────────────────────
  // 4×4 보드에서 같은 수끼리 밀어 합쳐 두 배로 만든다(2→4→8→16→32).
  // 먼저 목표 타일을 만든 플레이어가 승리. 두 보드는 같은 시작으로 출발한다.
  var SIZE = 4;
  var CELLS = SIZE * SIZE;
  var TARGET = 32;

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
    slide: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    merge: function (ctx) {
      [523, 698].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.06;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
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
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });
  updateSoundIcons();

  // ─── 2048 로직 ───────────────────────────────────────────────────────────
  function slideVals(vals) {
    var nz = vals.filter(function (v) { return v > 0; });
    var res = [], merged = false, i = 0;
    while (i < nz.length) {
      if (i + 1 < nz.length && nz[i] === nz[i + 1]) {
        res.push(nz[i] * 2);
        merged = true;
        i += 2;
      } else {
        res.push(nz[i]);
        i++;
      }
    }
    while (res.length < SIZE) res.push(0);
    return { res: res, merged: merged };
  }

  function getLines(dir) {
    var L = [], r, c;
    if (dir === 'left')  for (r = 0; r < SIZE; r++) L.push([r*4+0, r*4+1, r*4+2, r*4+3]);
    if (dir === 'right') for (r = 0; r < SIZE; r++) L.push([r*4+3, r*4+2, r*4+1, r*4+0]);
    if (dir === 'up')    for (c = 0; c < SIZE; c++) L.push([0*4+c, 1*4+c, 2*4+c, 3*4+c]);
    if (dir === 'down')  for (c = 0; c < SIZE; c++) L.push([3*4+c, 2*4+c, 1*4+c, 0*4+c]);
    return L;
  }

  function applyMove(board, dir) {
    var lines = getLines(dir), moved = false, merged = false;
    lines.forEach(function (idx) {
      var vals = idx.map(function (i) { return board[i]; });
      var r = slideVals(vals);
      if (r.merged) merged = true;
      for (var k = 0; k < SIZE; k++) {
        if (board[idx[k]] !== r.res[k]) {
          board[idx[k]] = r.res[k];
          moved = true;
        }
      }
    });
    return { moved: moved, merged: merged };
  }

  function emptyCells(board) {
    var e = [];
    for (var i = 0; i < CELLS; i++) if (board[i] === 0) e.push(i);
    return e;
  }

  function spawn(board) {
    var e = emptyCells(board);
    if (e.length === 0) return;
    var idx = e[Math.floor(Math.random() * e.length)];
    board[idx] = Math.random() < 0.9 ? 2 : 4;
  }

  function hasMoves(board) {
    if (emptyCells(board).length > 0) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r*4+c];
        if (c + 1 < SIZE && board[r*4+c+1] === v) return true;
        if (r + 1 < SIZE && board[(r+1)*4+c] === v) return true;
      }
    }
    return false;
  }

  function bestTile(board) {
    var m = 0;
    for (var i = 0; i < CELLS; i++) if (board[i] > m) m = board[i];
    return m;
  }

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var boards = { 1: null, 2: null };
  var won;        // null | 0(draw) | 1 | 2
  var locked;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var gridEls = { 1: document.getElementById('p1Grid'), 2: document.getElementById('p2Grid') };
  var bestEls = { 1: document.getElementById('p1Best'), 2: document.getElementById('p2Best') };
  var bannerEl = document.getElementById('banner');
  var resultTitle = document.getElementById('resultTitle');
  var resultSub = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 보드 셀 생성 (1회) ──────────────────────────────────────────────────
  function buildCells(grid) {
    grid.innerHTML = '';
    for (var i = 0; i < CELLS; i++) {
      var cell = document.createElement('div');
      cell.className = 'tile tile-empty';
      grid.appendChild(cell);
    }
  }

  function render(player) {
    var board = boards[player];
    var cells = gridEls[player].children;
    for (var i = 0; i < CELLS; i++) {
      var v = board[i];
      var cell = cells[i];
      if (v === 0) {
        cell.className = 'tile tile-empty';
        cell.textContent = '';
      } else {
        cell.className = 'tile tile-' + v + (v >= TARGET ? ' tile-goal' : '');
        cell.textContent = String(v);
      }
    }
    bestEls[player].textContent = '최고 ' + bestTile(board);
  }

  // ─── 입력 처리 ───────────────────────────────────────────────────────────
  function handleMove(player, dir) {
    if (locked || won !== null) return;
    var board = boards[player];
    var r = applyMove(board, dir);
    if (!r.moved) return;
    spawn(board);
    render(player);
    sounds.play(r.merged ? 'merge' : 'slide');

    if (bestTile(board) >= TARGET) {
      endGame(player);
      return;
    }
    // 두 보드 모두 더 이상 움직일 수 없으면 무승부
    if (!hasMoves(boards[1]) && !hasMoves(boards[2])) {
      endGame(0);
    }
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    won = null;
    locked = false;
    bannerEl.classList.remove('show');
    bannerEl.textContent = '';

    // 두 보드는 동일한 시작 배치로 출발 (공정)
    var start = new Array(CELLS).fill(0);
    spawn(start);
    spawn(start);
    boards[1] = start.slice();
    boards[2] = start.slice();

    buildCells(gridEls[1]);
    buildCells(gridEls[2]);
    render(1);
    render(2);
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

  var SVG_DRAW =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  function endGame(player) {
    won = player;
    locked = true;
    if (player === 0) {
      resultTitle.textContent = '무승부!';
      resultSub.textContent = '둘 다 더 움직일 수 없어요!';
      resultIconWrap.innerHTML = SVG_DRAW;
    } else {
      resultTitle.textContent = 'P' + player + ' 승리!';
      resultSub.textContent = '먼저 ' + TARGET + '을 만들었어요!';
      resultIconWrap.innerHTML = SVG_TROPHY;
    }
    sounds.play('win');
    later(function () { showScreen('result'); }, 700);
  }

  // ─── 방향 버튼 이벤트 ────────────────────────────────────────────────────
  var dirBtns = document.querySelectorAll('.dir-btn');
  dirBtns.forEach(function (btn) {
    var player = parseInt(btn.getAttribute('data-player'), 10);
    var dir = btn.getAttribute('data-dir');
    onTap(btn, function () { handleMove(player, dir); });
  });

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function() { initGame(); });
  });
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function() { initGame(); });
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
