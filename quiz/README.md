# 🧠 짬짬이 퀴즈

**전자칠판으로 즐기는 자투리 시간 초등 문답형 미니게임 100종.**
설치도 로그인도 없이 브라우저에서 바로 시작하고, 인터넷이 끊겨도 동작합니다.

[짬짬이 교실](https://shway81-droid.github.io/jjam/)에서 **"문제 → 보기 중 정답 고르기"** 형식의
문답형 게임만 가려 뽑아, 퀴즈에 집중한 자매 버전입니다. 런처·디자인·조작은 짬짬이 교실과 동일합니다.

## ✨ 주요 기능

- **🎲 퀴즈 고르기, 쉽고 빠르게** — 큼직한 게임 카드 그리드 + "룰렛으로 골라줘" 버튼 + 카테고리 필터 + ⭐ 즐겨찾기. 룰렛은 카테고리 필터를 켜 둔 상태면 그 안에서만 뽑습니다.
- **🙋 학생 뽑기** — 번호만 입력해 발표·순서를 정하는 추첨기. 한 번 뽑힌 번호는 다시 안 나오고(비복원), 전원이 다 뽑히면 자동으로 리셋됩니다. *이름 없이 번호만 쓰므로 개인정보 걱정이 없습니다.*
- **🔊 교실 환경 최적화** — 1280·1920px 대화면에서 글씨·버튼이 자동으로 커지고, 조작 요소는 학생 손이 닿는 화면 아래쪽에 배치됩니다. 교실 스피커를 전제로 **소리 기본 ON**.
- **📴 오프라인 동작** — PWA + 서비스 워커로 한 번 열어 두면 인터넷 없이도 플레이됩니다(학교 크롬북·태블릿).

## 짬짬이 교실과의 관계

| 항목 | 짬짬이 교실 (jjam) | 짬짬이 퀴즈 (이 버전) |
|---|---|---|
| 성격 | 반응·두뇌·퍼즐·협력 등 전 장르 | **문답형(퀴즈) 게임만** |
| 게임 수 | 201종 | **100종** |
| 선별 기준 | — | "문제 제시 → 보기 중 정답 선택" 형식 |
| 런처·디자인·엔진 | — | **동일** (그대로 계승) |

## 게임 100종 (카테고리 분포)

⚡반응속도 4 · 🧠두뇌 5 · 📐수학 5 · 📚지식 78 · 🤝협력 4 · 🧩퍼즐 4

지식 문답형 78종을 모두 담고, 나머지 다섯 카테고리에서 대표 문답형 게임을 4~5종씩 고르게 추렸습니다.

## 구조 (개발자용)

```
index.html          # 런처 (룰렛·학생 뽑기·즐겨찾기·게임 그리드)
shared/style.css    # 공통 스타일 + 보드게임 테마 레이어
shared/engine.js    # 타이머·점수판·Web Audio 효과음/배경음악·onTap
games/<폴더>/        # 게임별 game.json + index.html + style.css + game.js
games/registry.json # 게임 목록
games/meta.json     # 전 게임 메타 통합본 (런처가 1요청으로 받음, gen-metadata 생성)
sw.js               # 오프라인 서비스 워커
scripts/verify-game.js  # 게임 1개 정적 검증 (node scripts/verify-game.js <폴더>)
scripts/verify-all.js   # 전 게임 일괄 검증 + registry 정합성 (npm test)
scripts/gen-metadata.js # game.json → 파생 메타 생성 (npm run gen)
```

### 메타데이터 단일 소스

게임의 `category`·`players`는 **`game.json`에만** 둔다. 런처의 `FALLBACK_GAMES`·`engine.js`의
`_GAME_CATEGORY_MAP`·`games/meta.json`은 `scripts/gen-metadata.js`가 자동 생성한다.
게임을 추가·수정하면:

```
npm run gen   # 파생 메타 재생성 (engine.js / index.html / games/meta.json)
npm test      # 동기화 확인(gen --check) + 전 게임 정적 검증 (CI와 동일)
```

## 로컬 실행

```
python -m http.server 8000
# http://localhost:8000
```
