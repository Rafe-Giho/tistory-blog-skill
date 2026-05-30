#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  SessionExpiredError,
  applySkin,
  applySkinSettings,
  buildImageSubstitution,
  deletePost,
  fetchBlogConfig,
  getCategories,
  getSkin,
  getSkinCurrent,
  listPosts,
  previewSkin,
  publishPost,
  putCategories,
  updatePost,
  uploadImage,
  visibilityToInt,
} from '../dist/tistory/api.js';
import { CredentialStoreError, clearStoredCookies, loadContext, loadStoredCookies, loginInteractive, refreshStoredSession } from '../dist/tistory/browser.js';
import { fetchPost } from '../dist/tistory/scraper.js';
import { validateSkin } from '../dist/tistory/validator.js';

function usage() {
  console.log(`Usage: node scripts/tistory-blog.mjs <command> [options]

Commands:
  session init --blog <host> [--timeout-ms 300000]
  session check --blog <host>
  session clear [--blog <host>]
  meta --blog <host>
  categories get --blog <host>
  categories put --blog <host> --input body.json --yes
  post search --blog <host> [--query text] [--type title|content|all] [--exact-title] [--visibility all|public|private|protected] [--page 1]
  post fetch --blog <host> --url <post-url>
  post publish --blog <host> --title <title> --content-file file [--category id] [--tags a,b] [--visibility private|protected|public] [--published] [--type post|page] [--slogan slug] --yes [--yes-public]
  post update --blog <host> --post-id <id> --input fields.json --yes
  post delete --blog <host> --post-id <id> --yes-delete
  image upload --blog <host> --file image.png [--filename name] [--mime image/png]
  skin get --blog <host> [--out-dir dir]
  skin apply --blog <host> --html skin.html --css style.css [--preview] --yes
  skin current --blog <host>
  skin settings --blog <host> --input settings.json --yes
  skin preview --blog <host> --page index|entry|category|tag|guestbook [--input body.json] [--out file]
  skin validate --html skin.html --css style.css
  screenshot --blog <host> --url <url> --out image.png

Global: --json [--auto-refresh]

--auto-refresh: on session expiry, open the persistent browser profile to renew cookies before failing.`);
}
function parse(argv) {
  const a = { _: [], json: false };
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--json') a.json = true;
    else if (x.startsWith('--')) {
      const key = x.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) a[key] = true;
      else a[key] = argv[++i];
    } else a._.push(x);
  }
  return a;
}
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function readJson(file) { return JSON.parse(readText(file)); }
function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (/cookieHeader|cookie|password|token|secret/i.test(key) && typeof val === 'string') out[key] = val ? '<redacted>' : val;
    else out[key] = redact(val);
  }
  return out;
}
function writeOut(value, json) {
  const safe = redact(value);
  if (json) console.log(JSON.stringify(safe, null, 2));
  else if (typeof safe === 'string') console.log(safe);
  else console.log(JSON.stringify(safe, null, 2));
}
function requireArg(args, key) { if (!args[key]) throw new Error(`Missing --${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`); return args[key]; }
async function ctx(args) {
  const blog = requireArg(args, 'blog');
  const c = await loadContext(blog);
  if (c) return c;
  if (args.autoRefresh || process.env.TISTORY_AUTO_REFRESH === '1') {
    await refreshStoredSession({ blogUrl: blog, ...(args.timeoutMs ? { timeoutMs: Number(args.timeoutMs) } : {}) });
    const refreshed = await loadContext(blog);
    if (refreshed) return refreshed;
  }
  throw new Error(`Tistory session not found or expired for ${blog}. Run: node scripts/tistory-blog.mjs session init --blog ${blog}`);
}

async function withAutoRefresh(args, operation) {
  try {
    return await operation(await ctx(args));
  } catch (error) {
    if (!(error instanceof SessionExpiredError) || !(args.autoRefresh || process.env.TISTORY_AUTO_REFRESH === '1')) throw error;
    const blog = requireArg(args, 'blog');
    await refreshStoredSession({ blogUrl: blog, ...(args.timeoutMs ? { timeoutMs: Number(args.timeoutMs) } : {}) });
    return operation(await ctx(args));
  }
}
function tags(value) { return value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : []; }
function postFields(args) {
  return {
    ...(args.title ? { title: args.title } : {}),
    ...(args.contentFile ? { content: readText(args.contentFile) } : {}),
    ...(args.type ? { type: args.type } : {}),
    ...(args.visibility ? { visibility: visibilityToInt(args.visibility) } : {}),
    ...(args.category != null ? { category: Number(args.category) } : {}),
    ...(args.tags ? { tag: tags(args.tags).join(',') } : {}),
    ...(args.published != null ? { published: args.published ? 1 : 0 } : {}),
    ...(args.password != null ? { password: args.password } : {}),
    ...(args.slogan != null ? { slogan: args.slogan } : {}),
  };
}
function assertYes(args, flag = 'yes', what = 'write operation') {
  if (!args[flag]) throw new Error(`Refusing ${what} without --${flag.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`);
}

const args = parse(process.argv);
const [group, action] = args._;
if (!group || group === 'help' || args.help) { usage(); process.exit((group || args.help) ? 0 : 2); }
try {
  let out;
  if (group === 'session') {
    if (action === 'init' || action === 'refresh') out = await loginInteractive({ blogUrl: requireArg(args, 'blog'), ...(args.timeoutMs ? { timeoutMs: Number(args.timeoutMs) } : {}) });
    else if (action === 'check') {
      const blog = requireArg(args, 'blog');
      try {
        const c = await loadContext(blog);
        if (!c) out = { ok: false, blog, code: 'session_not_found', reason: 'no stored usable cookies' };
        else {
          try {
            const meta = await fetchBlogConfig(c);
            await listPosts(c, { page: 1, searchKeyword: '', searchType: 'title', visibility: 'all' });
            out = { ok: true, blog, title: meta.title || null, domain: meta.domain || c.host, verified: ['config', 'posts'] };
          } catch (error) {
            out = { ok: false, blog, code: error?.name === 'SessionExpiredError' ? 'session_expired' : 'session_check_failed', reason: error?.message || String(error), ...(error?.status ? { status: error.status } : {}) };
          }
        }
      } catch (error) {
        if (error instanceof CredentialStoreError) out = { ok: false, blog, code: error.code, reason: error.message, operation: error.operation, ...(error.account ? { account: error.account } : {}) };
        else throw error;
      }
    }
    else if (action === 'clear') { await clearStoredCookies(args.blog); out = { ok: true, cleared: args.blog || 'default' }; }
    else throw new Error(`Unknown session action: ${action}`);
  } else if (group === 'meta') {
    out = await withAutoRefresh(args, c => fetchBlogConfig(c));
  } else if (group === 'categories') {
    if (action === 'get') out = await withAutoRefresh(args, c => getCategories(c));
    else if (action === 'put') { assertYes(args, 'yes', 'category update'); out = await withAutoRefresh(args, c => putCategories(c, readJson(requireArg(args, 'input')))); }
    else throw new Error(`Unknown categories action: ${action}`);
  } else if (group === 'post') {
    if (action === 'search') {
      out = await withAutoRefresh(args, c => listPosts(c, { page: Number(args.page || 1), searchKeyword: args.query || '', searchType: args.type || 'title', visibility: args.visibility || 'all' }));
      if (args.exactTitle) {
        const query = String(args.query || '').trim();
        const items = (out.items || []).filter(item => String(item.title || '').trim() === query);
        out = { ...out, count: items.length, items, exactTitle: query };
      }
    }
    else if (action === 'fetch') out = await fetchPost(requireArg(args, 'url'));
    else if (action === 'publish') { assertYes(args, 'yes', 'post publish/create'); if ((args.visibility || 'private') === 'public') assertYes(args, 'yesPublic', 'public publishing'); out = await withAutoRefresh(args, c => publishPost(c, { type: 'post', visibility: visibilityToInt(args.visibility || 'private'), category: Number(args.category || 0), tag: tags(args.tags).join(','), published: args.published ? 1 : 0, ...postFields(args) })); }
    else if (action === 'update') { assertYes(args, 'yes', 'post update'); out = await withAutoRefresh(args, c => updatePost(c, requireArg(args, 'postId'), readJson(requireArg(args, 'input')))); }
    else if (action === 'delete') { assertYes(args, 'yesDelete', 'post deletion'); out = await withAutoRefresh(args, c => deletePost(c, requireArg(args, 'postId'))); }
    else throw new Error(`Unknown post action: ${action}`);
  } else if (group === 'image') {
    if (action !== 'upload') throw new Error(`Unknown image action: ${action}`);
    const uploaded = await uploadImage(await ctx(args), requireArg(args, 'file'), { ...(args.filename ? { filename: args.filename } : {}), ...(args.mime ? { mime: args.mime } : {}) });
    out = { ...uploaded, substitution: buildImageSubstitution(uploaded.key, { originWidth: Number(args.width || 0), originHeight: Number(args.height || 0), style: args.style || 'alignCenter', filename: uploaded.filename || path.basename(args.file) }) };
  } else if (group === 'skin') {
    const c = action === 'validate' ? null : await ctx(args);
    if (action === 'get') { const skin = await getSkin(c); if (args.outDir) { fs.mkdirSync(args.outDir, { recursive: true }); fs.writeFileSync(path.join(args.outDir, 'skin.html'), skin.html); fs.writeFileSync(path.join(args.outDir, 'style.css'), skin.css); } out = skin; }
    else if (action === 'apply') { assertYes(args, 'yes', 'skin apply'); out = { previewUrl: await applySkin(c, { html: readText(requireArg(args, 'html')), css: readText(requireArg(args, 'css')), isPreview: !!args.preview }) }; }
    else if (action === 'current') out = await getSkinCurrent(c);
    else if (action === 'settings') { assertYes(args, 'yes', 'skin settings update'); await applySkinSettings(c, readJson(requireArg(args, 'input'))); out = { ok: true }; }
    else if (action === 'preview') { const current = args.input ? readJson(args.input) : await getSkinCurrent(c); const html = await previewSkin(c, args.page || 'index', current); if (args.out) fs.writeFileSync(args.out, html); out = args.out ? { ok: true, out: args.out } : html; }
    else if (action === 'validate') out = validateSkin({ html: readText(requireArg(args, 'html')), css: readText(requireArg(args, 'css')) });
    else throw new Error(`Unknown skin action: ${action}`);
  } else if (group === 'screenshot') {
    const blog = requireArg(args, 'blog');
    const url = requireArg(args, 'url');
    const outPath = requireArg(args, 'out');
    const cookie = await loadStoredCookies(blog);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ extraHTTPHeaders: cookie ? { cookie } : {} });
      await page.goto(url, { waitUntil: 'networkidle', timeout: Number(args.timeoutMs || 60000) });
      await page.screenshot({ path: outPath, fullPage: true });
      out = { ok: true, out: outPath };
    } finally { await browser.close(); }
  } else throw new Error(`Unknown command group: ${group}`);
  writeOut(out, args.json);
} catch (error) {
  const body = error?.body ? String(error.body).slice(0, 1000) : undefined;
  const payload = {
    ok: false,
    code: error instanceof CredentialStoreError ? error.code : (error?.name === 'SessionExpiredError' ? 'session_expired' : 'error'),
    error: error?.message || String(error),
    ...(error instanceof CredentialStoreError ? { operation: error.operation, ...(error.account ? { account: error.account } : {}) } : {}),
    ...(error?.status ? { status: error.status } : {}),
    ...(body ? { body } : {}),
  };
  const text = JSON.stringify(payload, null, 2);
  if (args.json) console.log(text);
  else console.error(text);
  process.exit(1);
}
