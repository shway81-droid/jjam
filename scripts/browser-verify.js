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

  const result = { folder, ok: false, reached: false, errors, realErrors: [], note: '' };
  try {
    await page.goto(`http://localhost:${PORT}/games/${folder}/index.html`, { waitUntil: 'load', timeout: 15000 });
    // 인트로 PLAY
    await page.click('#playBtn', { timeout: 8000 });
    // 카운트다운 후 게임화면
    await page.waitForSelector('#gameScreen.active', { timeout: 12000 });

    // 라운드 자동 진행: 각 존의 첫 버튼을 눌러 라운드를 소진 → 결과화면까지
    for (let i = 0; i < 24; i++) {
      const done = await page.$('#resultScreen.active');
      if (done) break;
      await page.evaluate(() => {
        document.querySelectorAll('.zone').forEach((z) => {
          const btn = z.querySelector('.answer-btn:not([disabled])');
          if (btn) btn.click();
        });
      });
      await page.waitForTimeout(2100);
    }
    result.reached = !!(await page.$('#resultScreen.active'));
    await page.screenshot({ path: path.join(SHOTDIR, folder + '.png') });
    result.realErrors = errors.filter((e) => !isAssetNoise(e));
    result.ok = result.reached && result.realErrors.length === 0;
    if (!result.reached) result.note = '결과화면 미도달';
  } catch (e) {
    result.note = 'exception: ' + e.message;
  } finally {
    await page.close();
  }
  return result;
}

(async () => {
  let folders = process.argv.slice(2);
  if (folders[0] === '--all') {
    folders = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', 'registry.json'), 'utf8'));
  }
  if (!folders.length) { console.error('Usage: node scripts/browser-verify.js <folder> [...] | --all'); process.exit(1); }

  const exe = findChromium();
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  let pass = 0, fail = 0;
  for (const f of folders) {
    const r = await verifyGame(browser, f);
    const icon = r.ok ? '✓' : '✗';
    const extra = r.ok ? '' : `  — ${r.note || ''} ${(r.realErrors.length ? r.realErrors : r.errors).slice(0, 3).join(' | ')}`;
    console.log(`  ${icon} ${f}${extra}`);
    if (r.ok) pass++; else fail++;
  }
  await browser.close();
  server.close();

  console.log(`\n결과: ${pass}/${folders.length} 통과  (스크린샷: ${SHOTDIR})`);
  process.exit(fail > 0 ? 1 : 0);
})();
