import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceReplyFade,
  createReplyState,
  showSingleReply,
  startReplyFade
} from "../public/modules/reply-presenter.js";

test("showing a reply replaces the previous reply", () => {
  let state = createReplyState();
  state = showSingleReply(state, { text: "first" });
  state = showSingleReply(state, { text: "second" });
  assert.equal(state.current.text, "second");
  assert.equal(state.current.alpha, 1);
});

test("reply fade is linear and removes the reply at completion", () => {
  let state = showSingleReply(createReplyState(), { text: "answer" });
  state = startReplyFade(state);
  state = advanceReplyFade(state, 0.5);
  assert.equal(state.current.alpha, 0.5);
  state = advanceReplyFade(state, 1);
  assert.equal(state.current, null);
});

test("starting fade twice keeps the same single fade", () => {
  let state = showSingleReply(createReplyState(), { text: "answer" });
  state = startReplyFade(state);
  const fading = startReplyFade(state);
  assert.equal(fading.current.fading, true);
  assert.equal(fading.current.text, "answer");
});
