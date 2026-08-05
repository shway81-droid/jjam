/* games/fill-exact/game.js */

(function () {
  'use strict';

  // ─── 값 세트 (비대칭) ──────────────────────────────────────────────────────
  // P1 = 짝수 {2,4}, P2 = 3의 배수 {3,6}.
  // 두 세트를 합치면 5~20의 모든 목표를 정확히 만들 수 있고,
  // 5,7,11,13,17,19 같은 목표는 한 세트만으로는 절대 만들 수 없어 협력이 필요하다.
  var P1_VALUES = [2, 4];
  var P2_VALUES = [3, 6];

  // ─── 목표 풀 ───────────────────────────────────────────────────────────────
  // 전부 두 세트 합으로 정확히 도달 가능. 절반은 협력(두 세트 모두) 필수.
  var TARGET_POOL = [5, 7, 8, 10, 11, 13, 14, 16, 17, 19];

  // ─── 라운드 시간 ───────────────────────────────────────────────────────────
  var ROUND_SECONDS = 50;

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
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
  var score;          // 완성한 통 개수 (공유 점수)
  var total;          // 현재 통의 누적 합
  var target;         // 현재 목표
  var timeLeft;       // 남은 초
  var lastTargetIdx;  // 직전 목표 인덱스(연속 중복 방지)
  var busy;           // 완성/넘침 애니메이션 중 입력 잠금(짧게)

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var bucketEl     = document.getElementById('bucket');
  var bucketFill   = document.getElementById('bucketFill');
  var bucketCur    = document.getElementById('bucketCur');
  var targetVal    = document.getElementById('targetVal');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 값 버튼 생성 (양쪽 항상 활성) ─────────────────────────────────────────
  function buildButtons(grid, vals) {
    grid.innerHTML = '';
    vals.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = n;
      btn.setAttribute('data-val', n);
      onTap(btn, function () {
        if (busy) return;
        addValue(n, btn);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 값 더하기 (핵심 메커니즘) ─────────────────────────────────────────────
  function addValue(n, btn) {
    var next = total + n;

    if (next === target) {
      // 딱 맞음 → 통 완성
      total = next;
      renderBucket();
      sounds.play('correct');
      score++;
      updateScoreUI();
      busy = true;
      bucketEl.classList.add('pop');
      if (btn) { btn.classList.add('correct'); }
      showBanner('딱 맞았어요! 통 완성 🪣', 'ok');
      later(function () {
        bucketEl.classList.remove('pop');
        if (btn) btn.classList.remove('correct');
        startNewBucket();
        busy = false;
      }, getAutoplayPauseMs(650));
    } else if (next > target) {
      // 넘침 → 쏟아짐, 진행 초기화 (점수는 유지)
      sounds.play('wrong');
      busy = true;
      bucketEl.classList.add('spill');
      if (btn) { btn.classList.add('wrong'); }
      showBanner('넘쳤어요! 통이 쏟아졌어요 (다시 0부터)', 'ng');
      later(function () {
        bucketEl.classList.remove('spill');
        if (btn) btn.classList.remove('wrong');
        total = 0;
        renderBucket();
        hideBanner();
        busy = false;
      }, 550);
    } else {
      // 정상 채우기
      total = next;
      renderBucket();
      sounds.play('pick');
    }
  }

  // ─── 통 렌더 ───────────────────────────────────────────────────────────────
  function renderBucket() {
    bucketCur.textContent = total;
    var pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
    bucketFill.style.height = pct + '%';
  }

  // ─── 새 통 / 새 목표 ───────────────────────────────────────────────────────
  function pickTarget() {
    var idx;
    do {
      idx = Math.floor(Math.random() * TARGET_POOL.length);
    } while (TARGET_POOL.length > 1 && idx === lastTargetIdx);
    lastTargetIdx = idx;
    return TARGET_POOL[idx];
  }

  function startNewBucket() {
    total = 0;
    target = pickTarget();
    targetVal.textContent = target;
    renderBucket();
    hideBanner();
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  function updateTimeUI() {
    roundNumEl.textContent = timeLeft;
    roundNumEl.classList.toggle('urgent', timeLeft <= 10);
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng');
    bannerEl.textContent = '';
  }

  // ─── 타이머 ─────────────────────────────────────────────────────────────────
  var tickInterval = null;
  function startTimer() {
    timeLeft = ROUND_SECONDS;
    updateTimeUI();
    tickInterval = setInterval(function () {
      timeLeft--;
      updateTimeUI();
      if (timeLeft <= 0) {
        clearInterval(tickInterval);
        tickInterval = null;
        endGame();
      }
    }, 1000);
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    score = 0;
    total = 0;
    busy = false;
    lastTargetIdx = -1;
    boardsEl.classList.remove('locked');
    buildButtons(p1Grid, P1_VALUES);
    buildButtons(p2Grid, P2_VALUES);
    updateScoreUI();
    startNewBucket();
    showScreen('game');
    startTimer();
  }

  // ─── 게임 종료 ─────────────────────────────────────────────────────────────
  function endGame() {
    busy = true;
    boardsEl.classList.add('locked');
    later(showResult, 400);
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
    var sub, icon;
    if (score >= 10) {
      sub = '완벽한 호흡! 환상의 팀워크 👏';
      icon = SVG_TROPHY;
    } else if (score >= 5) {
      sub = '훌륭한 협력이에요! 더 도전해봐요';
      icon = SVG_OK;
    } else {
      sub = '조금 더 호흡을 맞춰봐요!';
      icon = SVG_HAND;
    }
    resultTitle.textContent = '함께 ' + score + '개 완성!';
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
