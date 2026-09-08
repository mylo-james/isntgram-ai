const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { contracts, FILES } = require("./contracts.cjs");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-contract-fixture-"));
  try {
    FILES.forEach((file) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), "committed\n");
    });
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init", "-q"]);
    git(["add", "--", ...FILES]);
    git([
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "fixture",
    ]);
    FILES.forEach((file) => fs.writeFileSync(path.join(root, file), "dirty current\n"));
    const state = { generated: ["dirty current\n", "dirty current\n"], fail: false, during: null, temporary: null };
    const spawn = (command, args, options) => {
      if (command === "git") return spawnSync(command, args, { ...options, stdio: "pipe" });
      if (args.includes("@isntgram-ai/shared-types")) {
        if (state.failBuild) return { status: 1 };
        state.built = true;
      }
      if (args.includes("openapi:generate")) {
        assert.equal(state.built, true, "build the workspace dependency before API bootstrap");
        state.temporary = path.dirname(args.at(-1));
        fs.writeFileSync(args.at(-1), state.generated[0]);
        state.during?.();
      } else if (args.includes("openapi-typescript")) {
        if (state.fail) return { status: 1 };
        fs.writeFileSync(args.at(-1), state.generated[1]);
      }
      return { status: 0 };
    };
    run({ root, state, options: { root, source: {}, spawn } });
    if (state.temporary) assert.equal(fs.existsSync(state.temporary), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const read = (root) => FILES.map((file) => fs.readFileSync(path.join(root, file), "utf8"));

test("check accepts contracts matching current source despite dirty Git status and preserves their bytes", () =>
  fixture(({ root, options }) => {
    contracts("check", options);
    assert.deepEqual(read(root), ["dirty current\n", "dirty current\n"]);
  }));
for (const index of [0, 1])
  test(`check rejects drift in contract ${index} without overwriting it`, () =>
    fixture(({ root, state, options }) => {
      state.generated[index] = "new source\n";
      assert.throws(() => contracts("check", options), /Generated contracts differ/);
      assert.deepEqual(read(root), ["dirty current\n", "dirty current\n"]);
    }));
for (const mode of ["check", "generate"])
  test(`${mode} preserves both files when the second generator fails`, () =>
    fixture(({ root, state, options }) => {
      state.generated[0] = "new source\n";
      state.fail = true;
      assert.throws(() => contracts(mode, options), /Contract step failed/);
      assert.deepEqual(read(root), ["dirty current\n", "dirty current\n"]);
    }));
test("generate preserves raw dirty preimages before replacing both contracts", () =>
  fixture(({ root, state, options }) => {
    state.generated = ["new spec\n", "new types\n"];
    contracts("generate", options);
    assert.deepEqual(read(root), state.generated);
    const backups = path.join(root, ".local/contract-backups");
    const versions = fs.readdirSync(backups);
    assert.equal(versions.length, 1);
    assert.deepEqual(read(path.join(backups, versions[0])), ["dirty current\n", "dirty current\n"]);
  }));
for (const remove of [false, true])
  test(`generate refuses a concurrent ${remove ? "deletion" : "edit"}`, () =>
    fixture(({ root, state, options }) => {
      state.generated = ["new spec\n", "new types\n"];
      state.during = () =>
        remove
          ? fs.unlinkSync(path.join(root, FILES[0]))
          : fs.writeFileSync(path.join(root, FILES[0]), "new user edit\n");
      assert.throws(() => contracts("generate", options), /Contract changed during generation/);
      assert.equal(fs.readFileSync(path.join(root, FILES[1]), "utf8"), "dirty current\n");
      if (!remove) assert.equal(fs.readFileSync(path.join(root, FILES[0]), "utf8"), "new user edit\n");
    }));
test("check refuses an untracked contract", () =>
  fixture(({ root, options }) => {
    const result = spawnSync("git", ["rm", "--cached", "-f", "--", FILES[0]], { cwd: root });
    assert.equal(result.status, 0);
    assert.throws(() => contracts("check", options), /Contract step failed/);
  }));

for (const remove of [false, true])
  test(`check refuses a concurrent ${remove ? "deletion" : "edit"} instead of reporting stale success`, () =>
    fixture(({ root, state, options }) => {
      state.during = () =>
        remove
          ? fs.unlinkSync(path.join(root, FILES[0]))
          : fs.writeFileSync(path.join(root, FILES[0]), "concurrent edit\n");
      assert.throws(() => contracts("check", options), /Contract changed during generation/);
      if (!remove) assert.equal(fs.readFileSync(path.join(root, FILES[0]), "utf8"), "concurrent edit\n");
    }));

test("a shared-package build failure leaves both contracts untouched", () =>
  fixture(({ root, state, options }) => {
    state.failBuild = true;
    assert.throws(() => contracts("check", options), /Contract step failed/);
    assert.equal(state.temporary, null);
    assert.deepEqual(read(root), ["dirty current\n", "dirty current\n"]);
  }));
