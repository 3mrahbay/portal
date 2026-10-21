import test from "node:test";
import assert from "node:assert/strict";
import {
  accessFor,
  profileEmail,
  validatePost,
  canPost,
  groupBooks,
  escapeHTML,
} from "../js/kitap-kulubu/core.mjs";
test("approved mothers read but membership is required to post", () => {
  const a = accessFor({
    email: "anne@x",
    parent: { rol: "anne", onaylandi: true },
  });
  assert.equal(a.read, true);
  assert.equal(canPost(a, null, { status: "active" }), false);
  assert.equal(canPost(a, { status: "approved" }, { status: "active" }), true);
  assert.equal(
    canPost(a, { status: "approved" }, { status: "archived" }),
    false,
  );
});
test("fathers, unapproved mothers and inactive staff are excluded", () => {
  for (const s of [
    { parent: { rol: "baba", onaylandi: true } },
    { parent: { rol: "anne", onaylandi: false } },
    { staff: { rol: "pdr", durum: "pasif" } },
  ])
    assert.equal(accessFor(s).read, false);
  assert.equal(
    accessFor({ staff: { rol: "ogretmen", durum: "aktif" } }).staff,
    true,
  );
});
test("UID profile mappings fail closed on conflicts and disabled identities", () => {
  assert.equal(profileEmail(null, "veli", "A@X"), "a@x");
  assert.equal(
    profileEmail(
      { aktif: false, primaryProfile: "veli", refEmail: "a@x" },
      "veli",
      "b@x",
    ),
    "",
  );
  assert.equal(
    profileEmail(
      {
        primaryProfile: "veli",
        refEmail: "a@x",
        profiles: { veli: { refEmail: "b@x" } },
      },
      "veli",
      "a@x",
    ),
    "",
  );
  assert.equal(
    profileEmail({ primaryProfile: "veli", refEmail: "a@x" }, "veli", "b@x"),
    "a@x",
  );
});
test("reject empty, oversized and active image payloads", () => {
  assert.throws(() => validatePost(""));
  assert.throws(() => validatePost("a".repeat(2001)));
  assert.throws(() => validatePost("x", "data:image/svg+xml,<svg>"));
  assert.deepEqual(validatePost(" ok "), { text: "ok", image: "" });
});
test("archive stays browsable and user content is escaped", () => {
  assert.equal(
    groupBooks([{ status: "active" }, { status: "archived" }]).archive.length,
    1,
  );
  assert.equal(
    escapeHTML('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});
