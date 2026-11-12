import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const scripts = ["scripts/check.sh", "tests/test-shared-modules.sh", "tests/test-bundle.sh", "tests/test-install.sh"];
for (const path of scripts) {
  assert.doesNotMatch(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    /\/private\/var\/folders\//,
    `${path} must not depend on a machine-specific temp directory`,
  );
}
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.toUpperCase() === "TMPDIR") delete env[key];
for (const path of scripts.slice(1)) {
  const result = spawnSync("sh", [path], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
    // Windows needs far more than 30s here: each bundle build shells out to
    // rsync several times, and Cygwin-based rsync pays slow process-init
    // costs per invocation, especially under load.
    timeout: 120000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${path} must work without TMPDIR: ${result.stderr || result.stdout}`);
}
console.log("portable temp-directory tests passed");
