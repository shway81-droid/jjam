/* games/flip-over/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var SIZE = 6;
  var EMPTY = -1;
  var PLAYER_NAMES  = ['P1', 'P2'];
  var PLAYER_COLORS = ['#37474F', '#90A4AE']; // P1 dark slate, P2 light (for dot/banner)
  var DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
  ];
  // ─── 순수 로직 (테스트 가능) ────────────────────────────────────────────
  // board[r][c] = EMPTY | 0 | 1

  function makeStartBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(EMPTY);
      b.push(row);
    }
    // 중앙 4칸: (2,2)&(3,3)=P1(검정), (2,3)&(3,2)=P2(흰색)
    b[2][2] = 0; b[3][3] = 0;
    b[2][3] = 1; b[3][2] = 1;
    return b;
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  // (r,c)에 player가 놓을 때 뒤집히는 모든 좌표 배열을 반환 (없으면 빈 배열)
  function flipsForMove(board, r, c, player) {
    if (!inBounds(r, c) || board[r][c] !== EMPTY) return [];
    var opp = 1 - player;
    var flips = [];
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      var line = [];
      var nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc) && board[nr][nc] === opp) {
        line.push([nr, nc]);
        nr += dr; nc += dc;
      }
      // 상대 돌이 1개 이상 이어진 뒤 내 돌로 끝나야 유효
      if (line.length > 0 && inBounds(nr, nc) && board[nr][nc] === player) {
        for (var i = 0; i < line.length; i++) flips.push(line[i]);
      }
    }
    return flips;
  }

  function isLegalMove(board, r, c, player) {
    return flipsForMove(board, r, c, player).length > 0;
  }

  // player가 둘 수 있는 모든 합법 좌표 [[r,c],...]
  function legalMovesFor(board, player) {
    var moves = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY && isLegalMove(board, r, c, player)) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  function countDiscs(board) {
    var cnt = [0, 0];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) cnt[0]++;
        else if (board[r][c] === 1) cnt[1]++;
      }
    }
    return cnt;
  }

  // 테스트 환경(node)에서 순수 함수 노출
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      makeStartBoard: makeStartBoard,
      flipsForMove: flipsForMove,
      isLegalMove: isLegalMove,
      legalMovesFor: legalMovesFor,
      countDiscs: countDiscs,
      SIZE: SIZE,
      EMPTY: EMPTY
    };
    return;
  }

  // ─── 엔진 의존 상수 (브라우저 전용) ───────────────────────────────────────
  var RESULT_PAUSE_MS = getAutoplayPauseMs(900);
  var PASS_PAUSE_MS   = getAutoplayPauseMs(1100);

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
    // 돌 놓는 소리
    place: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.26, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    },

    // 뒤집기 소리 (가벼운 휘릭)
    flip: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
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

    // 둘 곳 없음 / 패스 (짧은 부저)
    buzz: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
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
  var board;          // board[r][c] = EMPTY | 0 | 1
  var currentPlayer;  // 0 or 1
  var gameOver;
  var locked;         // 애니메이션 중 입력 잠금
  var cellEls;        // cellEls[r][c] = DOM element

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var boardGrid   = document.getElementById('boardGrid');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var scoreP1El   = document.getElementById('scoreP1');
  var scoreP2El   = document.getElementById('scoreP2');
  var scoreChipP1 = document.getElementById('scoreChipP1');
  var scoreChipP2 = document.getElementById('scoreChipP2');
  var statusMsg   = document.getElementById('statusMsg');
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    board = makeStartBoard();
    currentPlayer = 0;
    gameOver = false;
    locked = false;

    buildBoard();
    renderDiscs();
    updateScores();
    updateTurnUI(false);
    refreshLegal();
    hideStatus();

    showScreen('game');
  }

  // ─── 보드 빌드 (6x6 빈 셀) ────────────────────────────────────────────────
  function buildBoard() {
    boardGrid.innerHTML = '';
    cellEls = [];
    for (var r = 0; r < SIZE; r++) {
      cellEls.push([]);
      for (var c = 0; c < SIZE; c++) {
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

  // 보드 상태를 DOM에 반영 (디스크 생성/제거)
  function renderDiscs() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = cellEls[r][c];
        var v = board[r][c];
        cell.classList.remove('p1', 'p2');
        var disc = cell.querySelector('.disc');
        if (v === EMPTY) {
          if (disc) cell.removeChild(disc);
        } else {
          if (!disc) {
            disc = document.createElement('div');
            disc.className = 'disc';
            cell.appendChild(disc);
          }
          cell.classList.add(v === 0 ? 'p1' : 'p2');
        }
      }
    }
  }

  function setDisc(r, c, player, animClass) {
    var cell = cellEls[r][c];
    cell.classList.remove('p1', 'p2');
    cell.classList.add(player === 0 ? 'p1' : 'p2');
    var disc = cell.querySelector('.disc');
    if (!disc) {
      disc = document.createElement('div');
      disc.className = 'disc';
      cell.appendChild(disc);
    }
    if (animClass) {
      disc.classList.remove('placed', 'flipped');
      void disc.offsetWidth;
      disc.classList.add(animClass);
    }
  }

  // ─── 합법 수 하이라이트 ───────────────────────────────────────────────────
  function refreshLegal() {
    // 기존 하이라이트 제거
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        cellEls[r][c].classList.remove('legal');
      }
    }
    if (gameOver) return;
    var moves = legalMovesFor(board, currentPlayer);
    moves.forEach(function (m) {
      cellEls[m[0]][m[1]].classList.add('legal');
    });
  }

  // ─── 점수 업데이트 ────────────────────────────────────────────────────────
  function updateScores() {
    var cnt = countDiscs(board);
    scoreP1El.textContent = cnt[0];
    scoreP2El.textContent = cnt[1];
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

    scoreChipP1.classList.toggle('active', currentPlayer === 0);
    scoreChipP2.classList.toggle('active', currentPlayer === 1);

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
    overlay.querySelector('.turn-overlay-text').textContent = '⚫ ' + name + ' 차례 ⚫';
    void overlay.offsetWidth;
    later(function () {
      overlay.classList.remove('show');
    }, 600);
  }

  // ─── 상태 메시지 ──────────────────────────────────────────────────────────
  function showStatus(text) {
    statusMsg.textContent = text;
    statusMsg.classList.add('show');
  }
  function hideStatus() {
    statusMsg.classList.remove('show');
  }

  // ─── 탭 처리 ──────────────────────────────────────────────────────────────
  function handleTap(r, c) {
    if (gameOver || locked) return;
    var flips = flipsForMove(board, r, c, currentPlayer);
    if (flips.length === 0) {
      // 합법이 아닌 칸 → 부저, 변화 없음
      sounds.play('buzz');
      return;
    }

    locked = true;
    hideStatus();
    boardGrid.classList.add('locked');

    var p = currentPlayer;
    board[r][c] = p;
    setDisc(r, c, p, 'placed');
    sounds.play('place');

    // 살짝 뒤에 뒤집기
    later(function () {
      flips.forEach(function (rc) {
        board[rc[0]][rc[1]] = p;
        setDisc(rc[0], rc[1], p, 'flipped');
      });
      sounds.play('flip');
      updateScores();

      later(function () {
        // 합법 수 끄고 다음 턴 진행
        refreshLegalOff();
        advanceTurn();
      }, 260);
    }, 180);
  }

  function refreshLegalOff() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        cellEls[r][c].classList.remove('legal');
      }
    }
  }

  // ─── 턴 진행 (패스 / 종료 처리) ──────────────────────────────────────────
  function advanceTurn() {
    var next = 1 - currentPlayer;
    var nextMoves = legalMovesFor(board, next);

    if (nextMoves.length > 0) {
      // 정상 전환
      currentPlayer = next;
      locked = false;
      boardGrid.classList.remove('locked');
      updateTurnUI(true);
      refreshLegal();
      return;
    }

    // 다음 플레이어가 둘 곳 없음 → 현재 플레이어가 다시 둘 수 있나?
    var sameMoves = legalMovesFor(board, currentPlayer);
    if (sameMoves.length > 0) {
      // 다음 플레이어 패스, 현재 플레이어 유지
      showStatus(PLAYER_NAMES[next] + ' 둘 곳 없음 → 차례 넘김');
      sounds.play('buzz');
      later(function () {
        hideStatus();
        locked = false;
        boardGrid.classList.remove('locked');
        // currentPlayer 그대로
        updateTurnUI(false);
        refreshLegal();
      }, PASS_PAUSE_MS);
      return;
    }

    // 양쪽 모두 둘 곳 없음 → 게임 종료
    gameOver = true;
    boardGrid.classList.remove('locked');
    refreshLegalOff();
    later(function () {
      endGame();
    }, RESULT_PAUSE_MS);
  }

  // ─── 게임 종료 / 결과 ─────────────────────────────────────────────────────
  function endGame() {
    var cnt = countDiscs(board);
    var winner;
    if (cnt[0] > cnt[1]) winner = 0;
    else if (cnt[1] > cnt[0]) winner = 1;
    else winner = -1;

    if (winner < 0) sounds.play('lose');
    else sounds.play('win');

    showResult(winner, cnt);
  }

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

  function showResult(winner, cnt) {
    if (winner < 0) {
      resultIconWrap.innerHTML = SVG_DRAW;
      resultTitle.textContent = '무승부!';
      resultTitle.style.color = '#FB8C00';
      resultSub.textContent = '돌 ' + cnt[0] + ' : ' + cnt[1] + ' — 똑같이 차지했어요!';
    } else {
      resultIconWrap.innerHTML = SVG_TROPHY;
      resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
      resultTitle.style.color = PLAYER_COLORS[winner];
      resultSub.textContent = '돌 ' + cnt[winner] + ' : ' + cnt[1 - winner] + ' 로 더 많이 차지했어요!';
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
