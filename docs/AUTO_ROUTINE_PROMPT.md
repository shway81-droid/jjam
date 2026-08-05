# 데스크톱 루틴 프롬프트 (붙여넣기용)

> Claude 데스크톱 앱 → 루틴(예약 작업)에 아래 블록을 그대로 붙여넣는다.
> 스케줄: **매일 10:00 KST**. 상세 절차는 저장소의 `docs/AUTO_MODE.md`에 있다.
> (이 짧은 프롬프트는 트리거 + 불변식만 담고, 절차 본문은 AUTO_MODE.md를 참조한다.)

---

```text
[자동 게임 추가 - 매일 10시 KST · 하루 목표 4개]

작업 디렉토리: C:/Users/User/Desktop/claude
저장소: shway81-droid/jjam
대상 브랜치: main  (★ PR 만들지 말고 main에 직접 커밋·푸시)

저장소 `docs/AUTO_MODE.md`의 절차를 정확히 따라 새 게임을 자동으로 추가하라.
골든 템플릿은 `docs/PATTERNS.md`, 후보 제외 기준은 `docs/GAME_ANTIPATTERNS.md`(0절)
+ `docs/SELECTION.md`(삭제 1·2·3차) + 현재 registry를 읽어 적용한다.
폴더명이 달라도 같은 메커니즘이면 제외. 완전 자동 모드 — 사용자 승인 없음.

## 순서
1) `node scripts/auto-add-game-helpers.js preflight` 로 시작.
   blockedForToday → 종료, alreadyComplete → 종료, 아니면 pendingGames 개수만큼 제작.
2) `node scripts/auto-add-game-helpers.js stats` 로 카테고리 분포 확인 →
   가장 적은 카테고리부터 서로 다른 게임을 선택(직전/오늘 푸시와 다른 카테고리 우선).
3) 각 게임: 골든 템플릿을 복사해 4파일(game.json·index.html·style.css·game.js) 작성
   → games/registry.json 에 폴더명 추가 → `npm run gen`.
4) 검증(모두 통과 필수): `node scripts/verify-game.js {folder}` 전부 PASS + `npm test`.
   브라우저 도구(Preview MCP)가 있으면 인트로→게임→결과 자동 플레이(콘솔 에러 0).
   없으면 정적 검증까지만 하고 그 사실을 커밋/로그에 남긴다.
   실패하면 고치고, 끝내 안 되면 그 후보는 discard 하고 다른 후보로 교체.
5) 통과한 게임은 즉시 main에 커밋·푸시:
     git add games/{folder}/ games/registry.json index.html shared/engine.js
     git commit -m "Auto-add: {이름} ({카테고리}, 패턴 {A|B|C|D})"
     git push origin main
   (네트워크 실패 시 2s·4s·8s·16s 백오프로 최대 4회 재시도)

## 반드시 지킬 불변식
- 하루 목표 4개. 종료 직전 `node scripts/auto-add-game-helpers.js today-pushed-count`
  로 재확인 — 4개 미만이고 blockedForToday 아니면 다음 게임 계속(절대 조기 종료 금지).
- `git pull origin main` 실패 시 그날 중단.
- 결과는 항상 **main에 직접 푸시**한다. PR(드래프트 포함) 생성으로 대체 금지.
- 커밋 제목은 반드시 "Auto-add:" 로 시작 (헬퍼가 이 프리픽스로 진행도 집계).
- 게임 풀: 제작 전 .claude/game-pool.json에 후보를 만든다(가장 적은 카테고리 우선).
  목표 크기 20개 — 후보가 10개 이하로 줄면 소진되기 전에 미리 20개까지 선제 보충(top-up)해
  풀이 절대 0이 되지 않게 한다. 균등은 강제 안 함(포화 시 콘텐츠형으로 채워 20개 유지),
  삭제·금지된 게임은 재생성 금지.
- 등록은 game.json 작성 후 `npm run gen` 한 번 (파생 메타 수동 편집 없음).
- shared/style.css 수정 금지. 디자인 새로 만들지 말 것(골든 템플릿 그대로).
- 실패 시 `node scripts/auto-add-game-helpers.js discard {folder}` 로 폐기,
  recent-failures 가 3회면 그날 중단.
- 사용자가 중간에 질문해도 pendingGames가 0이 될 때까지 멈추지 말 것(짧게 답하고 즉시 재개).

## 종료
별도 메시지 없이 작업 끝. 결과는 git 커밋 로그로만 확인.
성공: `git log --oneline | grep Auto-add` 오늘 자 4건.
일부 성공: 4건 미만 (다음날 preflight가 모자란 수만큼 pendingGames로 자동 보강).
```

---

## 전제 확인 (최초 1회)

이 프롬프트는 작업 디렉토리가 **`shway81-droid/jjam`을 `main`으로 클론한 것**이라고 가정한다.
데스크톱에서 한 번만 확인:

```bash
git remote -v      # → shway81-droid/jjam 이어야 함
git branch         # → main 추적
```

전작(`jjamjjami-gyosil`)이나 `master` 기반이면 이 루틴은 맞지 않는다 — 디렉토리를 jjam으로 교체할 것.
