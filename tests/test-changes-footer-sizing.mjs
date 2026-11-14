import assert from "node:assert/strict";
import { footerNameWidths } from "../mods/mide-changes/footer-sizing.js";

// Widths here are measured in the same logical pixels as the UI, after the
// remote action, icon, separator and gaps have been reserved.
assert.deepEqual(footerNameWidths(200, 130, 35), { repository: 130, branch: 35 }, "both names fit");
assert.deepEqual(footerNameWidths(200, 150, 35), { repository: 150, branch: 35 }, "short branch yields unused room");
assert.deepEqual(
  footerNameWidths(200, 30, 160),
  { repository: 30, branch: 160 },
  "short repository yields unused room",
);
assert.deepEqual(
  footerNameWidths(180, 300, 32),
  { repository: 148, branch: 32 },
  "short branch stays whole when repo overflows",
);
assert.deepEqual(
  footerNameWidths(180, 32, 300),
  { repository: 32, branch: 148 },
  "short repo stays whole when branch overflows",
);
assert.deepEqual(footerNameWidths(180, 120, 240), { repository: 60, branch: 120 }, "long names shrink proportionally");
assert.deepEqual(footerNameWidths(0, 120, 240), { repository: 0, branch: 0 }, "no available room");
assert.deepEqual(footerNameWidths(100, 0, 0), { repository: 0, branch: 0 }, "empty measurements");
assert.deepEqual(footerNameWidths(-5, 120, 240), { repository: 0, branch: 0 }, "negative available room is clamped");
assert.deepEqual(footerNameWidths(100.5, 60.25, 40.25), { repository: 60.25, branch: 40.25 }, "fractional exact fit");
for (const available of [0, 5, 50, 100, 300]) {
  for (const repository of [0, 10, 100, 300]) {
    for (const branch of [0, 10, 100, 300]) {
      const result = footerNameWidths(available, repository, branch);
      assert.ok(result.repository >= 0 && result.repository <= repository);
      assert.ok(result.branch >= 0 && result.branch <= branch);
      assert.ok(result.repository + result.branch <= available + 1e-9);
      if (repository + branch <= available) {
        assert.deepEqual(result, { repository, branch }, "do not truncate names that fit");
      }
    }
  }
}
console.log("Changes footer sizing tests passed");
