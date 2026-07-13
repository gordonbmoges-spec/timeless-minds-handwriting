import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("real environment files stay ignored", async () => {
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /^\.env$/m);
});

test("browser API keys stay in page memory instead of browser storage", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /let apiSessionKey = ""/);
  assert.match(app, /apiSessionKey = config\.apiKey/);
  assert.match(app, /apiSessionKey = ""/);
  assert.match(app, /const persistedKey = value\?\.apiKey/);
  assert.match(app, /localStorage\.setItem\(API_SETTINGS_KEY, JSON\.stringify\(nonSecretConfig\)\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*apiKey/);
  assert.doesNotMatch(app, /sessionStorage/);
});

test("server and worker define baseline browser security headers", async () => {
  for (const relativePath of ["../server.js", "../worker/index.js"]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /Content-Security-Policy/);
    assert.match(source, /X-Content-Type-Options/);
    assert.match(source, /X-Frame-Options/);
    assert.match(source, /Referrer-Policy/);
  }
});
