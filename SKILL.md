---
name: tistory-blog
description: Native OpenClaw skill for Tistory blog operations after the official Tistory Open API shutdown. Uses Tistory admin/session APIs through a short-lived CLI helper. Supports cross-platform session storage via OS credential stores, metadata/category lookup, post search/fetch/create/update/delete, image upload, skin/theme tooling, screenshots, and Dooray/Notion-to-blog workflows with approval gates for risky writes.
---

# Tistory Blog

Use this skill for Tistory blog management from Codex, OpenClaw, or other local-agent shells through `scripts/tistory-blog.mjs`.

This is a Node/TypeScript-backed CLI skill. It is not a long-running server: each command starts a short-lived Node process and exits.

## Setup and readiness

A fresh GitHub clone is **not runnable yet**: `node_modules/` and `dist/` are intentionally absent until setup. In Codex/macOS, clone or open the repository, then run the setup check from that repository root before any blog command:

```bash
cd /path/to/tistory-blog-skill
node scripts/check-ready.mjs --fix
# or: npm run setup
```

After setup, check local readiness and session state:

```bash
node scripts/check-ready.mjs --blog <blog.tistory.com>
```

Normal use does **not** require `npm install` or `npm run build` every time. They are only needed when setting up a new environment, changing dependencies, or editing TypeScript source. The readiness script checks Node version, npm dependencies, `dist/` build output, build freshness, and optionally stored Tistory session state. It only runs install/build when `--fix` is explicitly passed. `connect.mjs` checks dependencies/build before first login but does not require an existing stored session before opening the login window.

## Windows/Codex runtime notes

On Windows or Codex shells, prefer the included `.cmd` wrappers when PATH is unreliable:

```bat
scripts\check-ready.cmd --fix
scripts\connect.cmd --blog https://<blog>.tistory.com/
scripts\tistory-blog.cmd meta --blog https://<blog>.tistory.com/ --json
```

Set `TISTORY_BLOG_NODE=C:\path\to\node.exe` when the shell has a bundled Node but no npm, or when `node` resolves to a WindowsApps stub. Install/build still requires npm; if Codex provides Node without npm, use an official or portable Node.js distribution and put its `npm.cmd` on PATH before running setup.

Credential Manager access can differ by Windows sandbox/elevation context. Run `connect`, `session check`, and later blog commands in the same context when possible; if a session is visible only in approved/elevated execution, keep using that context for session-backed commands.

## Cross-platform session storage

The helper stores login session cookies through `keytar`, which uses the OS credential store:

- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service/libsecret-compatible credential store

The helper stores session cookies only. It does not ask for or store Kakao/Tistory passwords.

## Connect a blog

Preferred interactive flow:

```bash
node scripts/connect.mjs
# Windows: scripts\connect.cmd
```

Or specify the blog URL directly:

```bash
node scripts/connect.mjs --blog https://<blog>.tistory.com/
# Windows: scripts\connect.cmd --blog https://<blog>.tistory.com/
```

This opens a headed Chromium window. The user completes Kakao/Tistory login and 2FA directly in the browser. After login reaches the Tistory admin page, session cookies are stored in the OS credential store.

Manual session commands:

```bash
node scripts/tistory-blog.mjs session init --blog <blog.tistory.com> --json
node scripts/tistory-blog.mjs session check --blog <blog.tistory.com> --json
node scripts/tistory-blog.mjs session clear --blog <blog.tistory.com> --json
```

## Safety policy

Read/inspection operations are safe after session setup:

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

Writes require explicit approval flags and, in chat, explicit user approval:

- `post publish` requires `--yes`; public publish additionally requires `--yes-public`.
- `post update` requires `--yes`.
- `post delete` requires `--yes-delete` and exact post id confirmation.
- `categories put` requires `--yes`.
- `skin apply` requires `--yes`; live skin apply should be separately approved.
- `skin settings` requires `--yes`.

Default post creation is private/draft-oriented: if `--published` is omitted, the helper sends `published=0`; if `--visibility` is omitted, it uses `private`.

## Commands

### Metadata and categories

```bash
node scripts/tistory-blog.mjs meta --blog <blog> --json
node scripts/tistory-blog.mjs categories get --blog <blog> --json
node scripts/tistory-blog.mjs categories put --blog <blog> --input category-body.json --yes --json
```

### Posts/pages

```bash
node scripts/tistory-blog.mjs post search --blog <blog> --query "검색어" --type all --json
node scripts/tistory-blog.mjs post search --blog <blog> --query "정확한 제목" --type title --exact-title --json
node scripts/tistory-blog.mjs post fetch --blog <blog> --url https://<blog>/<id> --json

# private draft/saved post
node scripts/tistory-blog.mjs post publish \
  --blog <blog> \
  --title "제목" \
  --content-file body.html \
  --category 0 \
  --tags "tag1,tag2" \
  --visibility private \
  --yes \
  --json

# public publish requires --yes-public too
node scripts/tistory-blog.mjs post publish \
  --blog <blog> \
  --title "제목" \
  --content-file body.html \
  --visibility public \
  --published \
  --yes \
  --yes-public \
  --json

node scripts/tistory-blog.mjs post update --blog <blog> --post-id <id> --input fields.json --yes --json
node scripts/tistory-blog.mjs post delete --blog <blog> --post-id <id> --yes-delete --json
```

### Images

```bash
node scripts/tistory-blog.mjs image upload --blog <blog> --file image.png --json
```

The output includes a permanent Tistory image substitution string. Prefer that over the temporary signed URL.

### Skin/theme

```bash
node scripts/tistory-blog.mjs skin get --blog <blog> --out-dir /tmp/tistory-skin --json
node scripts/tistory-blog.mjs skin current --blog <blog> --json
node scripts/tistory-blog.mjs skin validate --html skin.html --css style.css --json
node scripts/tistory-blog.mjs skin preview --blog <blog> --page index --out /tmp/preview.html --json
node scripts/tistory-blog.mjs skin apply --blog <blog> --html skin.html --css style.css --preview --yes --json
node scripts/tistory-blog.mjs skin settings --blog <blog> --input settings.json --yes --json
```

Use `--preview` for safer skin apply dry-runs. Live skin/theme changes require explicit user approval.

### Screenshot

```bash
node scripts/tistory-blog.mjs screenshot --blog <blog> --url https://<blog>/manage/posts --out /tmp/tistory.png --json
```

## Dooray Wiki to Tistory workflow

1. Use `dooray-api` to fetch wiki/page Markdown.
2. Rewrite or clean it into public-readable blog HTML/Markdown.
3. Use `tistory-blog` to upload images if needed.
4. Create a private/draft post with `post publish --yes`.
5. Ask the user before public publishing.

## Implementation notes

- The helper uses core modules from `dist/tistory/*.js` directly.
- For Codex or Claude Code, open this repository and run the same CLI commands.
- For risky writes, always require explicit user confirmation in addition to CLI flags.
- Default CLI output redacts cookie/password/token-like fields. Do not bypass this unless explicitly debugging locally.
- `post publish` returns `postId` only when the numeric admin id is known; slug URLs are represented as `entrySlug`/`slogan`.
