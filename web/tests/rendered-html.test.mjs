import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the LUMI student experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LUMI · 儿童英语智能学习平台<\/title>/i);
  assert.match(html, /和小鹿一起，开心学英语/);
  assert.match(html, /aria-label="Lumi 小鹿吉祥物"/);
  assert.match(html, /mood-neutral/);
  assert.match(html, /未成年人请在家长或教师指导下使用/);
});

test("keeps the gentle Lumi feedback system wired and accessible", async () => {
  const [studentUi, studentCss, learningUi, learningCss] = await Promise.all([
    readFile(new URL("../components/student-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/student-ui.css", import.meta.url), "utf8"),
    readFile(new URL("../components/learning-components.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/learning-components.css", import.meta.url), "utf8"),
  ]);

  for (const mood of ["happy", "encourage", "curious", "listening", "resting", "proud"]) {
    assert.match(studentUi, new RegExp(`\\b${mood}\\b`));
    assert.match(studentCss, new RegExp(`mood-${mood}`));
  }

  assert.match(studentCss, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(learningUi, /我想歇一下|lumi-help-button/);
  assert.match(learningUi, /delay = 7000/);
  assert.match(learningUi, /setVisible\(true\); playLumiSound\("help"\)/);
  assert.match(learningUi, /Lumi 发现你在想办法/);
  assert.match(learningUi, /差一点点，继续试试看/);
  assert.match(learningUi, /ADVENTURE COMPLETE/);
  assert.match(learningUi, /role="status"/);
  assert.match(learningCss, /lesson-support/);
  assert.match(learningCss, /strong-success-card/);
  assert.match(learningCss, /strong-retry-card/);
  assert.match(learningCss, /complete-confetti/);
});

test("keeps the requested student-page simplifications", async () => {
  const [page, globals] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className=\{hasCheckedIn \? "checkin-button checked"/);
  assert.match(page, /setCheckInDays\(\(days\) => days \+ 1\)/);
  assert.doesNotMatch(page, /CHOOSE A START|5 LEARNING TYPES|本周勋章|className="ai-banner"/);
  assert.match(page, /className="ai-page-layout"/);
  assert.match(globals, /\.ai-page-layout \.chat-composer \{ position: sticky/);
});
