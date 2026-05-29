#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parse(argv) {
  const out = { fix: false };
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--fix') out.fix = true;
    else if (x === '--blog') out.blog = argv[++i];
    else if (x === '--timeout-ms') out.timeoutMs = argv[++i];
    else if (x === '--help' || x === '-h') out.help = true;
  }
  return out;
}
function normalizeBlog(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}
function run(args, { allowFail = false } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (!allowFail && result.status !== 0) process.exit(result.status ?? 1);
  return result.status ?? 1;
}

const args = parse(process.argv);
if (args.help) {
  console.log(`Usage: node scripts/connect.mjs [--blog <blog.tistory.com>] [--fix] [--timeout-ms 900000]

Prompts for a Tistory blog address when --blog is omitted, checks local readiness,
and opens the Tistory/Kakao login browser window via session init.

--fix         explicitly allow npm install/build repair through check-ready
--timeout-ms  login wait timeout, default 900000`);
  process.exit(0);
}

let blog = normalizeBlog(args.blog);
if (!blog) {
  const rl = readline.createInterface({ input, output });
  try {
    blog = normalizeBlog(await rl.question('연결할 티스토리 블로그 주소를 입력하세요 (예: example.tistory.com): '));
  } finally {
    rl.close();
  }
}
if (!blog) {
  console.error('블로그 주소가 필요합니다. 예: --blog example.tistory.com');
  process.exit(2);
}

// First-time connect should verify dependencies/build only. A stored session is expected
// to be absent before the login window runs, especially on fresh Windows/Codex setups.
const checkArgs = ['scripts/check-ready.mjs'];
if (args.fix) checkArgs.push('--fix');
const checkStatus = run(checkArgs, { allowFail: true });
if (checkStatus !== 0 && !args.fix) {
  console.error('\n준비 상태가 완전하지 않습니다. 필요한 경우 명시적으로 다음을 실행하세요:');
  console.error('  node scripts/connect.mjs --blog ' + blog + ' --fix');
  process.exit(checkStatus);
}

console.log('\n브라우저 로그인 창을 엽니다. 카카오/티스토리 로그인과 2FA를 완료한 뒤 관리자 화면까지 진입하세요.');
run(['scripts/tistory-blog.mjs', 'session', 'init', '--blog', blog, '--timeout-ms', String(args.timeoutMs || 900000), '--json']);
console.log('\n연결 확인:');
run(['scripts/tistory-blog.mjs', 'session', 'check', '--blog', blog, '--json']);
