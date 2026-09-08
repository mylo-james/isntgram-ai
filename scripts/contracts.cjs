const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildTestEnvironment } = require("./test-env.cjs");
const FILES = ["apps/api/openapi.json", "packages/shared-types/src/openapi.ts"];

function contracts(mode, { root = path.resolve(__dirname, ".."), source = process.env, spawn = spawnSync } = {}) {
  if (!["check", "generate"].includes(mode)) throw new Error("Use contracts.cjs check|generate");
  if (source.ISNTGRAM_TEST_POSTGRES) throw new Error("Contracts require the clean SQLite test environment.");
  const env = buildTestEnvironment(source, root);
  const run = (command, args) => {
    const result = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error(`Contract step failed: ${command} ${args.join(" ")}`);
  };
  if (mode === "check") run("git", ["ls-files", "--error-unmatch", ...FILES]);
  const before = FILES.map((file) => {
    const target = path.join(root, file);
    return fs.existsSync(target) ? fs.readFileSync(target) : null;
  });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-contracts-"));
  const outputs = FILES.map((file) => path.join(temporary, path.basename(file)));
  try {
    run("pnpm", ["--filter", "@isntgram-ai/shared-types", "build"]);
    run("pnpm", ["--filter", "api", "openapi:generate", outputs[0]]);
    run("pnpm", ["exec", "openapi-typescript", outputs[0], "--default-non-nullable=false", "-o", outputs[1]]);
    run("pnpm", [
      "exec",
      "prettier",
      "--ignore-path",
      "/dev/null",
      "--config",
      path.join(root, "apps/api/.prettierrc"),
      "--write",
      outputs[0],
    ]);
    run("pnpm", [
      "exec",
      "prettier",
      "--ignore-path",
      "/dev/null",
      "--config",
      path.join(root, ".prettierrc"),
      "--write",
      outputs[1],
    ]);
    const generated = outputs.map((file) => fs.readFileSync(file));
    const changed = FILES.filter((_, index) => !before[index]?.equals(generated[index]));
    // Refuse a stale check or overwrite if files changed during generation.
    FILES.forEach((file, index) => {
      const target = path.join(root, file);
      const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
      if (before[index] ? current === null || !before[index].equals(current) : current !== null)
        throw new Error(`Contract changed during generation: ${file}`);
    });
    if (mode === "check") {
      if (changed.length)
        throw new Error(
          `Generated contracts differ: ${changed.join(", ")}. Run pnpm contracts:generate and review the changes.`,
        );
      return;
    }
    if (!changed.length) return;
    const backupRoot = path.join(root, ".local", "contract-backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const backup = fs.mkdtempSync(path.join(backupRoot, "before-"));
    FILES.forEach((file, index) => {
      if (before[index] === null) return;
      const target = path.join(backup, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, before[index], { flag: "wx" });
    });
    console.log(`Preserved existing contract bytes: ${backup}`);
    FILES.forEach((file, index) => fs.writeFileSync(path.join(root, file), generated[index]));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (require.main === module) {
  try {
    contracts(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { contracts, FILES };
