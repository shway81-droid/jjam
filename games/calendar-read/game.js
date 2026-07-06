/* games/calendar-read/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 10;
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const WD_COLOR = ['#D32F2F', '#37474F', '#37474F', '#37474F', '#37474F', '#37474F', '#1976D2'];
const FONT = "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif";

const PLAYER_CONFIG = [
  { label: 'P1', colorClass: 'p-blue',   hex: '#1565C0' },
  { label: 'P2', colorClass: 'p-red',    hex: '#B71C1C' },
  { label: 'P3', colorClass: 'p-orange', hex: '#E65100' },
  { label: 'P4', colorClass: 'p-teal',   hex: '#00695C' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
  },
  fanfare(ctx) {
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let currentRound  = 0;
let scores        = [];
let roundResults  = [];
let roundActive   = false;
let roundDQ       = new Set();
let correct       = null;   // { month, startWd, lastDay, target, wd }
let nextRoundTimerId = null;

// ── DOM references ───────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen   = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn      = document.getElementById('backBtn');
const playBtn      = document.getElementById('playBtn');
const closeBtn     = document.getElementById('closeBtn');
const retryBtn     = document.getElementById('retryBtn');
const homeBtn      = document.getElementById('homeBtn');

const zonesWrap    = document.getElementById('zonesWrap');
const roundBadge   = document.getElementById('roundBadge');
const stageView    = document.getElementById('stageView');
const stageFeedback = document.getElementById('stageFeedback');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const soundIconIntro   = document.getElementById('soundIconIntro');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(screen) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function updateSoundIcon() {
  const muted = sound.isMuted();
  soundIconIntro.innerHTML = muted
    ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
       <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
    : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
       <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
       <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
}

// ── SVG Calendar builder ──────────────────────────────────────
/**
 * Draws a month calendar with the target date ringed.
 * The answer is the weekday of that date.
 */
function buildCalendarSVG(c) {
  const left = 8, cellW = 30, cellH = 26;
  const headerY = 24, headerH = 22;
  const weeksY = headerY + headerH;
  const numRows = Math.ceil((c.startWd + c.lastDay) / 7);
  const gridW = cellW * 7;
  const W = left + gridW + left;
  const H = weeksY + numRows * cellH + 8;
  const cx = col => left + col * cellW + cellW / 2;

  // Title
  const title = `<text x="${W / 2}" y="16" text-anchor="middle" font-size="12" font-weight="800"
    fill="#00695C" font-family="${FONT}">${c.month}월  ${c.target}일은?</text>`;

  // Outer border + header background
  const frame = `<rect x="${left - 2}" y="${headerY}" width="${gridW + 4}" height="${headerH + numRows * cellH}" rx="6"
      fill="#FFFDF5" stroke="#37474F" stroke-width="2.5"/>
    <rect x="${left - 2}" y="${headerY}" width="${gridW + 4}" height="${headerH}"
      fill="#FFE0B2"/>`;

  // Column separators
  let seps = '';
  for (let col = 1; col < 7; col++) {
    const x = left + col * cellW;
    seps += `<line x1="${x}" y1="${headerY}" x2="${x}" y2="${weeksY + numRows * cellH}" stroke="#E4D9B4" stroke-width="1"/>`;
  }
  // Row separator under header
  seps += `<line x1="${left - 2}" y1="${weeksY}" x2="${left + gridW + 2}" y2="${weeksY}" stroke="#37474F" stroke-width="1.5"/>`;

  // Weekday header letters
  let head = '';
  for (let col = 0; col < 7; col++) {
    head += `<text x="${cx(col)}" y="${headerY + 15}" text-anchor="middle" font-size="10" font-weight="bold"
      fill="${WD_COLOR[col]}" font-family="${FONT}">${WD[col]}</text>`;
  }

  // Target highlight ring
  const idx = c.startWd + (c.target - 1);
  const trow = Math.floor(idx / 7), tcol = idx % 7;
  const tcy = weeksY + trow * cellH + cellH / 2;
  const ring = `<circle cx="${cx(tcol)}" cy="${tcy}" r="11"
    fill="rgba(230,81,0,0.18)" stroke="#E65100" stroke-width="2.5"/>`;

  // Date numbers
  let dates = '';
  for (let d = 1; d <= c.lastDay; d++) {
    const di = c.startWd + (d - 1);
    const row = Math.floor(di / 7), col = di % 7;
    const isTarget = (d === c.target);
    dates += `<text x="${cx(col)}" y="${weeksY + row * cellH + cellH / 2 + 4}" text-anchor="middle"
      font-size="11" font-weight="${isTarget ? 'bold' : '600'}"
      fill="${isTarget ? '#BF360C' : WD_COLOR[col]}" font-family="${FONT}">${d}</text>`;
  }

  return `
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${title}
  ${frame}
  ${seps}
  ${head}
  ${ring}
  ${dates}
</svg>`.trim();
}

function buildPlaceholderSVG() {
  return `<svg viewBox="0 0 226 180" width="226" height="180" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="24" width="214" height="150" rx="6" fill="#ECEFF1" stroke="#B0BEC5" stroke-width="2.5"/>
  </svg>`;
}

// ── SVG Option button builder ─────────────────────────────────
function buildOptBtnSVG(label, fill, w, h) {
  return `
<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" ry="12"
    fill="${fill}" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
    font-size="${h * 0.32}" font-weight="800" fill="#FFFFFF" font-family="${FONT}">${label}</text>
</svg>`.trim();
}

// ── Question generation ───────────────────────────────────────
let usedKeys = [];
function resetUsed() { usedKeys = []; }

function generateCorrect(round) {
  let month, startWd, target, lastDay, key, tries = 0;
  const lastDays = [28, 29, 30, 31];
  do {
    month   = randInt(1, 12);
    lastDay = lastDays[randInt(0, 3)];
    if (round <= 4)      { startWd = randInt(0, 1); target = randInt(1, 7); }
    else if (round <= 7) { startWd = randInt(0, 4); target = randInt(8, 20); }
    else                 { startWd = randInt(0, 6); target = randInt(10, 28); }
    if (target > lastDay) target = lastDay;
    key = `${startWd}-${target}`;
    tries++;
  } while (usedKeys.includes(key) && tries < 200);
  usedKeys.push(key);
  const wd = (startWd + (target - 1)) % 7;
  return { month, startWd, lastDay, target, wd };
}

function generateWrongWeekdays(wd) {
  const cands = [(wd + 1) % 7, (wd + 6) % 7, (wd + 2) % 7, (wd + 5) % 7, (wd + 3) % 7, (wd + 4) % 7];
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  const out = [];
  for (const v of cands) {
    if (out.length >= 2) break;
    if (v !== wd && !out.includes(v)) out.push(v);
  }
  return out;
}

function generateOptions(c) {
  const wrongs = generateWrongWeekdays(c.wd);
  const options = [
    { wd: c.wd,       isCorrect: true },
    { wd: wrongs[0],  isCorrect: false },
    { wd: wrongs[1],  isCorrect: false },
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// ── Sound Toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => { sound.toggleMute(); updateSoundIcon(); });
updateSoundIcon();

// ── Player count selection ────────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn, () => { clearNextRoundTimer(); goHome(); });
onTap(closeBtn, () => { clearNextRoundTimer(); goHome(); });
onTap(homeBtn, () => { clearNextRoundTimer(); goHome(); });
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn, () => startCountdown(() => startGame()));

// ── Zone building ─────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.colorClass} state-wait`;
    zone.dataset.player = i;

    const labelEl = document.createElement('span');
    labelEl.className = 'zone-label';
    labelEl.textContent = cfg.label;

    const optionsEl = document.createElement('div');
    optionsEl.className = 'opt-row';
    optionsEl.dataset.player = i;

    zone.appendChild(optionsEl);
    zone.appendChild(labelEl);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }
function getOptionsEl(idx) { return zonesWrap.querySelector(`.opt-row[data-player="${idx}"]`); }

// ── Render option buttons into a zone ────────────────────────
function renderOptions(playerIdx, options) {
  const container = getOptionsEl(playerIdx);
  if (!container) return;
  container.innerHTML = '';

  const cfg = PLAYER_CONFIG[playerIdx];
  const btnW = 66, btnH = 52;
  const btnFill = darkenHex(cfg.hex, 20);

  options.forEach(opt => {
    const label = `${WD[opt.wd]}요일`;
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.setAttribute('aria-label', label);
    btn.innerHTML = buildOptBtnSVG(label, btnFill, btnW, btnH);
    btn.dataset.correct = opt.isCorrect ? '1' : '0';

    onTap(btn, (e) => {
      e.stopPropagation();
      if (!roundActive) return;
      if (roundDQ.has(playerIdx)) return;
      handleAnswer(playerIdx, opt.isCorrect, e);
    });

    container.appendChild(btn);
  });
}

function darkenHex(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ── Ripple visual ─────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  const x = (touch ? touch.clientX : rect.left + rect.width / 2) - rect.left;
  const y = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'zone-ripple';
  ripple.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin-left:-${size/2}px;margin-top:-${size/2}px`;
  zone.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Answer handling ───────────────────────────────────────────
function handleAnswer(playerIdx, isCorrect, e) {
  const zone = getZone(playerIdx);
  if (zone) spawnRipple(zone, e);

  if (isCorrect) {
    sound.play('ding');
    scores[playerIdx]++;
    roundDQ.add('resolved');

    if (zone) {
      zone.classList.remove('state-wait', 'state-active', 'state-dq');
      zone.classList.add('state-correct');
    }

    const cfg = PLAYER_CONFIG[playerIdx];
    stageFeedback.textContent = `${cfg.label} 정답! (${WD[correct.wd]}요일)`;
    stageFeedback.style.background = 'rgba(46,125,50,0.85)';

    recordRound(playerIdx);
    roundActive = false;
    scheduleNextOrEnd();
  } else {
    sound.play('buzz');
    roundDQ.add(playerIdx);
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);

    if (zone) {
      zone.classList.remove('state-wait', 'state-active');
      zone.classList.add('state-dq');

      const penalty = document.createElement('div');
      penalty.className = 'penalty-flash';
      penalty.textContent = '-1';
      zone.style.position = 'relative';
      zone.appendChild(penalty);
      penalty.addEventListener('animationend', () => penalty.remove());
    }

    const activePlayers = Array.from({ length: playerCount }, (_, i) => i)
      .filter(i => !roundDQ.has(i));

    if (activePlayers.length === 0) {
      if (!roundDQ.has('resolved')) {
        stageFeedback.textContent = `모두 실격! 정답 ${WD[correct.wd]}요일`;
        stageFeedback.style.background = 'rgba(183,28,28,0.85)';
        recordRound(-1);
        roundActive = false;
        scheduleNextOrEnd();
      }
    }
  }
}

// ── Timer cleanup ─────────────────────────────────────────────
function clearNextRoundTimer() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (nextRoundTimerId) { clearTimeout(nextRoundTimerId); nextRoundTimerId = null; }
}

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  clearNextRoundTimer();
  scores        = new Array(playerCount).fill(0);
  roundResults  = [];
  currentRound  = 0;
  resetUsed();
  showScreen(gameScreen);
  buildZones();
  nextRound();
}

function nextRound() {
  clearNextRoundTimer();
  currentRound++;
  roundDQ      = new Set();
  roundActive  = false;
  correct      = null;

  roundBadge.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;
  stageFeedback.textContent = '';
  stageFeedback.style.background = 'transparent';

  stageView.innerHTML = buildPlaceholderSVG();

  setAllZoneState('state-wait');
  clearOptions();

  nextRoundTimerId = setTimeout(() => {
    nextRoundTimerId = null;
    sound.play('tick');
    presentRound();
  }, 700);
}

function presentRound() {
  correct = generateCorrect(currentRound);
  stageView.innerHTML = buildCalendarSVG(correct);

  for (let i = 0; i < playerCount; i++) {
    renderOptions(i, generateOptions(correct));
  }

  setAllZoneState('state-active');
  roundActive = true;
}

function clearOptions() {
  for (let i = 0; i < playerCount; i++) {
    const el = getOptionsEl(i);
    if (el) el.innerHTML = '';
  }
}

function setAllZoneState(stateClass) {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (!z) continue;
    z.classList.remove('state-wait', 'state-active', 'state-dq', 'state-correct', 'state-wrong');
    z.classList.add(stateClass);
  }
}

function recordRound(winnerIdx) {
  roundResults.push({ winner: winnerIdx, dq: new Set(roundDQ) });
}

function scheduleNextOrEnd() {
  nextRoundTimerId = setTimeout(() => {
    nextRoundTimerId = null;
    if (currentRound >= TOTAL_ROUNDS) showResult();
    else nextRound();
  }, 1600);
}

// ── Result screen ─────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승!`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')}`;
    resultWinner.style.color = '#00897B';
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);
  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi)) return `<td class="cell-dq">실격</td>`;
      if (r.winner === pi) return `<td class="cell-win">정답</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td>${ri + 1}</td>${cells}</tr>`;
  }).join('');

  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
