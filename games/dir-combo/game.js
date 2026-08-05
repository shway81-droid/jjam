/* games/dir-combo/game.js */

(function () {
  'use strict';

  // ─── 미로 데이터 (점증 난이도, 모두 BFS 해 존재 검증됨) ───────────────────
  // 각 라운드: cols, rows, start[c,r], goal[c,r], walls:[[c,r],...]
  // 좌표계: c(열)는 오른쪽으로 증가, r(행)은 아래로 증가.
  // 대각선 이동 허용(dx,dy ∈ -1/0/+1, 둘 다 0은 제외) 기준으로 풀 수 있음.
  var ROUNDS = [
    { cols: 5, rows: 5, start: [0, 0], goal: [4, 4],
      walls: [[2, 1], [2, 2], [2, 3]] },
    { cols: 5, rows: 5, start: [0, 4], goal: [4, 0],
      walls: [[1, 1], [2, 2], [3, 3], [1, 3]] },
    { cols: 6, rows: 6, start: [0, 0], goal: [5, 5],
      walls: [[1, 1], [2, 2], [3, 3], [4, 4], [1, 4], [4, 1]] },
    { cols: 6, rows: 6, start: [0, 5], goal: [5, 0],
      walls: [[1, 1], [1, 2], [2, 4], [3, 1], [3, 2], [4, 4], [4, 3]] },
    { cols: 7, rows: 7, start: [0, 0], goal: [6, 6],
      walls: [[1, 2], [2, 2], [3, 2], [4, 4], [5, 4], [6, 4], [2, 5], [3, 5]] },
    { cols: 7, rows: 7, start: [0, 6], goal: [6, 0],
      walls: [[1, 1], [2, 1], [3, 3], [4, 3], [5, 3], [1, 4], [2, 4], [5, 5], [4, 5]] },
    { cols: 7, rows: 7, start: [3, 6], goal: [3, 0],
      walls: [[1, 1], [2, 1], [4, 1], [5, 1], [2, 3], [3, 3], [4, 3], [1, 5], [2, 5], [4, 5], [5, 5]] },
    { cols: 7, rows: 7, start: [0, 3], goal: [6, 3],
      walls: [[2, 0], [2, 1], [2, 2], [4, 4], [4, 5], [4, 6], [3, 3], [2, 5], [5, 1]] }
  ];

  var GAME_SECONDS = 60;
  var MISS_PENALTY = 2;            // 벽/밖 충돌 시 시간 페널티(초)
  var RESULT_PAUSE_MS = function () { return getAutoplayPauseMs(900); };

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  var gameTimer = null;

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
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
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    },
    correct: function (ctx) {
      [659, 784, 988].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
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

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var roundIdx;        // 현재 미로 인덱스
  var score;           // 클리어한 미로 수(협력 점수)
  var pos;             // 토큰 현재 위치 [c, r]
  var pendingP1;       // dx ∈ -1/0/+1 또는 null
  var pendingP2;       // dy ∈ -1/0/+1 또는 null
  var wallSet;         // 현재 미로 벽 집합
  var current;         // 현재 미로 객체
  var locked;          // 이동 애니메이션/라운드 전환 중 잠금
  var timeLeft;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var mazeBoard    = document.getElementById('mazeBoard');
  var p1Btns       = document.getElementById('p1Btns');
  var p2Btns       = document.getElementById('p2Btns');
  var timeNumEl    = document.getElementById('timeNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 미로 헬퍼 ───────────────────────────────────────────────────────────
  function cellKey(c, r) { return c + ',' + r; }

  function isWall(c, r) { return !!wallSet[cellKey(c, r)]; }

  function inBounds(c, r) {
    return c >= 0 && r >= 0 && c < current.cols && r < current.rows;
  }

  // BFS — 시작에서 목표까지 대각 이동 허용 경로 존재 여부 (방어용 자가검증)
  function isSolvable(m) {
    var walls = {};
    m.walls.forEach(function (w) { walls[cellKey(w[0], w[1])] = 1; });
    if (walls[cellKey(m.start[0], m.start[1])]) return false;
    if (walls[cellKey(m.goal[0], m.goal[1])]) return false;
    var seen = {};
    var q = [[m.start[0], m.start[1]]];
    seen[cellKey(m.start[0], m.start[1])] = 1;
    while (q.length) {
      var cur = q.shift();
      if (cur[0] === m.goal[0] && cur[1] === m.goal[1]) return true;
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          var nc = cur[0] + dx, nr = cur[1] + dy;
          if (nc < 0 || nr < 0 || nc >= m.cols || nr >= m.rows) continue;
          if (walls[cellKey(nc, nr)]) continue;
          if (seen[cellKey(nc, nr)]) continue;
          seen[cellKey(nc, nr)] = 1;
          q.push([nc, nr]);
        }
      }
    }
    return false;
  }

  // ─── 보드 렌더 ───────────────────────────────────────────────────────────
  function renderBoard() {
    mazeBoard.innerHTML = '';
    mazeBoard.style.gridTemplateColumns = 'repeat(' + current.cols + ', auto)';
    // 셀 크기: 그리드가 너무 커지지 않게 열 수에 맞춰 축소
    var cell = Math.max(26, Math.min(48, Math.floor(300 / current.cols)));
    mazeBoard.style.setProperty('--cell', cell + 'px');

    for (var r = 0; r < current.rows; r++) {
      for (var c = 0; c < current.cols; c++) {
        var div = document.createElement('div');
        div.className = 'cell';
        div.setAttribute('data-c', c);
        div.setAttribute('data-r', r);
        if (isWall(c, r)) div.classList.add('wall');
        if (c === current.goal[0] && r === current.goal[1]) {
          div.classList.add('goal');
          div.textContent = '🏁';
        }
        mazeBoard.appendChild(div);
      }
    }
    renderToken();
  }

  function cellAt(c, r) {
    return mazeBoard.querySelector('.cell[data-c="' + c + '"][data-r="' + r + '"]');
  }

  function renderToken() {
    // 기존 토큰 제거
    var old = mazeBoard.querySelector('.token');
    if (old && old.parentElement) old.parentElement.removeChild(old);
    var cell = cellAt(pos[0], pos[1]);
    if (!cell) return;
    var span = document.createElement('span');
    span.className = 'token';
    span.textContent = '🚀';
    cell.appendChild(span);
  }

  // ─── 보류 선택 처리 ──────────────────────────────────────────────────────
  function buildControls() {
    // P1: 좌우 (dx)
    p1Btns.innerHTML = '';
    [['←', -1], ['⏸', 0], ['→', 1]].forEach(function (def) {
      var btn = makeDirBtn(def[0], def[1], 1);
      p1Btns.appendChild(btn);
    });
    // P2: 상하 (dy). 화면상 위(↑)는 r 감소.
    p2Btns.innerHTML = '';
    [['↑', -1], ['⏸', 0], ['↓', 1]].forEach(function (def) {
      var btn = makeDirBtn(def[0], def[1], 2);
      p2Btns.appendChild(btn);
    });
  }

  function makeDirBtn(label, delta, player) {
    var btn = document.createElement('button');
    btn.className = 'dir-btn';
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute('data-delta', delta);
    onTap(btn, function () {
      if (locked) return;
      choose(player, delta, btn);
    });
    return btn;
  }

  function choose(player, delta, btn) {
    sounds.play('pick');
    var grid = player === 1 ? p1Btns : p2Btns;
    var btns = grid.querySelectorAll('.dir-btn');
    btns.forEach(function (b) { b.classList.remove('pending'); });
    btn.classList.add('pending');

    if (player === 1) pendingP1 = delta;
    else pendingP2 = delta;

    if (pendingP1 !== null && pendingP2 !== null) {
      resolveStep();
    }
  }

  function clearPending() {
    pendingP1 = null;
    pendingP2 = null;
    p1Btns.querySelectorAll('.dir-btn').forEach(function (b) { b.classList.remove('pending'); });
    p2Btns.querySelectorAll('.dir-btn').forEach(function (b) { b.classList.remove('pending'); });
  }

  // ─── 한 스텝 해결: 조합 벡터로 한 칸 이동 ─────────────────────────────────
  function resolveStep() {
    locked = true;
    var dx = pendingP1;
    var dy = pendingP2;
    var nc = pos[0] + dx;
    var nr = pos[1] + dy;

    var illegal = !inBounds(nc, nr) || isWall(nc, nr);

    if (illegal) {
      // 벽/밖 → 토큰 흔들고 buzz + 시간 페널티
      var cur = cellAt(pos[0], pos[1]);
      if (cur) {
        cur.classList.remove('shake');
        void cur.offsetWidth;
        cur.classList.add('shake');
      }
      sounds.play('wrong');
      timeLeft = Math.max(0, timeLeft - MISS_PENALTY);
      updateTimeUI();
      showBanner('막혔어요! 벽/밖 (−' + MISS_PENALTY + '초)', 'ng');
      later(function () {
        clearPending();
        hideBanner();
        locked = false;
      }, getAutoplayPauseMs(550));
      return;
    }

    // 합법 이동
    pos = [nc, nr];
    renderToken();
    sounds.play('move');
    clearPending();

    if (pos[0] === current.goal[0] && pos[1] === current.goal[1]) {
      // 도착 → 라운드 클리어
      score++;
      updateScoreUI();
      var goalCell = cellAt(pos[0], pos[1]);
      if (goalCell) {
        goalCell.classList.remove('arrive');
        void goalCell.offsetWidth;
        goalCell.classList.add('arrive');
      }
      sounds.play('correct');
      showBanner('도착! 🏁 다음 미로로', 'ok');
      later(function () {
        hideBanner();
        nextRound();
        locked = false;
      }, RESULT_PAUSE_MS());
    } else {
      locked = false;
    }
  }

  // ─── 라운드 진행 ─────────────────────────────────────────────────────────
  function loadRound(idx) {
    current = ROUNDS[idx % ROUNDS.length];
    wallSet = {};
    current.walls.forEach(function (w) { wallSet[cellKey(w[0], w[1])] = 1; });
    pos = [current.start[0], current.start[1]];
    clearPending();
    renderBoard();
  }

  function nextRound() {
    roundIdx++;
    loadRound(roundIdx);
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function updateTimeUI() {
    timeNumEl.textContent = timeLeft;
    timeNumEl.classList.toggle('danger', timeLeft <= 10);
  }
  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng');
    bannerEl.textContent = '';
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    roundIdx = 0;
    score = 0;
    locked = false;
    timeLeft = GAME_SECONDS;

    // 방어적 자가검증: 풀 수 없는 미로가 섞이면 콘솔 경고
    ROUNDS.forEach(function (m, i) {
      if (!isSolvable(m)) {
        try { console.warn('[dir-combo] 미로 ' + (i + 1) + ' 해 없음'); } catch (e) {}
      }
    });

    buildControls();
    updateScoreUI();
    updateTimeUI();
    loadRound(roundIdx);
    showScreen('game');

    gameTimer = createTimer(GAME_SECONDS, function (remaining) {
      timeLeft = remaining;
      updateTimeUI();
    }, function () {
      showResult();
    });
    gameTimer.start();
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

  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    clearAllTimers();
    var title, sub, icon;
    if (score >= 6) {
      sub = '환상의 호흡! 깃발 ' + score + '개 🏁';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      sub = '훌륭한 팀워크! 다시 도전해봐요';
      icon = SVG_OK;
    } else {
      sub = '조금 더 호흡을 맞춰봐요!';
      icon = SVG_HAND;
    }
    resultTitle.textContent = '★ ' + score;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
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
