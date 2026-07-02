/* games/word-build/game.js */

(function () {
  'use strict';

  // ─── 낱말 풀: [목표 낱말, 이모지 힌트] (두 글자) ──────────────────────────
  // 각 낱말을 앞 글자 + 뒷 글자로 분해해 사용한다.
  var WORDS = [
    ['사과','🍎'], ['사자','🦁'], ['바다','🌊'], ['바지','👖'], ['나무','🌳'],
    ['나비','🦋'], ['구름','☁️'], ['구두','👞'], ['모자','🧢'], ['우산','☂️'],
    ['우유','🥛'], ['가방','🎒'], ['가위','✂️'], ['토끼','🐰'], ['오리','🦆'],
    ['오이','🥒'], ['딸기','🍓'], ['포도','🍇'], ['수박','🍉'], ['호박','🎃'],
    ['당근','🥕'], ['양파','🧅'], ['여우','🦊'], ['하늘','🌤️'], ['시계','⏰'],
    ['책상','🪑'], ['연필','✏️'], ['바람','🌬️'], ['구슬','🔮'], ['거울','🪞'],
    ['다리','🦵'], ['머리','🧑'], ['손목','💪'], ['풍선','🎈'], ['단추','🔘']
  ];

  // 실제 낱말 집합(오답 조합이 진짜 낱말이 되는 것을 막기 위한 참조)
  var WORD_SET = {};
  WORDS.forEach(function (w) { WORD_SET[w[0]] = true; });

  // 앞 글자 / 뒷 글자 풀(중복 제거)
  var FRONT_POOL = [];
  var BACK_POOL = [];
  WORDS.forEach(function (w) {
    var f = w[0].charAt(0), b = w[0].charAt(1);
    if (FRONT_POOL.indexOf(f) === -1) FRONT_POOL.push(f);
    if (BACK_POOL.indexOf(b) === -1) BACK_POOL.push(b);
  });

  var TOTAL_ROUNDS = 5;

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
  var currentRound;
  var score;
  var problems;       // 이번 게임 5개 문제
  var p1Selected;     // {idx, val} 또는 null
  var p2Selected;
  var locked;         // 채점 중 잠금

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1Pick       = document.getElementById('p1Pick');
  var p2Pick       = document.getElementById('p2Pick');
  var targetVal    = document.getElementById('targetVal');
  var targetHint   = document.getElementById('targetHint');
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

  // ─── 카드 4장 생성: 정답 1개 + 방해 3개 (중복 없음) ───────────────────────
  // isWordWith(candidate): 후보가 정답 짝과 합쳐져 '진짜 낱말'이 되면 true.
  // 그런 후보는 방해 보기에서 제외해, 정답 조합만이 실제 낱말이 되도록 한다.
  function pickFourWith(pool, correct, isWordWith) {
    var safe = [];
    var risky = [];
    pool.forEach(function (x) {
      if (x === correct) return;
      if (isWordWith(x)) risky.push(x); else safe.push(x);
    });
    var distractors = shuffleArr(safe).slice(0, 3);
    // 안전한 보기가 3개 미만이면(드문 경우) 어쩔 수 없이 채운다.
    if (distractors.length < 3) {
      distractors = distractors.concat(shuffleArr(risky).slice(0, 3 - distractors.length));
    }
    return shuffleArr([correct].concat(distractors));
  }

  // ─── 문제 한 개 빌드 ─────────────────────────────────────────────────────
  // entry = [목표 낱말, 이모지]; 앞 글자 + 뒷 글자로 분해.
  function buildProblem(entry) {
    var target = entry[0];
    var emoji = entry[1];
    var front = target.charAt(0);
    var back = target.charAt(1);
    return {
      target: target,
      emoji: emoji,
      front: front,
      back: back,
      // P1 앞 글자 보기: (방해앞 + 정답뒤)가 실제 낱말이 되지 않게.
      p1: pickFourWith(FRONT_POOL, front, function (f) {
        return WORD_SET[f + back] === true;
      }),
      // P2 뒷 글자 보기: (정답앞 + 방해뒤)가 실제 낱말이 되지 않게.
      p2: pickFourWith(BACK_POOL, back, function (b) {
        return WORD_SET[front + b] === true;
      })
    };
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, items, player) {
    grid.innerHTML = '';
    items.forEach(function (ch, idx) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = ch;
      btn.setAttribute('data-idx', idx);
      btn.setAttribute('data-val', ch);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, ch, grid);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(player, idx, val, grid) {
    sounds.play('pick');

    var cards = grid.querySelectorAll('.num-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cards[idx].classList.add('selected');

    if (player === 1) {
      p1Selected = { idx: idx, val: val };
      p1Pick.textContent = val;
    } else {
      p2Selected = { idx: idx, val: val };
      p2Pick.textContent = val;
    }

    if (p1Selected && p2Selected) {
      locked = true;
      boardsEl.classList.add('locked');
      later(checkAnswer, 500);
    }
  }

  // ─── 채점 ────────────────────────────────────────────────────────────────
  function checkAnswer() {
    var problem = problems[currentRound];
    // 협력: P1 앞 글자와 P2 뒷 글자가 둘 다 맞아야 성공(앞+뒤=목표 낱말).
    var ok = (p1Selected.val === problem.front) && (p2Selected.val === problem.back);

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      showBanner('성공! ' + p1Selected.val + ' + ' + p2Selected.val + ' = ' + problem.target, 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      showBanner('아쉬워요! 정답은 ' + problem.front + ' + ' + problem.back + ' = ' + problem.target, 'ng');
      sounds.play('wrong');
    }

    updateScoreUI();

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        nextRound();
      }
    }, 1500);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    boardsEl.classList.remove('locked');
    p1Selected = null;
    p2Selected = null;
    p1Pick.textContent = '?';
    p2Pick.textContent = '?';
    hideBanner();

    var problem = problems[currentRound];
    targetVal.textContent = problem.target;
    if (targetHint) targetHint.textContent = problem.emoji || '';
    buildCards(p1Grid, problem.p1, 1);
    buildCards(p2Grid, problem.p2, 2);
    updateRoundUI();
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
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

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    currentRound = 0;
    score = 0;
    p1Selected = null;
    p2Selected = null;
    locked = false;
    problems = shuffleArr(WORDS).slice(0, TOTAL_ROUNDS).map(buildProblem);
    updateScoreUI();
    nextRound();
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
    var title, sub, icon;
    if (score === TOTAL_ROUNDS) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '완벽한 낱말 짝꿍! 👏';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '훌륭한 팀워크! 다시 도전해봐요';
      icon = SVG_OK;
    } else {
      title = score + '/' + TOTAL_ROUNDS;
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
