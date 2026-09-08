const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("native Jest emits an untouched proxy entry into the configured root summary", { timeout: 30000 }, () => {
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-coverage-producer-"));
  try {
    const coverageDirectory = path.join(evidence, "coverage");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/jest.cjs",
        "--coverage",
        "--coverageDirectory",
        coverageDirectory,
        "--runInBand",
        "--selectProjects",
        "web",
        "--runTestsByPath",
        "apps/web/lib/validation.test.ts",
      ],
      { encoding: "utf8" },
    );
    // The focused suite is expected to fail only the preserved full global gate.
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(output, /Test Suites: 1 passed, 1 total/);
    assert.doesNotMatch(output, /Failed to collect coverage/);
    const summary = JSON.parse(fs.readFileSync(path.join(coverageDirectory, "coverage-summary.json"), "utf8"));
    const proxy = Object.entries(summary).find(([filePath]) => filePath.endsWith("/apps/web/proxy.ts"))?.[1];
    assert.ok(proxy, "root coverage summary must contain apps/web/proxy.ts");
    assert.equal(proxy.statements.covered, 0);
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
  }
});
