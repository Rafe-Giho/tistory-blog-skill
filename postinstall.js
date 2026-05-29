#!/usr/bin/env node
// Tistory 로그인/스크린샷이 쓰는 Chromium 을 자동 다운로드.
// 실패해도 패키지 설치 자체는 통과시킨다 (네트워크 차단 환경 대응).
// 첫 session init 호출 시에도 다시 안내할 수 있음.

import { spawnSync } from "node:child_process";

if (process.env["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"] === "1") {
  process.exit(0);
}

const r = spawnSync("playwright", ["install", "chromium"], {
  stdio: "inherit",
  shell: true,
});

if (r.status !== 0) {
  console.error(
    "[tistory-blog] Chromium 자동 다운로드 실패. session init/screenshot 사용 전에 수동 실행: npx playwright install chromium",
  );
}
process.exit(0);
