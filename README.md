# tistory-blog-skill

티스토리 관리자 세션을 사용해 블로그 운영을 자동화하는 CLI 스킬입니다. OpenClaw, Codex, Claude Code처럼 로컬 명령을 실행할 수 있는 에이전트에서 사용할 수 있습니다.

서버를 상시 실행하지 않습니다. 명령을 실행할 때만 Node 프로세스가 뜨고, 작업이 끝나면 종료됩니다.

## 기능

- 세션 로그인/확인/삭제
- 블로그 메타 조회
- 카테고리 조회/수정
- 글/페이지 검색, 조회, 생성, 수정, 삭제
- 이미지 업로드 및 티스토리 이미지 치환자 생성
- 스킨 가져오기, 현재 스킨 조회, 검증, 프리뷰, 적용, 설정 변경
- 로그인 세션을 포함한 스크린샷 캡처

## 요구 사항

- Node.js 18 이상
- npm (설치/빌드 시 필요. 일부 Codex Windows 번들 Node에는 npm이 없을 수 있습니다.)
- Chromium 실행이 가능한 데스크톱 환경
- OS 자격증명 저장소
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service/libsecret 계열 환경

GitHub에서 막 복사/클론한 직후에는 `node_modules/`와 `dist/`가 없어서 CLI를 바로 실행할 수 없습니다. 첫 사용 전 반드시 `node scripts/check-ready.mjs --fix`(또는 `npm run setup`)로 의존성 설치와 빌드를 끝내야 합니다. 단, 사용할 때마다 `npm install`/`npm run build`를 반복하지 않습니다.

Windows/Codex 환경에서 `node`는 있지만 `npm`이 없으면 Node.js 공식 설치본 또는 휴대용 Node.js를 준비하고, 그 Node/npm 경로를 `PATH` 앞에 두거나 `TISTORY_BLOG_NODE` 환경변수로 사용할 Node 실행 파일을 지정하세요.

## 설치

### Codex/macOS 또는 일반 CLI에서 설치

```bash
git clone https://github.com/Rafe-Giho/tistory-blog-skill.git
cd tistory-blog-skill
node scripts/check-ready.mjs --fix
```

Codex에서 작업 디렉터리가 이미 이 저장소라면 `git clone` 없이 저장소 루트에서 `node scripts/check-ready.mjs --fix`부터 실행하세요.

### OpenClaw 스킬로 설치

```bash
mkdir -p ~/.openclaw/skills
cd ~/.openclaw/skills
git clone https://github.com/Rafe-Giho/tistory-blog-skill.git tistory-blog
cd tistory-blog
node scripts/check-ready.mjs --fix
```

PowerShell/Windows에서는 포함된 `.cmd` 래퍼를 사용할 수 있습니다.

```powershell
# 필요하면 사용할 Node를 명시
$env:TISTORY_BLOG_NODE = "C:\path\to\node.exe"

scripts\check-ready.cmd --fix
scripts\connect.cmd --blog https://example.tistory.com/
scripts\tistory-blog.cmd meta --blog https://example.tistory.com/ --json
```

`TISTORY_BLOG_NODE`가 없으면 래퍼는 `PATH`의 `node`를 사용합니다.

`--fix`는 명시적으로 허용했을 때만 `npm install`과 `npm run build`를 수행합니다. 새 클론에서는 이 단계가 사실상 필수입니다.

## 블로그 연결

대화형 연결:

```bash
node scripts/connect.mjs
# Windows: scripts\connect.cmd
```

블로그 주소를 바로 지정:

```bash
node scripts/connect.mjs --blog https://example.tistory.com/
```

준비 상태 복구까지 함께 허용:

```bash
node scripts/connect.mjs --blog https://example.tistory.com/ --fix
```

연결 과정:

1. 의존성/빌드 준비 상태를 확인합니다. 첫 로그인 전에는 저장 세션이 없어도 실패로 보지 않습니다.
2. 연결할 티스토리 블로그 주소를 입력합니다.
3. 브라우저 창이 열립니다.
4. 사용자가 직접 카카오/티스토리 로그인과 2FA를 완료합니다.
5. 로그인 성공 후 세션 쿠키가 OS 자격증명 저장소에 저장됩니다.

비밀번호나 카카오 계정 정보는 저장하지 않습니다.

수동 연결도 가능합니다.

```bash
node scripts/tistory-blog.mjs session init --blog https://example.tistory.com/ --json
node scripts/tistory-blog.mjs session check --blog https://example.tistory.com/ --json
```

## 준비 상태 점검

```bash
node scripts/check-ready.mjs --blog https://example.tistory.com/
```

점검 항목:

- Node.js 18 이상 여부
- npm 의존성 설치 여부
- `dist/` 빌드 산출물 존재 여부
- `src/` 대비 `dist/` 최신 여부
- 선택한 블로그의 저장 세션 여부

새 클론이거나 문제가 있을 때만 명시적으로 복구합니다. 새 클론에서는 이 단계 없이는 `scripts/tistory-blog.mjs`가 `dist/` 모듈을 찾지 못해 실패합니다.

```bash
node scripts/check-ready.mjs --fix
# 또는
npm run setup
```

## 기본 사용법

도움말:

```bash
node scripts/tistory-blog.mjs help
```

메타 조회:

```bash
node scripts/tistory-blog.mjs meta --blog https://example.tistory.com/ --json
```

카테고리 조회:

```bash
node scripts/tistory-blog.mjs categories get --blog https://example.tistory.com/ --json
```

글 검색:

```bash
node scripts/tistory-blog.mjs post search \
  --blog https://example.tistory.com/ \
  --query "검색어" \
  --type title \
  --visibility all \
  --json
```

정확한 제목 일치만 필요하면 `--exact-title`을 추가합니다.

```bash
node scripts/tistory-blog.mjs post search \
  --blog https://example.tistory.com/ \
  --query "정확한 제목" \
  --type title \
  --exact-title \
  --json
```

비공개 글 생성:

```bash
node scripts/tistory-blog.mjs post publish \
  --blog https://example.tistory.com/ \
  --title "제목" \
  --content-file body.html \
  --visibility private \
  --yes \
  --json
```

공개 발행:

```bash
node scripts/tistory-blog.mjs post publish \
  --blog https://example.tistory.com/ \
  --title "제목" \
  --content-file body.html \
  --visibility public \
  --published \
  --yes \
  --yes-public \
  --json
```

이미지 업로드:

```bash
node scripts/tistory-blog.mjs image upload --blog https://example.tistory.com/ --file image.png --json
```

스킨 검증:

```bash
node scripts/tistory-blog.mjs skin validate --html skin.html --css style.css --json
```

## 안전 정책

읽기 작업은 세션 연결 후 바로 수행할 수 있습니다.

- `session check`
- `meta`
- `categories get`
- `post search`
- `post fetch`
- `skin get`
- `skin current`
- `skin preview`
- `skin validate`
- `screenshot`

쓰기/위험 작업은 명시 플래그가 없으면 거부됩니다.

- 글 생성: `--yes` 필요
- 공개 발행: `--yes --yes-public` 필요
- 글 수정: `--yes` 필요
- 글 삭제: `--yes-delete` 필요
- 카테고리 수정: `--yes` 필요
- 스킨 적용/설정 변경: `--yes` 필요

에이전트가 사용할 때는 공개 발행, 삭제, 스킨 변경 전에 사용자 확인을 받아야 합니다.

## 에이전트 연결 가이드

### OpenClaw

이 저장소를 `~/.openclaw/skills/tistory-blog`에 두면 OpenClaw가 `SKILL.md`를 읽고 사용할 수 있습니다.

```bash
cd ~/.openclaw/skills/tistory-blog
node scripts/check-ready.mjs --blog https://example.tistory.com/
```

### Codex / Claude Code

저장소를 작업 폴더로 열고 CLI 명령을 실행하면 됩니다.

```bash
node scripts/tistory-blog.mjs post search --blog https://example.tistory.com/ --json
```

에이전트에게는 다음 원칙을 함께 지시하는 것을 권장합니다.

> `scripts/tistory-blog.mjs`를 사용하고, 공개 발행·삭제·스킨 변경 전에는 반드시 사용자 확인을 받아라.

## 개발

소스 수정 후에는 빌드합니다.

```bash
npm run build
```

검증:

```bash
node scripts/check-ready.mjs --blog https://example.tistory.com/
node scripts/tistory-blog.mjs skin validate --html templates/default/skin.html --css templates/default/style.css --json
```

## Windows/Codex 참고

- 경로 계산은 Windows 드라이브 경로를 안전하게 처리하도록 `fileURLToPath(import.meta.url)` 기반으로 되어 있습니다.
- 내부 Node 재호출은 `node` 문자열 대신 현재 실행 중인 `process.execPath`를 사용합니다.
- Codex Windows 환경은 Node만 있고 npm이 없을 수 있습니다. 이 경우 설치/빌드는 별도 Node/npm을 준비한 뒤 실행하세요.
- `keytar`는 Windows Credential Manager에 세션을 저장합니다. Codex 샌드박스/권한 컨텍스트에 따라 일반 실행과 승인/elevated 실행에서 Credential Manager 접근 결과가 다를 수 있습니다. 세션 확인이 한쪽에서만 성공하면 같은 권한 컨텍스트로 로그인과 실행을 맞추세요.
- `npm ci`/`npm install` 중 `keytar` lifecycle script가 `npm`을 다시 찾을 수 있으므로, Windows에서는 Node 디렉터리와 `node_modules\npm\bin`을 `PATH` 앞에 두는 것이 안전합니다.

## 주의 사항

- 티스토리 관리자 내부 API를 사용하므로 티스토리 UI/API 변경 시 수정이 필요할 수 있습니다.
- 로그인 세션은 사용자별/환경별로 따로 연결해야 합니다.
- 기본 JSON 출력은 `cookieHeader`, 비밀번호, 토큰류 필드를 마스킹합니다.
- `node_modules/`와 로그인 쿠키는 Git에 포함하지 않습니다.
- 공개 발행, 삭제, 스킨 변경은 신중하게 수행해야 합니다.
- `post publish` 결과는 숫자 관리자 ID를 확인한 경우에만 `postId`를 반환합니다. URL이 slug 기반이면 `entrySlug`/`slogan`을 반환합니다.
