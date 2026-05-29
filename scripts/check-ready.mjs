#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const fix = args.has('--fix');
const json = args.has('--json');
const blogArgIndex = process.argv.indexOf('--blog');
const blog = blogArgIndex >= 0 ? process.argv[blogArgIndex + 1] : null;

const checks = [];
const actions = [];

function add(name, ok, detail, fixHint) {
  checks.push({ name, ok, detail, ...(fixHint ? { fixHint } : {}) });
}
function run(command, runArgs, opts = {}) {
  const result = spawnSync(command, runArgs, {
    cwd: root,
    stdio: json ? 'pipe' : 'inherit',
    encoding: 'utf8',
    ...opts,
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : '';
    throw new Error(`${command} ${runArgs.join(' ')} failed with code ${result.status}${stderr}`);
  }
  return result;
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function mtime(rel) {
  try { return fs.statSync(path.join(root, rel)).mtimeMs; }
  catch { return 0; }
}
function canResolve(pkg) {
  try { require.resolve(pkg); return true; }
  catch { return false; }
}
function nodeMajor() {
  return Number.parseInt(process.versions.node.split('.')[0], 10);
}

const pkgExists = exists('package.json');
add('package.json', pkgExists, pkgExists ? 'found' : 'missing');

const nodeOk = nodeMajor() >= 18;
add('node >= 18', nodeOk, process.versions.node, 'Install Node.js 18 or newer.');

const nodeModulesOk = exists('node_modules');
add('node_modules', nodeModulesOk, nodeModulesOk ? 'installed' : 'missing', 'Run npm install.');

const requiredPackages = [
  ['playwright', 'playwright'],
  ['keytar', 'keytar'],
  ['cheerio', 'cheerio'],
  ['zod', 'zod'],
  ['@cfworker/json-schema', '@cfworker/json-schema'],
];
for (const [label, specifier] of requiredPackages) {
  const ok = nodeModulesOk && canResolve(specifier);
  add(`dependency:${label}`, ok, ok ? `resolved ${specifier}` : `not resolved ${specifier}`, 'Run npm install.');
}

const distFiles = ['dist/tistory/api.js', 'dist/tistory/browser.js', 'dist/tistory/scraper.js', 'dist/tistory/validator.js'];
for (const file of distFiles) {
  add(file, exists(file), exists(file) ? 'found' : 'missing', 'Run npm run build.');
}

const srcNewest = Math.max(...['src/index.ts', 'src/tistory/api.ts', 'src/tistory/browser.ts', 'src/tistory/scraper.ts', 'src/tistory/validator.ts', 'src/tistory/catalog.ts'].map(mtime));
const distOldest = Math.min(...distFiles.map(mtime).filter(Boolean));
const distFresh = distOldest > 0 && distOldest >= srcNewest;
add('dist freshness', distFresh, distFresh ? 'up to date' : 'dist missing or older than src', 'Run npm run build.');

if (fix) {
  if (!nodeOk) throw new Error(`Node.js ${process.versions.node} is too old; install Node.js 18 or newer first.`);
  if (!nodeModulesOk || requiredPackages.some(([, specifier]) => !canResolve(specifier))) {
    actions.push('npm install');
    run('npm', ['install']);
  }
  if (!distFresh || distFiles.some((file) => !exists(file))) {
    actions.push('npm run build');
    run('npm', ['run', 'build']);
  }
}

let session = null;
if (blog) {
  if (exists('dist/tistory/browser.js') && canResolve('keytar')) {
    const result = run('node', ['scripts/tistory-blog.mjs', 'session', 'check', '--blog', blog, '--json'], { stdio: 'pipe' });
    try { session = JSON.parse(result.stdout); }
    catch { session = { ok: false, error: result.stdout || result.stderr || 'unparseable session check output' }; }
    add(`session:${blog}`, !!session.ok, session.ok ? 'stored session found' : 'no stored session', `Run node scripts/tistory-blog.mjs session init --blog ${blog} --json`);
  } else {
    add(`session:${blog}`, false, 'skipped because dependencies/build are not ready');
  }
}

const ok = checks.every((c) => c.ok);
const output = { ok, root, checks, actions, ...(session ? { session } : {}) };

if (json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`Tistory skill readiness: ${ok ? 'OK' : 'NOT READY'}`);
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
    if (!c.ok && c.fixHint) console.log(`  → ${c.fixHint}`);
  }
  if (actions.length) console.log(`Actions run: ${actions.join(', ')}`);
  if (!ok && !fix) console.log('\nTo repair local setup explicitly, run: node scripts/check-ready.mjs --fix');
}

process.exit(ok ? 0 : 1);
