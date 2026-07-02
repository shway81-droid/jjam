/* games/sum-pyramid/game.js — 덧셈 피라미드, 퍼즐형 멀티(2~4인) 각자 보드 레이스
 * 규칙: 아래 두 칸의 합이 바로 위 칸이 된다. 빈칸을 팔레트 숫자로 채워 완성.
 * 라운드별로 모든 플레이어가 같은 퍼즐을 풀고, 가장 먼저 완성하면 1승. 3라운드.
 */
'use strict';

const SP_TOTAL_ROUNDS = 3;
const SP_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// 라운드 계획: base = 맨 아래 줄 칸 수, range = 맨 아래 값 범위[1..range], blanks = 빈칸 수
const SP_PLANS = [
  { base: 3, range: 9, blanks: 2, time: 60 },
  { base: 4, range: 6, blanks: 3, time: 75 },
  { base: 4, range: 6, blanks: 4, time: 90 },
];

const SP_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── 피라미드 기하 ──
// row r (0=꼭대기) 는 r+1 칸. flat 인덱스 = offset[r] + c.
function spOffsets(base) {
  const off = []; let s = 0;
  for (let r = 0; r < base; r++) { off.push(s); s += r + 1; }
  return off;
}
function spTotal(base) { return base * (base + 1) / 2; }
function spIdx(off, r, c) { return off[r] + c; }

function spBuildFromBottom(base, bottom) {
  const off = spOffsets(base);
  const cells = new Array(spTotal(base)).fill(0);
  for (let c = 0; c < base; c++) cells[spIdx(off, base - 1, c)] = bottom[c];
  for (let r = base - 2; r >= 0; r--) {
    for (let c = 0; c <= r; c++) {
      cells[spIdx(off, r, c)] = cells[spIdx(off, r + 1, c)] + cells[spIdx(off, r + 1, c + 1)];
    }
  }
  return cells;
}

// given(값 또는 null)로 [1..range] 바닥값을 탐색해 해의 개수(0/1/2+)를 센다.
function spCountSolutions(base, given, range) {
  const off = spOffsets(base);
  const bottomIdx = [];
  for (let c = 0; c < base; c++) bottomIdx.push(spIdx(off, base - 1, c));
  const free = []; const fixed = {};
  for (let c = 0; c < base; c++) {
    const gi = given[bottomIdx[c]];
    if (gi == null) free.push(c); else fixed[c] = gi;
  }
  let count = 0;
  const bottom = new Array(base);
  for (const c in fixed) bottom[c] = fixed[c];
  function rec(k) {
    if (count > 1) return;
    if (k === free.length) {
      const cells = spBuildFromBottom(base, bottom);
      for (let i = 0; i < cells.length; i++) {
        if (given[i] != null && given[i] !== cells[i]) return;
      }
      count++;
      return;
    }
    const c = free[k];
    for (let v = 1; v <= range; v++) { bottom[c] = v; rec(k + 1); if (count > 1) return; }
  }
  rec(0);
  return count;
}

function spRandInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function spShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 유일해 퍼즐 생성: { base, sol[], given[](값|null), blankCells[], range }
function spMakePuzzle(plan) {
  const { base, range, blanks } = plan;
  const N = spTotal(base);
  const off = spOffsets(base);
  for (let attempt = 0; attempt < 600; attempt++) {
    const bottom = [];
    for (let c = 0; c < base; c++) bottom.push(spRandInt(1, range));
    const sol = spBuildFromBottom(base, bottom);
    const cand = spShuffle([...Array(N).keys()]);
    const given = sol.slice();
    let blanked = 0;
    for (const ci of cand) {
      if (blanked >= blanks) break;
      const saved = given[ci];
      given[ci] = null;
      if (spCountSolutions(base, given, range) === 1) blanked++;
      else given[ci] = saved;
    }
    if (blanked !== blanks) continue;
    // 깊이 있는 추론을 위해 맨 아래 줄에도 빈칸이 하나는 있도록(빈칸 3개 이상일 때)
    if (blanks >= 3) {
      let bottomBlank = false;
      for (let c = 0; c < base; c++) if (given[spIdx(off, base - 1, c)] == null) bottomBlank = true;
      if (!bottomBlank) continue;
    }
    const blankCells = [];
    for (let i = 0; i < N; i++) if (given[i] == null) blankCells.push(i);
    return { base, sol, given, blankCells, range };
  }
  // 폴백(이론상 도달 불가): 빈칸 없이 그대로
  const bottom = []; for (let c = 0; c < base; c++) bottom.push(spRandInt(1, range));
  const sol = spBuildFromBottom(base, bottom);
  return { base, sol, given: sol.slice(), blankCells: [], range };
}

// ── 사운드 ──
const spSound = createSoundManager({
  place(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  lineOk(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(784, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.17);
  },
  ding(ctx) {
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    });
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

// ── 상태 ──
let spPlayerCount = 2;
let spRoundIdx = 0;
let spScores = [];
let spPhase = 'idle';
let spTimerHandle = null;
let spNextHandle = null;
let spTimeRemaining = 0;
let spRoundFirstWinner = -1;
let spSolved = [];
let spBoards = [];     // [{ cells:[값|null], given:Set<idx>, sol:[], blankCells:[], base }]
let spPalettes = [];   // [[{ val, used:false, placedAt }]]
let spSelected = [];   // per player: 선택된 빈칸 idx 또는 -1
let spCurrentPuzzle = null;

const spEl = id => document.getElementById(id);
const spIntroScreen = spEl('introScreen');
const spCountdownScreen = spEl('countdownScreen');
const spGameScreen = spEl('gameScreen');
const spResultScreen = spEl('resultScreen');
const spCountdownNumber = spEl('countdownNumber');
const spBackBtn = spEl('backBtn');
const spPlayBtn = spEl('playBtn');
const spCloseBtn = spEl('closeBtn');
const spRetryBtn = spEl('retryBtn');
const spHomeBtn = spEl('homeBtn');
const spZonesWrap = spEl('zonesWrap');
const spQuestionCounter = spEl('questionCounter');
const spProblemTimer = spEl('problemTimer');
const spProblemStatus = spEl('problemStatus');
const spScoreBar = spEl('scoreBar');
const spSoundToggleIntro = spEl('soundToggleIntro');
const spResultTitle = spEl('resultTitle');
const spResultWinner = spEl('resultWinner');
const spTotalRow = spEl('totalRow');

function spShowScreen(s) {
  [spIntroScreen, spCountdownScreen, spGameScreen, spResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let spCdInterval = null;
function spStartCountdown(onDone) {
  spShowScreen(spCountdownScreen);
  spCdInterval = runCountdown(spCountdownNumber, onDone);
}

function spClearTimers() {
  if (spCdInterval) { clearInterval(spCdInterval); spCdInterval = null; }
  if (spTimerHandle) { clearInterval(spTimerHandle); spTimerHandle = null; }
  if (spNextHandle) { clearTimeout(spNextHandle); spNextHandle = null; }
}

function spGetZone(idx) {
  return spZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── 보드 렌더 ──
function spRenderBoard(p) {
  const zone = spGetZone(p);
  if (!zone) return;
  const bd = spBoards[p];
  const base = bd.base;
  const off = spOffsets(base);
  const sel = spSelected[p];

  const area = zone.querySelector('.sp-board');
  area.innerHTML = '';

  for (let r = 0; r < base; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'sp-row';
    for (let c = 0; c <= r; c++) {
      const ci = spIdx(off, r, c);
      const cell = document.createElement('div');
      cell.className = 'sp-cell';
      const v = bd.cells[ci];
      if (bd.given.has(ci)) {
        cell.classList.add('given');
        cell.textContent = v;
      } else {
        cell.classList.add('blank');
        if (v != null) { cell.textContent = v; cell.classList.add('filled'); }
        else cell.textContent = '';
        if (ci === sel) cell.classList.add('selected');
        onTap(cell, () => spHandleCellTap(p, ci));
      }
      // 합 관계 표시: 비-바닥 칸이고 본인+두 자식 모두 채워졌고 합이 맞으면 good
      if (r < base - 1) {
        const lci = spIdx(off, r + 1, c), rci = spIdx(off, r + 1, c + 1);
        const pv = bd.cells[ci], lv = bd.cells[lci], rv = bd.cells[rci];
        if (pv != null && lv != null && rv != null && pv === lv + rv) cell.classList.add('good');
      }
      rowEl.appendChild(cell);
    }
    area.appendChild(rowEl);
  }
  spRenderPalette(p);
}

function spRenderPalette(p) {
  const zone = spGetZone(p);
  if (!zone) return;
  const pal = zone.querySelector('.sp-palette');
  pal.innerHTML = '';
  spPalettes[p].forEach((tile, ti) => {
    const btn = document.createElement('button');
    btn.className = 'sp-tile' + (tile.used ? ' used' : '');
    btn.textContent = tile.val;
    btn.setAttribute('aria-label', String(tile.val));
    if (!tile.used) onTap(btn, () => spHandleTileTap(p, ti));
    pal.appendChild(btn);
  });
}

// ── 입력 ──
function spHandleCellTap(p, ci) {
  if (spPhase !== 'active' || spSolved[p]) return;
  const bd = spBoards[p];
  if (bd.given.has(ci)) return;
  // 이미 채워진 칸을 다시 누르면 → 비우고(타일 반환) 그 칸 선택
  if (bd.cells[ci] != null) {
    spReturnTile(p, ci);
    bd.cells[ci] = null;
    spSelected[p] = ci;
    spRenderBoard(p);
    return;
  }
  spSelected[p] = (spSelected[p] === ci) ? -1 : ci;
  spRenderBoard(p);
}

function spReturnTile(p, ci) {
  const bd = spBoards[p];
  const val = bd.cells[ci];
  if (val == null) return;
  const tile = spPalettes[p].find(t => t.used && t.val === val && t.placedAt === ci);
  if (tile) { tile.used = false; tile.placedAt = undefined; }
}

function spHandleTileTap(p, ti) {
  if (spPhase !== 'active' || spSolved[p]) return;
  const sel = spSelected[p];
  if (sel < 0) return;
  const bd = spBoards[p];
  if (bd.given.has(sel) || bd.cells[sel] != null) return;
  const tile = spPalettes[p][ti];
  if (tile.used) return;
  bd.cells[sel] = tile.val;
  tile.used = true;
  tile.placedAt = sel;
  spSound.play('place');
  spSelected[p] = -1;
  spRenderBoard(p);

  if (spIsSolved(p)) {
    spHandleSolve(p);
  } else if (spJustSatisfiedRelation(p, sel)) {
    spSound.play('lineOk');
  }
}

// 모든 빈칸이 채워졌고 모든 합 관계가 성립하면 완성
function spIsSolved(p) {
  const bd = spBoards[p];
  const base = bd.base;
  const off = spOffsets(base);
  for (let i = 0; i < bd.cells.length; i++) if (bd.cells[i] == null) return false;
  for (let r = 0; r < base - 1; r++) {
    for (let c = 0; c <= r; c++) {
      const pv = bd.cells[spIdx(off, r, c)];
      const lv = bd.cells[spIdx(off, r + 1, c)];
      const rv = bd.cells[spIdx(off, r + 1, c + 1)];
      if (pv !== lv + rv) return false;
    }
  }
  return true;
}

function spJustSatisfiedRelation(p, ci) {
  const bd = spBoards[p];
  const base = bd.base;
  const off = spOffsets(base);
  for (let r = 0; r < base; r++) {
    for (let c = 0; c <= r; c++) {
      if (spIdx(off, r, c) !== ci) continue;
      if (r < base - 1) {
        const pv = bd.cells[ci], lv = bd.cells[spIdx(off, r + 1, c)], rv = bd.cells[spIdx(off, r + 1, c + 1)];
        if (pv != null && lv != null && rv != null && pv === lv + rv) return true;
      }
      if (r > 0) {
        for (let pc = Math.max(0, c - 1); pc <= Math.min(r - 1, c); pc++) {
          const parent = spIdx(off, r - 1, pc);
          const lci = spIdx(off, r, pc), rci = spIdx(off, r, pc + 1);
          const pv = bd.cells[parent], lv = bd.cells[lci], rv = bd.cells[rci];
          if (pv != null && lv != null && rv != null && pv === lv + rv) return true;
        }
      }
    }
  }
  return false;
}

// ── 존 빌드 ──
function spBuildZones() {
  spZonesWrap.innerHTML = '';
  spZonesWrap.className = `zones-wrap p${spPlayerCount}`;
  for (let i = 0; i < spPlayerCount; i++) {
    const cfg = SP_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-chips"><span class="zone-chip" id="sp-blanks-${i}">빈칸 ?</span></span>
      </div>
      <div class="sp-board-area"><div class="sp-board"></div></div>
      <div class="sp-palette"></div>`;
    spZonesWrap.appendChild(zone);
  }
}

// ── 라운드 종료 ──
function spHandleSolve(p) {
  if (spSolved[p]) return;
  spSolved[p] = true;
  const zone = spGetZone(p);
  if (zone) zone.classList.add('solved');
  if (spRoundFirstWinner === -1) {
    spRoundFirstWinner = p;
    spScores[p]++;
    spRenderBarScore(p);
    spSound.play('ding');
    spProblemStatus.textContent = `${SP_PLAYER_CONFIG[p].label} 완성! 🔺`;
    for (let i = 0; i < spPlayerCount; i++) {
      if (!spSolved[i]) { const z = spGetZone(i); if (z) z.classList.add('locked'); }
    }
    spPhase = 'done';
    spClearTimers();
    spNextHandle = setTimeout(() => spNextRound(), SP_RESULT_PAUSE_MS);
  }
}

function spHandleTimeout() {
  if (spPhase !== 'active') return;
  spPhase = 'done';
  spSound.play('timeout');
  for (let i = 0; i < spPlayerCount; i++) {
    if (!spSolved[i]) { const z = spGetZone(i); if (z) z.classList.add('locked'); }
  }
  if (spRoundFirstWinner === -1) spProblemStatus.textContent = '시간 초과! 다음 라운드로';
  spNextHandle = setTimeout(() => spNextRound(), SP_RESULT_PAUSE_MS);
}

// ── 점수 바 ──
function spBuildScoreBar() {
  spScoreBar.innerHTML = '';
  for (let i = 0; i < spPlayerCount; i++) {
    const cfg = SP_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="sp-bar-${i}">0</span>`;
    spScoreBar.appendChild(chip);
  }
}
function spRenderBarScore(idx) { const el = spEl(`sp-bar-${idx}`); if (el) el.textContent = spScores[idx]; }

// ── 타이머 ──
function spStartTimer(seconds) {
  spTimeRemaining = seconds;
  spProblemTimer.textContent = spTimeRemaining;
  spProblemTimer.classList.remove('urgent');
  spTimerHandle = setInterval(() => {
    spTimeRemaining--;
    spProblemTimer.textContent = spTimeRemaining;
    if (spTimeRemaining <= 10) { spProblemTimer.classList.add('urgent'); spSound.play('tick'); }
    if (spTimeRemaining <= 0) { spClearTimers(); spHandleTimeout(); }
  }, 1000);
}

// ── 게임 흐름 ──
function spLoadRound() {
  spPhase = 'active';
  spRoundFirstWinner = -1;
  const plan = SP_PLANS[spRoundIdx];
  spCurrentPuzzle = spMakePuzzle(plan);
  spBoards = [];
  spSolved = [];
  spSelected = [];
  spPalettes = [];

  for (let i = 0; i < spPlayerCount; i++) {
    const cells = spCurrentPuzzle.given.slice(); // 값 또는 null
    const givenSet = new Set();
    for (let ci = 0; ci < cells.length; ci++) if (cells[ci] != null) givenSet.add(ci);
    spBoards.push({
      cells,
      given: givenSet,
      sol: spCurrentPuzzle.sol,
      blankCells: spCurrentPuzzle.blankCells,
      base: spCurrentPuzzle.base,
    });
    spSolved.push(false);
    spSelected.push(-1);
    const tiles = spShuffle(spCurrentPuzzle.blankCells.map(ci => spCurrentPuzzle.sol[ci]))
      .map(v => ({ val: v, used: false, placedAt: undefined }));
    spPalettes.push(tiles);

    const zone = spGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    spRenderBoard(i);
    const chip = spEl(`sp-blanks-${i}`);
    if (chip) chip.textContent = `빈칸 ${spCurrentPuzzle.blankCells.length}개`;
  }

  spQuestionCounter.textContent = `${spRoundIdx + 1} / ${SP_TOTAL_ROUNDS}`;
  spProblemStatus.textContent = `빈칸을 채워 피라미드를 완성! (빈칸 ${spCurrentPuzzle.blankCells.length}개)`;
  spStartTimer(plan.time);
}

function spNextRound() {
  spRoundIdx++;
  if (spRoundIdx >= SP_TOTAL_ROUNDS) spShowResult();
  else spLoadRound();
}

function spStartGame() {
  spRoundIdx = 0;
  spScores = new Array(spPlayerCount).fill(0);
  spPhase = 'idle';
  spClearTimers();
  spBuildZones();
  spBuildScoreBar();
  spShowScreen(spGameScreen);
  spLoadRound();
}

function spShowResult() {
  spClearTimers();
  spPhase = 'idle';
  spSound.play('fanfare');
  const max = Math.max(...spScores);
  const winners = spScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    spResultTitle.textContent = '무승부!';
    spResultWinner.textContent = '아무도 먼저 완성하지 못했어요.';
  } else if (winners.length === 1) {
    spResultTitle.textContent = '게임 종료!';
    spResultWinner.textContent = `${SP_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => SP_PLAYER_CONFIG[w].label).join(', ');
    spResultTitle.textContent = '동점!';
    spResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  spTotalRow.innerHTML = '';
  for (let i = 0; i < spPlayerCount; i++) {
    const cfg = SP_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${spScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem">★</span>' : ''}`;
    spTotalRow.appendChild(chip);
  }
  spShowScreen(spResultScreen);
}

// ── 이벤트 바인딩 ──
setupPlayerSelect(function (n) { spPlayerCount = n; });
setupSoundToggle(spSound, spSoundToggleIntro);
onTap(spBackBtn, () => goHome());
onTap(spCloseBtn, () => { spClearTimers(); goHome(); });
onTap(spHomeBtn, () => goHome());
onTap(spRetryBtn, () => spStartCountdown(() => spStartGame()));
onTap(spPlayBtn, () => spStartCountdown(() => spStartGame()));
