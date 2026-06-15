#!/usr/bin/env node
/**
 * 파생 메타데이터 생성기 — game.json을 단일 소스로 삼아 아래 세 가지를 자동 생성한다.
 *   - shared/engine.js  : _GAME_CATEGORY_MAP (게임 페이지 BGM 카테고리 감지용, @generated 마커)
 *   - index.html        : FALLBACK_GAMES (meta.json fetch 실패 시 오프라인 폴백, @generated 마커)
 *   - games/meta.json   : 전 게임 메타 통합본 (런처가 런타임에 1요청으로 받음, 마커 없는 전체 파일)
 *
 * 마커 있는 두 블록은 @generated:NAME … @end:NAME 사이를, meta.json은 파일 전체를 덮어쓴다.
 *
 * 사용법:
 *   node scripts/gen-metadata.js            # 생성(파일 갱신)
 *   node scripts/gen-metadata.js --check    # 동기화 검사만 (CI용, 불일치 시 exit 1)
 *
 * 게임 추가/카테고리 변경 시: game.json만 고치고 `npm run gen` 한 번 실행하면 끝.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', 'registry.json'), 'utf-8'));
const games = registry.map(folder => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', folder, 'game.json'), 'utf-8'));
  return Object.assign({ folder }, j);
});

// ── 생성 블록 1: engine.js _GAME_CATEGORY_MAP ──
const categoryBlock =
  'const _GAME_CATEGORY_MAP = {\n' +
  games.map(g => `  '${g.folder}': '${g.category}',`).join('\n') +
  '\n};';

// ── 생성 블록 2: index.html FALLBACK_GAMES (4칸 들여쓰기) ──
const fallbackBlock =
  '    var FALLBACK_GAMES = [\n' +
  games.map(g => {
    const obj = {
      folder: g.folder, name: g.name, description: g.description,
      icon: g.icon, color: g.color, grades: g.grades,
      playTime: g.playTime, category: g.category, players: g.players
    };
    return '      ' + JSON.stringify(obj) + ',';
  }).join('\n') +
  '\n    ];';

// ── 생성 블록 3: games/meta.json (런처가 런타임에 1요청으로 받는 전 게임 메타 통합본) ──
//    런처는 과거 game.json을 게임 수만큼 개별 fetch했으나, 이 파일 하나로 합쳐 요청 수를 79→2로 줄인다.
const metaJson =
  '[\n' +
  games.map(g => JSON.stringify({
    folder: g.folder, name: g.name, description: g.description,
    icon: g.icon, color: g.color, grades: g.grades,
    playTime: g.playTime, category: g.category, players: g.players
  })).join(',\n') +
  '\n]\n';

function spliceBlock(content, name, generated) {
  // @generated:NAME …(임의 텍스트)… */\n  <중간>  \n  /* @end:NAME */
  const re = new RegExp(
    `(/\\* @generated:${name}[^\\n]*\\*/\\n)[\\s\\S]*?(\\n[ \\t]*/\\* @end:${name} \\*/)`
  );
  if (!re.test(content)) {
    throw new Error(`마커를 찾을 수 없음: @generated:${name} … @end:${name}`);
  }
  return content.replace(re, `$1${generated}$2`);
}

const targets = [
  { file: 'shared/engine.js', name: 'category-map', block: categoryBlock },
  { file: 'index.html', name: 'fallback', block: fallbackBlock },
];

let drift = false;
for (const t of targets) {
  const p = path.join(ROOT, t.file);
  const before = fs.readFileSync(p, 'utf-8');
  const after = spliceBlock(before, t.name, t.block);
  if (before === after) {
    console.log(`  = ${t.file} (${t.name}) 동기화됨`);
    continue;
  }
  if (CHECK) {
    drift = true;
    console.log(`  ✗ ${t.file} (${t.name}) 가 game.json과 불일치 — \`npm run gen\` 실행 필요`);
  } else {
    fs.writeFileSync(p, after);
    console.log(`  ↻ ${t.file} (${t.name}) 갱신`);
  }
}

// games/meta.json — 마커 없는 전체 파일 생성 (런처 런타임 fetch용)
{
  const p = path.join(ROOT, 'games', 'meta.json');
  const before = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
  if (before === metaJson) {
    console.log('  = games/meta.json 동기화됨');
  } else if (CHECK) {
    drift = true;
    console.log('  ✗ games/meta.json 가 game.json과 불일치 — `npm run gen` 실행 필요');
  } else {
    fs.writeFileSync(p, metaJson);
    console.log('  ↻ games/meta.json 갱신');
  }
}

if (CHECK && drift) {
  console.error('\n❌ 파생 메타데이터가 game.json과 어긋남. `npm run gen` 후 커밋하세요.');
  process.exit(1);
}
console.log(CHECK ? '✅ 파생 메타데이터 동기화 확인' : '✅ 생성 완료');
