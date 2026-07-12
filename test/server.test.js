import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createInkDiaryServer } from "../server.js";

let server;
let baseUrl;

before(async () => {
  server = createInkDiaryServer({ env: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("serves the application shell", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /墨影笔记/);
});

test("rejects malformed JSON", async () => {
  const response = await fetch(`${baseUrl}/api/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_json" });
});

test("rejects a request without a PNG", async () => {
  const response = await fetch(`${baseUrl}/api/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaId: "confucius" })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "missing_png" });
});
