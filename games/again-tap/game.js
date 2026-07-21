/* games/again-tap/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#6A1B9A'];

  // 카드에 나오는 그림 (명확한 6종)
  var ITEMS = ['🍎', '🐶', '⭐', '🚗', '🌸', '🎈'];

  // 반복(1-back) 확률
  var REPEAT_PROB = 0.28;

  // 틱 간격 (난이도: 시간이 흐를수록 약간 빨라짐)
  var TICK_START = 1400; // ms (시작)
  var TICK_END   = 1000; // ms (종료 직전)

  // ===== 화면 =====
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

  // ===== 사운드 =====
  var sounds = createSoundManager({
    // 정답 (반복 맞춤)
    correct: function (ctx) {
      var notes = [660, 990];
      notes.forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.18);
      });
    },
    // 오답 (반복 아닌데 터치)
    wrong: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    },
    // 승리 팡파레
    fanfare: function (ctx) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.13);
        osc.stop(ctx.currentTime + i * 0.13 + 0.35);
      });
    }
  });

  // 사운드 버튼
  var soundBtnIntro = document.getElementById('soundToggleIntro');
  function updateSoundBtn() {
    soundBtnIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }
  soundBtnIntro.addEventListener('click', function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  // ===== 인원 선택 =====
  var selectedCount = 2;
  var playerBtns = document.querySelectorAll('.player-btn');
  playerBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCount = parseInt(btn.dataset.count, 10);
      playerBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // ===== 카운트다운 =====
  var countdownEl     = document.getElementById('countdownNumber');
  var countdownTimers = [];

  function clearCountdownTimers() {
    countdownTimers.forEach(clearTimeout);
    countdownTimers = [];
  }

  function startCountdown(onDone) {
    showScreen('countdown');
    var count = 3;
    countdownEl.textContent = count;
    countdownEl.style.animation = 'none';
    void countdownEl.offsetHeight;
    countdownEl.style.animation = '';

    function tick() {
      count--;
      if (count <= 0) {
        onDone();
        return;
      }
      countdownEl.textContent = count;
      countdownEl.style.animation = 'none';
      void countdownEl.offsetHeight;
      countdownEl.style.animation = '';
      countdownTimers.push(setTimeout(tick, 1000));
    }

    countdownTimers.push(setTimeout(tick, 1000));
  }

  // ===== 게임 상태 =====
  var gameRunning    = false;
  var playerCount    = 2;
  var playerScores   = [];
  var zones          = [];   // per-player zone state
  var allTimers      = [];
  var gameTimer      = null;
  var timerRemaining = GAME_DURATION;

  var timerFill   = document.getElementById('timerFill');
  var timerText   = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  // ===== 스트림 생성기 =====
  // 이전 아이템 기준으로 다음 아이템을 만든다.
  //  - REPEAT_PROB 확률로 이전과 동일 (반복 = 정답 대상)
  //  - 그 외에는 이전과 "다른" 아이템 (반복이 아님이 보장됨)
  // prevItem 이 null 이면(첫 카드) 반복일 수 없으므로 임의의 새 아이템.
  function nextItem(prevItem) {
    if (prevItem === null || prevItem === undefined) {
      return {
        item: ITEMS[Math.floor(Math.random() * ITEMS.length)],
        isRepeat: false
      };
    }
    if (Math.random() < REPEAT_PROB) {
      return { item: prevItem, isRepeat: true };
    }
    // 이전과 다른 아이템을 고른다 (절대 prev 와 같지 않음)
    var choice;
    do {
      choice = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    } while (choice === prevItem);
    return { item: choice, isRepeat: false };
  }

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    zones        = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      // Label
      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      zone.appendChild(label);

      // Score display
      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      zone.appendChild(scoreEl);

      // Card
      var card = document.createElement('div');
      card.className = 'card';
      var emoji = document.createElement('span');
      emoji.className = 'card-emoji';
      card.appendChild(emoji);
      zone.appendChild(card);

      zonesEl.appendChild(zone);
      playerScores.push(0);

      // 존 상태
      var state = {
        idx: p,
        card: card,
        emoji: emoji,
        prevItem: null,
        currentItem: null,
        currentIsRepeat: false,
        handled: false,   // 이번 카드가 이미 처리(정답/오답)되었는지
        locked: false     // 오답 후 짧은 잠금
      };
      zones.push(state);

      // 카드 터치
      (function (st) {
        onTap(st.card, function () { handleTap(st); });
      })(state);

      // HUD chip
      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);
    }
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] += amount;
    if (playerScores[playerIdx] < 0) playerScores[playerIdx] = 0;
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 카드 갱신 (매 틱) =====
  function flashClass(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth; // reflow → 애니메이션 재시작
    el.classList.add(cls);
    var t = setTimeout(function () {
      el.classList.remove(cls);
    }, ms);
    allTimers.push(t);
  }

  function advanceZone(st) {
    // 반복 여부는 "지금 화면에 떠 있는 아이콘" 기준 (1-back).
    var next = nextItem(st.currentItem);
    st.prevItem        = st.currentItem; // 직전 표시 아이템 기록(참고용)
    st.currentItem     = next.item;
    st.currentIsRepeat = next.isRepeat;
    st.handled         = false;
    st.locked          = false;

    st.card.classList.remove('correct', 'wrong', 'locked');
    st.emoji.textContent = next.item;
    // 매 틱(반복 포함) 등장 애니메이션 → 반복도 "또 나왔다"로 인지 가능
    flashClass(st.emoji, 'appear', 240);
  }

  function handleTap(st) {
    if (!gameRunning || st.handled || st.locked || st.currentItem === null) return;

    if (st.currentIsRepeat) {
      // 정답: 반복일 때 터치
      st.handled = true;
      addScore(st.idx, 1);
      sounds.play('correct');
      flashClass(st.card, 'correct', 300);
    } else {
      // 오답: 반복 아닌데 터치 → -1, 짧은 잠금 (점수는 0 이상 유지)
      st.handled = true;
      st.locked  = true;
      addScore(st.idx, -1);
      sounds.play('wrong');
      flashClass(st.card, 'wrong', 300);
    }
  }

  // ===== 틱 간격 (난이도) =====
  function getTickInterval() {
    var ratio = timerRemaining / GAME_DURATION; // 1 → 0
    return TICK_END + ratio * (TICK_START - TICK_END);
  }

  function scheduleTick(st) {
    if (!gameRunning) return;
    advanceZone(st);
    var t = setTimeout(function () {
      scheduleTick(st);
    }, getTickInterval());
    allTimers.push(t);
  }

  // ===== 게임 시작 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning    = true;
    timerRemaining = GAME_DURATION;
    timerFill.style.width = '100%';
    timerText.textContent  = GAME_DURATION;

    showScreen('game');

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      timerRemaining = rem;
      var pct = (rem / GAME_DURATION * 100);
      timerFill.style.width = pct + '%';
      timerText.textContent  = rem;
    }, function () {
      endGame();
    });

    gameTimer.start();

    // 각 존 약간씩 시차를 두고 시작 (병렬, 독립 스트림)
    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var delay = idx * 150 + Math.random() * 200;
        var t = setTimeout(function () {
          scheduleTick(zones[idx]);
        }, delay);
        allTimers.push(t);
      })(p);
    }
  }

  // ===== 게임 종료 =====
  function endGame() {
    gameRunning = false;

    allTimers.forEach(clearTimeout);
    allTimers = [];

    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    clearCountdownTimers();
  }

  // ===== 결과 화면 =====
  function showResult() {
    var maxScore = -1;
    var winnerIdx = 0;
    playerScores.forEach(function (s, i) {
      if (s > maxScore) { maxScore = s; winnerIdx = i; }
    });

    var isTie = playerScores.filter(function (s) { return s === maxScore; }).length > 1;

    document.getElementById('resultWinnerLabel').textContent = isTie ? '동점!' : '승자';
    var winnerNameEl = document.getElementById('resultWinnerName');
    winnerNameEl.textContent  = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerNameEl.style.color  = isTie ? '#888' : PLAYER_COLORS[winnerIdx];

    var order = playerScores.map(function (s, i) { return { s: s, i: i }; });
    order.sort(function (a, b) { return b.s - a.s; });

    var resultScoresEl = document.getElementById('resultScores');
    resultScoresEl.innerHTML = '';
    order.forEach(function (item) {
      var isWinner = item.i === winnerIdx && !isTie;
      var row = document.createElement('div');
      row.className = 'result-score-row' + (isWinner ? ' winner' : '');
      row.dataset.player = item.i + 1;

      var trophySVG = '';
      if (isWinner) {
        trophySVG = '<svg viewBox="0 0 20 16" width="20" height="16" style="display:inline;vertical-align:middle;margin-right:4px"><polygon points="2,12 5,5 10,8 15,5 18,12" fill="#FFD700" stroke="#FFA000" stroke-width="1" stroke-linejoin="round"/><rect x="1.5" y="12" width="17" height="3" rx="1.5" fill="#FFD700" stroke="#FFA000" stroke-width="1"/></svg>';
      }

      var nameEl = document.createElement('div');
      nameEl.className = 'result-score-name';
      nameEl.innerHTML = trophySVG + PLAYER_NAMES[item.i];

      var valEl = document.createElement('div');
      valEl.className = 'result-score-val';
      valEl.textContent = item.s + '점';

      row.appendChild(nameEl);
      row.appendChild(valEl);
      resultScoresEl.appendChild(row);
    });

    showScreen('result');
  }

  // ===== 버튼 이벤트 =====
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(startGame);
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    cleanupGame();
    startCountdown(startGame);
  });

  document.getElementById('homeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  document.getElementById('closeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  window.addEventListener('beforeunload', cleanupGame);
  window.addEventListener('pagehide', cleanupGame);

})();
