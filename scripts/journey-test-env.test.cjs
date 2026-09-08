const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildTestEnvironment } = require("./test-env.cjs");

test("local test child uses SQLite mode with no connection variables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-test-env-"));
  try {
    const env = buildTestEnvironment({ PATH: process.env.PATH }, root);
    assert.equal(env.NODE_ENV, "test");
    assert.equal(
      Object.keys(env).some((key) => /^(?:DATABASE_|DB_|PG)/.test(key)),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("dotenv inputs are rejected before any child can be selected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-test-env-"));
  try {
    for (const relative of [".env", "apps/api/.env.local", "apps/web/.env.test.local"]) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "DATABASE_URL=never-read\n");
      assert.throws(() => buildTestEnvironment({}, root), /dotenv/);
      fs.unlinkSync(file);
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("actual Jest launcher rejects a foreign target before Jest loads", () => {
  const marker = "DO-NOT-PRINT-THIS-PASSWORD";
  const result = spawnSync(process.execPath, [path.join(__dirname, "jest.cjs"), "--showConfig"], {
    env: { PATH: process.env.PATH, DATABASE_URL: `postgresql://someone:${marker}@127.0.0.1:55431/isntgram_journey` },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.includes(marker), false);
  assert.match(result.stderr, /refus|test|database/i);
});
