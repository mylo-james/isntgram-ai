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

test("package-manager separators do not turn Jest options into test patterns", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, "jest.cjs"),
      "--selectProjects",
      "api",
      "--showConfig",
      "--testPathPatterns",
      "integration",
      "--",
      "--runInBand",
    ],
    {
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.globalConfig.maxWorkers, 1);
  assert.deepEqual(config.globalConfig.testPathPatterns, ["integration"]);
});

for (const [name, directoryOption, expectedDirectory] of [
  ["spaces", '--report-directory="a b"', "a b"],
  ["backslashes and quotes", String.raw`--report-directory="a\\b\"c\\"`, 'a\\b"c\\'],
  ["literal apostrophes and tabs", "--report-directory=a'b\tc", "a'b\tc"],
]) {
  test(`Jest preserves native NODE_OPTIONS values with ${name}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-node-options-"));
    try {
      const marker = path.join(root, "processes.jsonl");
      const preload = path.join(root, "preload.cjs");
      fs.writeFileSync(
        preload,
        `require("node:fs").appendFileSync(process.env.ISNTGRAM_LAUNCHER_PROBE,
          JSON.stringify({ pid: process.pid, entry: process.argv[1],
            directory: process.report.directory, options: process.env.NODE_OPTIONS }) + "\\n");`,
      );
      const quotePath = (value) => '"' + value.replace(/[\\"]/g, "\\$&") + '"';
      const retainedOptions = `${directoryOption} --require=${quotePath(preload)}`;
      const env = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ISNTGRAM_LAUNCHER_PROBE: marker,
        NODE_OPTIONS: retainedOptions,
      };
      // The native process establishes the expected value independently of
      // the launcher's parser and serializer.
      const native = spawnSync(process.execPath, ["-e", ""], { env, encoding: "utf8", timeout: 10000 });
      assert.equal(native.status, 0, native.stderr);
      assert.equal(JSON.parse(fs.readFileSync(marker, "utf8")).directory, expectedDirectory);

      for (const separator of ["=", " "]) {
        fs.writeFileSync(marker, "");
        const result = spawnSync(process.execPath, [path.join(__dirname, "jest.cjs"), "--showConfig"], {
          env: {
            ...env,
            NODE_OPTIONS: `${retainedOptions} --localstorage-file${separator}${quotePath(path.join(root, "local storage"))}`,
          },
          encoding: "utf8",
          timeout: 10000,
        });
        assert.equal(result.status, 0, result.stderr);
        assert.ok(JSON.parse(result.stdout).globalConfig);
        const processes = fs.readFileSync(marker, "utf8").trim().split("\n").map(JSON.parse);
        assert.equal(processes.length, 2, "both the launcher and Jest must retain the preload");
        const [parent, child] = processes;
        assert.notEqual(parent.pid, child.pid);
        assert.equal(parent.entry, path.join(__dirname, "jest.cjs"));
        assert.match(child.entry, /[/\\]jest[/\\]bin[/\\]jest\.js$/);
        assert.equal(parent.directory, expectedDirectory);
        assert.equal(child.directory, expectedDirectory);
        assert.match(parent.options, /--localstorage-file/);
        assert.doesNotMatch(child.options, /--localstorage-file/);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
