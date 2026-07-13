import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("real environment files stay ignored", async () => {
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /^\.env$/m);
});

test("browser API keys use session storage instead of persistent storage", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /sessionStorage\.setItem\(API_SESSION_KEY, apiKey\)/);
  assert.match(app, /sessionStorage\.removeItem\(API_SESSION_KEY\)/);
  assert.match(app, /const persistedKey = value\?\.apiKey/);
  assert.match(app, /localStorage\.setItem\(API_SETTINGS_KEY, JSON\.stringify\(nonSecretConfig\)\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*apiKey/);
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
