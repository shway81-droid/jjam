/* games/order-relay/game.js */

(function () {
  'use strict';

  // ─── 라운드 설정 ───────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 5;
  var ROUND_MAX = [6, 8, 9, 10, 12];      // 각 라운드 숫자 개수 N (1..N)
  var ROUND_TIME = [20, 18, 16, 15, 13];  // 각 라운드 제한 시간(초)

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  var roundTimerId = null;   // 라운드 카운트다운 setInterval

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearRoundTimer() {
    if (roundTimerId) { clearInterval(roundTimerId); roundTimerId = null; }
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    clearRoundTimer();
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
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
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
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
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
  var currentRound;   // 0-based
  var score;          // 완료한 라운드 수
  var roundN;         // 이번 라운드 최대 숫자 N
  var nextNum;        // 다음에 눌러야 할 숫자
  var locked;         // 틀린 직후 잠금
  var timeLeft;       // 남은 시간(초)
  var roundResolved;  // 이번 라운드가 끝났는지(성공/실패 중복 방지)

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var nextVal      = document.getElementById('nextVal');
  var progressVal  = document.getElementById('progressVal');
  var timerVal     = document.getElementById('timerVal');
  var timerBar     = document.getElementById('timerBar');
  var timerBox     = document.querySelector('.target-timer');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 1..N을 두 트레이로 분할 ───────────────────────────────────────────────
  function splitNumbers(n) {
    var all = [];
    for (var i = 1; i <= n; i++) all.push(i);
    all = shuffleArr(all);
    var half = Math.ceil(n / 2);
    return {
      p1: shuffleArr(all.slice(0, half)),
      p2: shuffleArr(all.slice(half))
    };
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, nums) {
    grid.innerHTML = '';
    nums.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = n;
      btn.setAttribute('data-val', n);
      onTap(btn, function () {
        if (locked || roundResolved) return;
        handleCardPick(n, btn);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(val, btn) {
    if (btn.classList.contains('done')) return;

    if (val === nextNum) {
      // 정답: 이 카드만 완료 처리
      btn.classList.add('done');
      btn.disabled = true;
      sounds.play('pick');
      nextNum++;
      updateTargetUI();

      if (nextNum > roundN) {
        roundSuccess();
      }
    } else {
      // 오답: 흔들기 + 잠시 잠금
      sounds.play('wrong');
      btn.classList.remove('shake');
      // reflow로 애니메이션 재시작 보장
      void btn.offsetWidth;
      btn.classList.add('shake');
      locked = true;
      boardsEl.classList.add('locked');
      later(function () {
        locked = false;
        boardsEl.classList.remove('locked');
        btn.classList.remove('shake');
      }, 600);
    }
  }

  // ─── 라운드 성공 ─────────────────────────────────────────────────────────
  function roundSuccess() {
    if (roundResolved) return;
    roundResolved = true;
    clearRoundTimer();
    score++;
    updateScoreUI();
    sounds.play('correct');
    showBanner('성공! 모두 순서대로 이었어요 🎉', 'ok');
    later(advanceRound, 1200);
  }

  // ─── 라운드 실패(시간 초과) ─────────────────────────────────────────────
  function roundTimeout() {
    if (roundResolved) return;
    roundResolved = true;
    clearRoundTimer();
    sounds.play('wrong');
    showBanner('시간 초과! 다음 라운드로', 'ng');
    later(advanceRound, 1200);
  }

  // ─── 다음 라운드로 진행 ─────────────────────────────────────────────────
  function advanceRound() {
    currentRound++;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      startRound();
    }
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function startRound() {
    clearRoundTimer();
    locked = false;
    roundResolved = false;
    boardsEl.classList.remove('locked');
    hideBanner();

    roundN = ROUND_MAX[currentRound];
    nextNum = 1;

    var split = splitNumbers(roundN);
    buildCards(p1Grid, split.p1);
    buildCards(p2Grid, split.p2);

    timeLeft = ROUND_TIME[currentRound];
    updateRoundUI();
    updateTargetUI();
    updateTimerUI();

    roundTimerId = setInterval(function () {
      timeLeft--;
      updateTimerUI();
      if (timeLeft <= 0) {
        clearRoundTimer();
        roundTimeout();
      }
    }, 1000);
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function updateTargetUI() {
    var shown = Math.min(nextNum, roundN);
    nextVal.textContent = shown;
    progressVal.textContent = (nextNum - 1) + ' / ' + roundN;
  }
  function updateTimerUI() {
    var t = Math.max(0, timeLeft);
    timerVal.textContent = t;
    var total = ROUND_TIME[currentRound];
    var pct = Math.max(0, (t / total) * 100);
    timerBar.style.width = pct + '%';
    var low = t <= 5;
    timerBar.classList.toggle('low', low);
    if (timerBox) timerBox.classList.toggle('low', low);
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
    currentRound = 0;
    score = 0;
    locked = false;
    roundResolved = false;
    updateScoreUI();
    startRound();
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
    clearRoundTimer();
    var title, sub, icon;
    title = score + '/' + TOTAL_ROUNDS;
    if (score === TOTAL_ROUNDS) {
      sub = '완벽한 협력이에요! 👏';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      sub = '훌륭한 팀워크! 다시 도전해봐요';
      icon = SVG_OK;
    } else {
      sub = '조금 더 호흡을 맞춰봐요!';
      icon = SVG_HAND;
    }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

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
