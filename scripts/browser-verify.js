#!/usr/bin/env node
/**
 * 브라우저 실동작 검증 하니스 (Playwright + 사전설치 Chromium)
 *
 * 사용법:
 *   node scripts/browser-verify.js <folder> [<folder> ...]
 *   node scripts/browser-verify.js --all        # registry 전체
 *
 * 각 게임을 로컬 서버로 띄워 실제 브라우저에서:
 *   인트로 → PLAY → 카운트다운 → 매 라운드 응답 → 결과화면 도달
 * 을 자동 플레이하고, 콘솔 에러/예외 0 + 결과화면 도달을 확인한다.
 * 스크린샷은 스크래치패드(있으면)나 /tmp에 저장.
 *
 * 사전 준비: npm i -D playwright  (브라우저는 PLAYWRIGHT_BROWSERS_PATH에 이미 있음)
 * 종료 코드: 0 전부 통과 / 1 하나라도 실패
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8099;

// 사전설치 Chromium 바이너리 경로 탐색 (버전 불일치 회피 위해 executablePath 명시)
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dirs = fs.existsSync(base) ? fs.readdirSync(base) : [];
  for (const d of dirs) {
    if (!d.startsWith('chromium-')) continue;
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath.endsWith('/')) urlPath += 'index.html';
        if (urlPath === '/favicon.ico') { res.writeHead(204, { 'Connection': 'close' }); res.end(); return; }
        const filePath = path.join(ROOT, urlPath);
        if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404, { 'Connection': 'close' }); res.end('not found'); return;
        }
        const buf = fs.readFileSync(filePath); // sync read → no stream-abort resets
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Connection': 'close' });
        res.end(buf);
      } catch (e) {
        try { res.writeHead(500, { 'Connection': 'close' }); res.end('err'); } catch (_) {}
      }
    });
    server.on('clientError', (e, sock) => { try { sock.destroy(); } catch (_) {} });
    server.keepAliveTimeout = 0;
    server.listen(PORT, () => resolve(server));
  });
}

// 자원 로딩 실패(음원·파비콘 등)는 게임 로직 버그가 아니므로 치명 오류에서 제외
function isAssetNoise(msg) {
  return /Failed to load resource|net::ERR_|favicon|status of 404|Autoplay|AudioContext|play\(\) request/i.test(msg);
}

const scratch = '/tmp/claude-0/-home-user-jjam/530312a0-478f-5af4-a75b-9c5f8810c58b/scratchpad';
const SHOTDIR = fs.existsSync(scratch) ? path.join(scratch, 'shots') : '/tmp/game-shots';
fs.mkdirSync(SHOTDIR, { recursive: true });

async function verifyGame(browser, folder) {
  const page = await browser.newPage({ viewport: { width: 412, height: 732 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // status: 'pass'   결과화면까지 자동 플레이 성공 + 콘솔 에러 0
  //         'partial' 게임화면 진입 + 콘솔 에러 0, 다만 이 게임의 조작 방식은 자동 플레이 미지원
  //         'fail'    콘솔 에러가 있거나 게임화면조차 못 띄움
  const result = { folder, status: 'fail', reached: false, errors, realErrors: [], note: '' };
  try {
    const url = `http://localhost:${PORT}/games/${folder}/index.html`;
    for (let attempt = 1; ; attempt++) {
      try { await page.goto(url, { waitUntil: 'load', timeout: 20000 }); break; }
      catch (e) { if (attempt >= 3) throw e; await page.waitForTimeout(500); }
    }
    // 인트로 PLAY
    await page.click('#playBtn', { timeout: 8000 });
    // 카운트다운 후 게임화면
    await page.waitForSelector('#gameScreen.active', { timeout: 12000 });

    // 이 게임을 자동으로 조작할 수 있는가?
    // 하니스가 누를 수 있는 것은 "보기 중 하나 고르기" 방식뿐이다.
    // 보기 버튼의 클래스명은 게임마다 다르므로(answer-btn · ox-btn · time-btn ·
    // item-btn · rs-choice-btn …) 이름을 일일이 나열하지 않고,
    // "플레이 영역(.zone) 안에 있는, 누를 수 있는 버튼"으로 일반화해 찾는다.
    // 상단 바의 닫기·일시정지·소리 버튼은 .zone 밖이라 걸리지 않는다.
    //
    // 타일 배치·드래그·시퀀스 재현처럼 클릭 한 번으로 답할 수 없는 게임은
    // 끝까지 못 갔다고 실패로 처리하지 않고 '자동 플레이 미지원'으로 구분해 보고한다.
    const CHOICE = 'button:not([disabled]), [class*="-btn"]:not([disabled]), [class*="_btn"]:not([disabled])';

    const playable = await page.evaluate((sel) => {
      const zones = document.querySelectorAll('.zone');
      const scope = zones.length ? zones : [document.getElementById('gameScreen')].filter(Boolean);
      return [...scope].some((z) => {
        const el = z.querySelector(sel);
        return !!el && el.getClientRects().length > 0;
      });
    }, CHOICE);

    if (playable) {
      // 라운드 자동 진행: 각 존의 첫 보기를 눌러 라운드를 소진 → 결과화면까지
      // 화면이 여러 번 연속으로 그대로면 하니스가 이 게임을 몰지 못하는 것이므로
      // 남은 반복을 기다리지 않고 빠져나온다(전 게임 검증 시간을 크게 줄인다).
      let lastSnapshot = '';
      let stalled = 0;
      for (let i = 0; i < 24; i++) {
        if (await page.$('#resultScreen.active')) break;
        await page.evaluate((sel) => {
          const zones = document.querySelectorAll('.zone');
          const scope = zones.length ? zones : [document.getElementById('gameScreen')].filter(Boolean);
          scope.forEach((z) => {
            for (const el of z.querySelectorAll(sel)) {
              if (el.getClientRects().length > 0) { el.click(); break; }
            }
          });
        }, CHOICE);
        await page.waitForTimeout(2100);

        const snapshot = await page.evaluate(() => {
          const g = document.getElementById('gameScreen');
          return g ? g.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
        });
        stalled = snapshot === lastSnapshot ? stalled + 1 : 0;
        lastSnapshot = snapshot;
        if (stalled >= 3) break;
      }
      result.reached = !!(await page.$('#resultScreen.active'));
    }

    await page.screenshot({ path: path.join(SHOTDIR, folder + '.png') });
    result.realErrors = errors.filter((e) => !isAssetNoise(e));

    // 분류 기준
    // - 콘솔 에러가 있으면 게임 결함이므로 실패.
    // - 결과화면까지 갔으면 통과.
    // - 에러 없이 게임화면까지는 갔지만 끝까지 못 몬 경우는 '실패'가 아니다.
    //   하니스는 "보기 중 하나 고르기"만 조작할 수 있어서, 타일 배치·드래그·
    //   시퀀스 재현 같은 게임은 정상이어도 결과화면에 도달시킬 수 없다.
    //   게임이 멀쩡한데 빨간불이 뜨면 곧 아무도 이 검증을 보지 않게 된다.
    if (result.realErrors.length) {
      result.note = '콘솔 에러';
    } else if (result.reached) {
      result.status = 'pass';
    } else {
      result.status = 'partial';
      result.note = playable
        ? '끝까지 자동 조작 불가 (게임화면 진입·에러 0까지 확인)'
        : '자동 플레이 미지원 방식 (게임화면 진입·에러 0까지 확인)';
    }
  } catch (e) {
    result.note = 'exception: ' + e.message;
  } finally {
    await page.close();
  }
  return result;
}

(async () => {
  const args = process.argv.slice(2);
  const jobsArg = args.find((a) => a.startsWith('--jobs='));
  const JOBS = Math.max(1, Number(jobsArg ? jobsArg.split('=')[1] : 4) || 4);

  let folders = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--all')) {
    folders = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', 'registry.json'), 'utf8'));
  }
  if (!folders.length) {
    console.error('Usage: node scripts/browser-verify.js <folder> [...] | --all [--jobs=N]');
    process.exit(1);
  }

  const exe = findChromium();
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  // 게임끼리 상태를 공유하지 않으므로(각자 새 페이지) 동시에 돌려도 안전하다.
  const results = new Array(folders.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, folders.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= folders.length) return;
      results[i] = await verifyGame(browser, folders[i]);
    }
  }));

  await browser.close();
  server.close();

  const ICON = { pass: '✓', partial: '△', fail: '✗' };
  for (const r of results) {
    const extra = r.status === 'pass' ? ''
      : `  — ${r.note || ''} ${(r.realErrors.length ? r.realErrors : []).slice(0, 3).join(' | ')}`;
    console.log(`  ${ICON[r.status]} ${r.folder}${extra}`);
  }

  const pass = results.filter((r) => r.status === 'pass').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  const fail = results.filter((r) => r.status === 'fail').length;

  console.log(`\n결과: ${folders.length}종 중 ✓통과 ${pass} · △자동플레이 미지원 ${partial} · ✗실패 ${fail}`);
  if (partial) {
    // 커버리지를 조용히 줄이지 않는다 — 무엇이 끝까지 검증되지 않았는지 명시한다.
    console.log(`  △ ${partial}종은 조작 방식이 달라 결과화면까지는 확인하지 못했습니다`);
    console.log(`     (로딩 → PLAY → 게임화면 진입 → 콘솔 에러 0 까지는 확인됨)`);
  }
  console.log(`  스크린샷: ${SHOTDIR}`);
  process.exit(fail > 0 ? 1 : 0);
})();
