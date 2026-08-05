/* games/avoid-triangle/game.js — 패턴 C (2인 전략) — 삼각형 피하기 (Sim) */

'use strict';

// ─── 상수 ───────────────────────────────────────────────────────────────
// 6개의 점을 정육각형으로 배치하고, 모든 점 사이를 잇는 변 15개를 번갈아 칠한다.
// 자기 색 변 세 개가 한 삼각형(세 점 모두 연결)을 이루면 그 사람이 진다.
var NODE_COUNT = 6;
var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
var PLAYER_NAMES  = ['P1', 'P2'];
var RESULT_PAUSE_MS = getAutoplayPauseMs(1100);

// 변 목록: i<j 인 모든 쌍 (총 15개)
function buildEdges() {
  var edges = [];
  for (var i = 0; i < NODE_COUNT; i++) {
    for (var j = i + 1; j < NODE_COUNT; j++) {
      edges.push([i, j]);
    }
  }
  return edges;
}
var EDGES = buildEdges();

function edgeKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

// 세 점 조합 20개
function buildTriples() {
  var t = [];
  for (var i = 0; i < NODE_COUNT; i++)
    for (var j = i + 1; j < NODE_COUNT; j++)
      for (var k = j + 1; k < NODE_COUNT; k++)
        t.push([i, j, k]);
  return t;
}
var TRIPLES = buildTriples();

// owner: { 'i-j': 0|1 } — 플레이어 p 가 단색 삼각형을 이뤘으면 그 세 점 [i,j,k] 반환, 없으면 null
function findMonoTriangle(owner, p) {
  for (var t = 0; t < TRIPLES.length; t++) {
    var tri = TRIPLES[t];
    var e1 = edgeKey(tri[0], tri[1]);
    var e2 = edgeKey(tri[1], tri[2]);
    var e3 = edgeKey(tri[0], tri[2]);
    if (owner[e1] === p && owner[e2] === p && owner[e3] === p) return tri;
  }
  return null;
}

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
  drop: function (ctx) {
    var osc = ctx.createOscillator(); var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
  },
  win: function (ctx) {
    var notes = [523, 659, 784, 1047, 1319];
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      var t = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.42);
    });
  },
  lose: function (ctx) {
    var osc = ctx.createOscillator(); var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.55);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  },
  turnP1: function (ctx) {
    [659, 880].forEach(function (freq, i) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      var t = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.2);
    });
  },
  turnP2: function (ctx) {
    [392, 523].forEach(function (freq, i) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
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
[document.getElementById('soundToggleIntro'), document.getElementById('soundToggleGame')]
  .forEach(function (btn) {
    if (!btn) return;
    onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
  });
updateSoundIcons();

// ─── 게임 상태 ────────────────────────────────────────────────────────────
var owner;          // { 'i-j': 0|1 }
var currentPlayer;  // 0 or 1
var gameOver;
var locked;
var placedCount;
var nodePos;        // [{x,y}] 6개

// ─── DOM ─────────────────────────────────────────────────────────────────
var boardWrap   = document.getElementById('boardGrid');
var turnDot     = document.getElementById('turnDot');
var turnText    = document.getElementById('turnText');
var resultTitle    = document.getElementById('resultTitle');
var resultSub      = document.getElementById('resultSub');
var resultIconWrap = document.getElementById('resultIconWrap');
var turnBanner  = document.getElementById('turnBanner');

var SVG_NS = 'http://www.w3.org/2000/svg';

// ─── 게임 초기화 ──────────────────────────────────────────────────────────
function initGame() {
  clearAllTimers();
  owner = {};
  currentPlayer = 0;
  gameOver = false;
  locked = false;
  placedCount = 0;

  buildBoard();
  updateTurnUI(false);
  updateLockState();
  showScreen('game');
}

// ─── 점 좌표 계산 (정육각형, 위쪽 꼭짓점부터 시계방향) ─────────────────────
function computeNodes() {
  var cx = 160, cy = 162, r = 130;
  var pos = [];
  for (var i = 0; i < NODE_COUNT; i++) {
    var ang = (-90 + i * 60) * Math.PI / 180;
    pos.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pos;
}

// ─── 보드 빌드 (SVG) ──────────────────────────────────────────────────────
function buildBoard() {
  nodePos = computeNodes();
  boardWrap.innerHTML = '';

  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 324');
  svg.setAttribute('class', 'sim-svg');
  svg.id = 'simSvg';

  // 변(線): 먼저 그려서 점 아래에 깔리게
  EDGES.forEach(function (e) {
    var a = nodePos[e[0]], b = nodePos[e[1]];
    var key = edgeKey(e[0], e[1]);

    // 보이는 선
    var line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', 'sim-edge');
    line.id = 'edge-' + key;
    svg.appendChild(line);

    // 클릭 히트 영역(투명, 두꺼움)
    var hit = document.createElementNS(SVG_NS, 'line');
    hit.setAttribute('x1', a.x); hit.setAttribute('y1', a.y);
    hit.setAttribute('x2', b.x); hit.setAttribute('y2', b.y);
    hit.setAttribute('class', 'sim-hit');
    hit.dataset.key = key;
    (function (k) { onTap(hit, function () { handlePlace(k); }); })(key);
    svg.appendChild(hit);
  });

  // 점(꼭짓점)
  nodePos.forEach(function (p) {
    var c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', 13);
    c.setAttribute('class', 'sim-node');
    svg.appendChild(c);
  });

  boardWrap.appendChild(svg);
}

// ─── 턴 UI ────────────────────────────────────────────────────────────────
function updateTurnUI(announce) {
  var color = PLAYER_COLORS[currentPlayer];
  var name  = PLAYER_NAMES[currentPlayer];
  var pCls  = currentPlayer === 0 ? 'p1' : 'p2';

  turnDot.style.background = color;
  turnText.textContent = name + '의 차례';

  turnBanner.classList.remove('p1', 'p2');
  turnBanner.classList.add(pCls);

  boardWrap.classList.remove('p1', 'p2');
  boardWrap.classList.add(pCls);

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

function updateLockState() {
  boardWrap.classList.toggle('locked', gameOver || locked);
}

// ─── 변 칠하기 ────────────────────────────────────────────────────────────
function handlePlace(key) {
  if (gameOver || locked) return;
  if (owner[key] !== undefined) return; // 이미 칠한 변

  locked = true;
  updateLockState();

  var p = currentPlayer;
  owner[key] = p;
  placedCount++;

  var line = document.getElementById('edge-' + key);
  if (line) {
    line.classList.add(p === 0 ? 'p1' : 'p2', 'placed');
  }
  sounds.play('drop');

  later(function () {
    var tri = findMonoTriangle(owner, p);
    if (tri) {
      // 삼각형을 만든 사람이 패배
      gameOver = true;
      highlightTriangle(tri);
      updateLockState();
      later(function () {
        sounds.play('lose');
        showResult(1 - p, p);
      }, RESULT_PAUSE_MS);
      return;
    }

    if (placedCount >= EDGES.length) {
      // 이론상 도달 불가(R(3,3)=6)지만 안전망: 무승부
      gameOver = true;
      updateLockState();
      later(function () { sounds.play('win'); showResult(-1, -1); }, RESULT_PAUSE_MS);
      return;
    }

    currentPlayer = 1 - currentPlayer;
    locked = false;
    updateTurnUI(true);
    updateLockState();
  }, 300);
}

// ─── 패배 삼각형 강조 ──────────────────────────────────────────────────────
function highlightTriangle(tri) {
  var pairs = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[0], tri[2]]];
  pairs.forEach(function (pr) {
    var line = document.getElementById('edge-' + edgeKey(pr[0], pr[1]));
    if (line) line.classList.add('triangle-lose');
  });
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

var SVG_DRAW =
  '<svg viewBox="0 0 80 80" width="80" height="80">' +
    '<circle cx="40" cy="40" r="30" fill="#FFE082" stroke="#FFA726" stroke-width="3"/>' +
    '<circle cx="30" cy="34" r="4" fill="#8D6E63"/>' +
    '<circle cx="50" cy="34" r="4" fill="#8D6E63"/>' +
    '<line x1="28" y1="52" x2="52" y2="52" stroke="#8D6E63" stroke-width="4" stroke-linecap="round"/>' +
  '</svg>';

function showResult(winner, loser) {
  if (winner < 0) {
    resultIconWrap.innerHTML = SVG_DRAW;
    resultTitle.textContent = '비겼어요!';
    resultTitle.style.color = '#FB8C00';
    resultSub.textContent = '15개 변을 다 칠했어요.';
  } else {
    var winColor = PLAYER_COLORS[winner];
    resultIconWrap.innerHTML = SVG_TROPHY;
    resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
    resultTitle.style.color = winColor;
    resultSub.textContent = PLAYER_NAMES[loser] + '이(가) 삼각형을 만들었어요!';
  }
  showScreen('result');
}

// ─── 버튼 이벤트 ──────────────────────────────────────────────────────────
onTap(document.getElementById('playBtn'),  function () { startCountdown(function () { initGame(); }); });
onTap(document.getElementById('retryBtn'), function () { startCountdown(function () { initGame(); }); });
onTap(document.getElementById('homeBtn'),  function () { clearAllTimers(); goHome(); });
onTap(document.getElementById('backBtn'),  function () { clearAllTimers(); goHome(); });
onTap(document.getElementById('closeBtn'), function () { clearAllTimers(); showScreen('intro'); });

// ─── 테스트 훅 (Node 환경에서만) ───────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildEdges: buildEdges, buildTriples: buildTriples, edgeKey: edgeKey,
    findMonoTriangle: findMonoTriangle, EDGES: EDGES, TRIPLES: TRIPLES
  };
}
