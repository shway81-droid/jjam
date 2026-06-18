/* games/attr-combo/game.js */

(function () {
  'use strict';

  // ─── 색 / 모양 데이터 ──────────────────────────────────────────────────────
  var COLORS = [
    { id: 'red',    hex: '#E53935', name: '빨강' },
    { id: 'blue',   hex: '#1E88E5', name: '파랑' },
    { id: 'yellow', hex: '#FDD835', name: '노랑' },
    { id: 'green',  hex: '#43A047', name: '초록' }
  ];
  var SHAPES = [
    { id: 'circle',   glyph: '●', name: '원' },
    { id: 'square',   glyph: '■', name: '네모' },
    { id: 'triangle', glyph: '▲', name: '세모' },
    { id: 'star',     glyph: '★', name: '별' }
  ];

  var QUEUE_LEN = 3;          // 보이는 주문 카드 수
  var ROUND_SECONDS = 50;     // 라운드 총 시간
  var PENALTY_MS = 600;       // 오답 시 해당 존 잠금 시간

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
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
  var queue;          // 주문 카드 배열 (각: {color, shape})
  var score;          // 함께 완성한 주문 수 (공유 점수)
  var p1Armed;        // P1이 정답 색을 골라 대기 중인 colorId 또는 null
  var p2Armed;        // P2가 정답 모양을 골라 대기 중인 shapeId 또는 null
  var p1Locked;       // P1 존 페널티 잠금
  var p2Locked;       // P2 존 페널티 잠금
  var roundTimer = null;
  var gameOver;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Tiles');
  var p2Grid       = document.getElementById('p2Tiles');
  var queueEl      = document.getElementById('orderQueue');
  var timeNumEl    = document.getElementById('timeNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var p1BoardEl    = document.querySelector('.board.p1');
  var p2BoardEl    = document.querySelector('.board.p2');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 유틸 ────────────────────────────────────────────────────────────────
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function newOrder() {
    return { color: pick(COLORS).id, shape: pick(SHAPES).id };
  }

  // ─── 타일(버튼) 생성 ─────────────────────────────────────────────────────
  function buildColorTiles() {
    p1Grid.innerHTML = '';
    COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.className = 'tile color-tile';
      btn.type = 'button';
      btn.style.backgroundColor = c.hex;
      btn.setAttribute('data-id', c.id);
      btn.setAttribute('aria-label', c.name);
      onTap(btn, function () { handleColorPick(c.id, btn); });
      p1Grid.appendChild(btn);
    });
  }
  function buildShapeTiles() {
    p2Grid.innerHTML = '';
    SHAPES.forEach(function (s) {
      var btn = document.createElement('button');
      btn.className = 'tile shape-tile';
      btn.type = 'button';
      btn.textContent = s.glyph;
      btn.setAttribute('data-id', s.id);
      btn.setAttribute('aria-label', s.name);
      onTap(btn, function () { handleShapePick(s.id, btn); });
      p2Grid.appendChild(btn);
    });
  }

  // ─── 활성 주문 = 큐의 맨 앞 카드 ───────────────────────────────────────────
  function activeOrder() {
    return queue[0];
  }

  // ─── P1: 색 선택 처리 ──────────────────────────────────────────────────────
  function handleColorPick(colorId, btn) {
    if (gameOver || p1Locked) return;
    var order = activeOrder();
    if (!order) return;

    if (colorId === order.color) {
      // 정답 반쪽 → armed (짝꿍 대기)
      sounds.play('pick');
      p1Armed = colorId;
      refreshArmedHighlights();
      tryComplete();
    } else {
      // 오답 → 버즈 + 페널티 (해당 존 잠금, 부분 선택 해제)
      penalize(1, btn);
    }
  }

  // ─── P2: 모양 선택 처리 ────────────────────────────────────────────────────
  function handleShapePick(shapeId, btn) {
    if (gameOver || p2Locked) return;
    var order = activeOrder();
    if (!order) return;

    if (shapeId === order.shape) {
      sounds.play('pick');
      p2Armed = shapeId;
      refreshArmedHighlights();
      tryComplete();
    } else {
      penalize(2, btn);
    }
  }

  // ─── 오답 페널티 ───────────────────────────────────────────────────────────
  function penalize(player, btn) {
    sounds.play('wrong');
    btn.classList.add('wrong');
    later(function () { btn.classList.remove('wrong'); }, 360);

    if (player === 1) {
      p1Locked = true;
      p1Armed = null;                  // 해당 플레이어의 부분 선택 해제
      p1BoardEl.classList.add('penalty');
      later(function () {
        p1Locked = false;
        p1BoardEl.classList.remove('penalty');
      }, PENALTY_MS);
    } else {
      p2Locked = true;
      p2Armed = null;
      p2BoardEl.classList.add('penalty');
      later(function () {
        p2Locked = false;
        p2BoardEl.classList.remove('penalty');
      }, PENALTY_MS);
    }
    refreshArmedHighlights();
  }

  // ─── 양쪽 반쪽이 모두 정답이면 주문 완성 ────────────────────────────────────
  function tryComplete() {
    if (p1Armed === null || p2Armed === null) return;

    score++;
    sounds.play('correct');
    showBanner('완성! 🎉', 'ok');
    updateScoreUI();

    // 완성 애니메이션 (맨 앞 카드)
    var firstCard = queueEl.querySelector('.order-card');
    if (firstCard) firstCard.classList.add('completed');

    // 큐 전진: 맨 앞 제거 + 새 주문 추가
    queue.shift();
    queue.push(newOrder());

    // armed 초기화
    p1Armed = null;
    p2Armed = null;

    later(function () {
      hideBanner();
      renderQueue();
    }, 260);
  }

  // ─── armed 타일 / 카드 태그 하이라이트 갱신 ─────────────────────────────────
  function refreshArmedHighlights() {
    p1Grid.querySelectorAll('.tile').forEach(function (t) {
      t.classList.toggle('armed', p1Armed !== null && t.getAttribute('data-id') === p1Armed);
    });
    p2Grid.querySelectorAll('.tile').forEach(function (t) {
      t.classList.toggle('armed', p2Armed !== null && t.getAttribute('data-id') === p2Armed);
    });
    updateActiveCardTags();
  }

  // ─── 주문 큐 렌더 ──────────────────────────────────────────────────────────
  function renderQueue() {
    queueEl.innerHTML = '';
    queue.forEach(function (order, i) {
      var color = COLORS.filter(function (c) { return c.id === order.color; })[0];
      var shape = SHAPES.filter(function (s) { return s.id === order.shape; })[0];

      var card = document.createElement('div');
      card.className = 'order-card ' + (i === 0 ? 'active' : 'queued');
      card.style.backgroundColor = color.hex;

      var glyph = document.createElement('div');
      glyph.className = 'order-shape';
      glyph.textContent = shape.glyph;
      glyph.style.color = (color.id === 'yellow') ? '#2C2C2C' : '#FFFFFF';
      card.appendChild(glyph);

      if (i === 0) {
        var tags = document.createElement('div');
        tags.className = 'order-half-tags';
        var t1 = document.createElement('span');
        t1.className = 'half-tag';
        t1.setAttribute('data-half', 'p1');
        t1.textContent = 'P1';
        var t2 = document.createElement('span');
        t2.className = 'half-tag';
        t2.setAttribute('data-half', 'p2');
        t2.textContent = 'P2';
        tags.appendChild(t1);
        tags.appendChild(t2);
        card.appendChild(tags);
      }
      queueEl.appendChild(card);
    });
    updateActiveCardTags();
  }

  function updateActiveCardTags() {
    var t1 = queueEl.querySelector('.half-tag[data-half="p1"]');
    var t2 = queueEl.querySelector('.half-tag[data-half="p2"]');
    if (t1) t1.classList.toggle('armed', p1Armed !== null);
    if (t2) t2.classList.toggle('armed', p2Armed !== null);
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateScoreUI() {
    roundScoreEl.textContent = '🎁 ' + score;
  }
  function updateTimeUI(remaining) {
    timeNumEl.textContent = remaining;
    timeNumEl.classList.toggle('low', remaining <= 10);
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
    score = 0;
    p1Armed = null;
    p2Armed = null;
    p1Locked = false;
    p2Locked = false;
    gameOver = false;

    queue = [];
    for (var i = 0; i < QUEUE_LEN; i++) queue.push(newOrder());

    buildColorTiles();
    buildShapeTiles();
    renderQueue();
    updateScoreUI();
    hideBanner();

    updateTimeUI(ROUND_SECONDS);
    roundTimer = createTimer(ROUND_SECONDS, updateTimeUI, endGame);
    roundTimer.start();

    showScreen('game');
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    showResult();
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
    if (score >= 12) {
      sub = '완벽한 팀워크! 👏';
      icon = SVG_TROPHY;
    } else if (score >= 6) {
      sub = '훌륭한 협력이에요!';
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
