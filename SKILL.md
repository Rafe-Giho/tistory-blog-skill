---
name: tistory-blog
description: Native OpenClaw skill for Tistory blog operations after the official Tistory Open API shutdown. Uses Tistory admin/session APIs through a short-lived CLI helper. Supports cross-platform session storage via OS credential stores, metadata/category lookup, post search/fetch/create/update/delete, image upload, skin/theme tooling, screenshots, and Dooray/Notion-to-blog workflows with approval gates for risky writes.
---

# Tistory Blog

Use this skill for Tistory blog management from OpenClaw through `scripts/tistory-blog.mjs`.

This is a Node/TypeScript-backed CLI skill. It is not a long-running server: each command starts a short-lived Node process and exits.

## Setup and readiness

Normal use does **not** require `npm install` or `npm run build` every time. They are only needed when setting up a new environment, changing dependencies, or editing TypeScript source.

Check local readiness first:

```bash
cd ~/.openclaw/skills/tistory-blog
node scripts/check-ready.mjs --blog <blog.tistory.com>
```

If the check reports missing dependencies or stale build output, repair explicitly:

```bash
node scripts/check-ready.mjs --fix
# or: npm run setup
```

The readiness script checks Node version, npm dependencies, `dist/` build output, build freshness, and optionally stored Tistory session state. It only runs install/build when `--fix` is explicitly passed.

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
```

Or specify the blog URL directly:

```bash
node scripts/connect.mjs --blog https://<blog>.tistory.com/
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
