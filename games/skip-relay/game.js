/* games/skip-relay/game.js — 패턴 D (협력 조합/전달) — 뛰어 세기 짝꿍 */

(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var GAME_SECONDS = 60;
  var CHAIN_LEN = 5;               // 한 수열을 완성하는 데 필요한 링크 수
  var WRONG_LOCK_MS = function () { return getAutoplayPauseMs(520); };
  var CHAIN_DONE_MS = function () { return getAutoplayPauseMs(750); };

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
    pick: function (ctx) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    correct: function (ctx) {
      [659, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    chain: function (ctx) {
      [659, 784, 988, 1319].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.26);
      });
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.36);
    },
    win: function (ctx) {
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
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
  [document.getElementById('soundToggleIntro'), document.getElementById('soundToggleGame')]
    .forEach(function (btn) {
      if (!btn) return;
      onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
    });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var score;          // 누적 링크 수(= 협력 점수)
  var misses;         // 틀린 횟수
  var chainsDone;     // 완성한 수열 수
  var rule;           // { kind:'add'|'mul', k:number, text:string }
  var seq;            // 현재 수열(값 배열)
  var curValue;       // 마지막으로 이어진 값
  var needed;         // 다음에 눌러야 할 값(유일)
  var tilesP1;        // P1 칸 값 배열
  var tilesP2;        // P2 칸 값 배열
  var locked;         // 오답/완성 잠금
  var timeLeft;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Tiles      = document.getElementById('p1Tiles');
  var p2Tiles      = document.getElementById('p2Tiles');
  var ruleChip     = document.getElementById('ruleChip');
  var chainEl      = document.getElementById('chain');
  var bannerEl     = document.getElementById('banner');
  var timeNumEl    = document.getElementById('timeNum');
  var roundScoreEl = document.getElementById('roundScore');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 순수 헬퍼 (DOM 비의존, 테스트 가능) ──────────────────────────────────
  function randInt(n) { return Math.floor(Math.random() * n); }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // 진행도(완성 수열 수)에 따른 난이도 선택. 규칙 + 칸 개수.
  function pickRule(progress) {
    if (progress >= 4 && Math.random() < 0.35) {
      return { kind: 'mul', k: 2, text: '규칙 ×2', tiles: 6 };
    }
    if (progress >= 4) {
      var hard = [2, 3, 4][randInt(3)];
      return { kind: 'add', k: hard, text: '규칙 +' + hard, tiles: 6 };
    }
    if (progress >= 2) {
      var mid = [2, 3, 4, 5][randInt(4)];
      return { kind: 'add', k: mid, text: '규칙 +' + mid, tiles: 4 };
    }
    var easy = [1, 2, 5, 10][randInt(4)];
    return { kind: 'add', k: easy, text: '규칙 +' + easy, tiles: 4 };
  }

  function startValueFor(r) {
    if (r.kind === 'mul') return [1, 2, 3][randInt(3)];
    return 1 + randInt(5);
  }

  function applyRule(r, v) {
    return r.kind === 'mul' ? v * r.k : v + r.k;
  }

  // 오답 후보 생성: needed 와 다른 서로 다른 양수 count 개.
  function buildDistractors(count, neededVal, prev, r) {
    var step = (r.kind === 'mul') ? Math.max(1, neededVal - prev) : r.k;
    var set = {};
    var out = [];
    function tryAdd(v) {
      if (out.length >= count) return;
      if (v > 0 && v !== neededVal && !set[v]) { set[v] = 1; out.push(v); }
    }
    var cands = [
      neededVal - 1, neededVal + 1,
      neededVal - step, neededVal + step,
      prev, prev + step, neededVal + 2 * step,
      (r.kind === 'mul' ? prev + r.k : neededVal - 2 * step)
    ];
    shuffle(cands).forEach(tryAdd);
    var guard = 0;
    while (out.length < count && guard++ < 600) {
      tryAdd(Math.max(1, neededVal + (randInt(13) - 6)));
    }
    while (out.length < count && guard++ < 1200) {
      tryAdd(1 + randInt(neededVal * 2 + 20));
    }
    return out;
  }

  // 다음 링크 준비: needed 계산 + 양쪽 칸 채우기(needed 는 한 칸에만).
  function setupNextLink() {
    needed = applyRule(rule, curValue);
    var TILES = rule.tiles;
    var owner = randInt(2);                 // 0 → P1, 1 → P2
    var ownerSlot = randInt(TILES);

    var distractors = buildDistractors(2 * TILES - 1, needed, curValue, rule);
    var di = 0;
    var a = [], b = [];
    for (var s = 0; s < TILES; s++) {
      if (owner === 0 && s === ownerSlot) a.push(needed);
      else a.push(distractors[di++]);
    }
    for (var s2 = 0; s2 < TILES; s2++) {
      if (owner === 1 && s2 === ownerSlot) b.push(needed);
      else b.push(distractors[di++]);
    }
    tilesP1 = a; tilesP2 = b;
    renderTiles();
    renderChain();
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────────
  function renderChain() {
    // 마지막 4개 항 + ? 표시
    var tail = seq.slice(Math.max(0, seq.length - 4));
    var html = '';
    for (var i = 0; i < tail.length; i++) {
      if (i > 0) html += '<span class="chain-arrow">→</span>';
      html += '<span class="chain-term">' + tail[i] + '</span>';
    }
    html += '<span class="chain-arrow">→</span><span class="chain-term q">?</span>';
    chainEl.innerHTML = html;
  }

  function renderTiles() {
    fillGrid(p1Tiles, tilesP1, 1);
    fillGrid(p2Tiles, tilesP2, 2);
  }

  function fillGrid(grid, vals, player) {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(' + Math.min(3, Math.ceil(vals.length / 2)) + ', 1fr)';
    vals.forEach(function (v) {
      var btn = document.createElement('button');
      btn.className = 'tile';
      btn.type = 'button';
      btn.textContent = v;
      onTap(btn, function () {
        if (locked) return;
        handleTap(player, v, btn);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 탭 처리 ─────────────────────────────────────────────────────────────
  function handleTap(player, value, btn) {
    if (value === needed) {
      // 정답 → 링크 연결
      sounds.play('correct');
      btn.classList.add('hit');
      seq.push(needed);
      curValue = needed;
      score++;
      updateScoreUI();

      if (seq.length - 1 >= CHAIN_LEN) {
        // 수열 완성!
        locked = true;
        chainsDone++;
        renderChain();
        sounds.play('chain');
        showBanner('수열 완성! 🎉 새 규칙', 'ok');
        later(function () {
          hideBanner();
          startNewChain();
          locked = false;
        }, CHAIN_DONE_MS());
      } else {
        setupNextLink();
      }
    } else {
      // 오답 → 잠깐 멈춤
      misses++;
      locked = true;
      sounds.play('wrong');
      btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
      showBanner('그 수가 아니에요!', 'ng');
      later(function () {
        hideBanner();
        btn.classList.remove('shake');
        locked = false;
      }, WRONG_LOCK_MS());
    }
  }

  // ─── 수열 시작/진행 ──────────────────────────────────────────────────────
  function startNewChain() {
    rule = pickRule(chainsDone);
    var start = startValueFor(rule);
    seq = [start];
    curValue = start;
    ruleChip.textContent = rule.text;
    setupNextLink();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  function updateScoreUI() { roundScoreEl.textContent = '★ ' + score; }
  function updateTimeUI() {
    timeNumEl.textContent = timeLeft;
    timeNumEl.classList.toggle('danger', timeLeft <= 10);
  }
  function showBanner(text, cls) { bannerEl.textContent = text; bannerEl.className = 'banner show ' + cls; }
  function hideBanner() { bannerEl.classList.remove('show', 'ok', 'ng'); bannerEl.textContent = ''; }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    score = 0; misses = 0; chainsDone = 0; locked = false;
    timeLeft = GAME_SECONDS;

    updateScoreUI();
    updateTimeUI();
    startNewChain();
    showScreen('game');

    gameTimer = createTimer(GAME_SECONDS, function (remaining) {
      timeLeft = remaining;
      updateTimeUI();
    }, function () {
      showResult();
    });
    gameTimer.start();
  }

  // ─── 결과 ────────────────────────────────────────────────────────────────
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
  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  function showResult() {
    clearAllTimers();
    var sub, icon;
    if (score >= 30) { sub = '환상의 호흡! 이어 센 수 ' + score + '개 🔢'; icon = SVG_TROPHY; }
    else if (score >= 15) { sub = '훌륭한 팀워크! 다시 도전해봐요'; icon = SVG_OK; }
    else { sub = '조금 더 호흡을 맞춰봐요!'; icon = SVG_HAND; }
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
  onTap(document.getElementById('homeBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('backBtn'), function () { clearAllTimers(); goHome(); });
  onTap(document.getElementById('closeBtn'), function () { clearAllTimers(); goHome(); });

})();
