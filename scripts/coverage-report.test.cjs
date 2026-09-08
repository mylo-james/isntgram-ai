const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const report = require("./coverage-report.cjs");
const jestConfig = require("../jest.config.cjs");

const metric = (covered, total) => ({ covered, total, pct: total ? (covered / total) * 100 : 100 });
function withTemp(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "isntgram-coverage-"));
  try {
    return run(cwd);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}
function writeSummary(cwd, entries) {
  const dir = path.join(cwd, "coverage");
  fs.mkdirSync(dir, { recursive: true });
  const summary = {
    total: { statements: metric(0, 1), branches: metric(0, 1), functions: metric(0, 1), lines: metric(0, 1) },
  };
  for (const [filePath, covered, total] of entries)
    summary[path.join(cwd, filePath)] = {
      statements: metric(covered, total),
      branches: metric(covered, total),
      functions: metric(covered, total),
      lines: metric(covered, total),
    };
  fs.writeFileSync(path.join(dir, "coverage-summary.json"), JSON.stringify(summary));
}
function gitMock(values) {
  return (args) => {
    const key = args.join(" ");
    if (!Object.hasOwn(values, key)) throw new Error(`unexpected git command: ${key}`);
    return values[key];
  };
}

test("discovery classifies the current 153-path baseline and all current runtime additions", () => {
  const inventory = report.getCoverageInventory();
  assert.ok(
    inventory.filter((entry) => entry.included).length >= 153,
    "the established runtime baseline must not disappear",
  );
  assert.ok(report.INCLUDED_COVERAGE_PATHS.includes("apps/web/proxy.ts"));
  assert.ok(report.INCLUDED_COVERAGE_PATHS.includes("apps/api/src/posts/dto/create-post.dto.ts"));
  assert.ok(report.INCLUDED_COVERAGE_PATHS.includes("apps/web/components/ui/ErrorNotice.tsx"));
  assert.ok(inventory.filter((entry) => !entry.included).every((entry) => entry.reason));
});

test("the root collector is the producer contract for the root reporter summary", () => {
  assert.deepEqual(jestConfig.collectCoverageFrom, report.INCLUDED_COVERAGE_PATHS);
  assert.equal(jestConfig.coverageDirectory, "<rootDir>/coverage");
  assert.ok(jestConfig.coverageReporters.includes("json-summary"));
  assert.ok(
    jestConfig.projects.every(
      (project) => project.collectCoverageFrom === undefined && project.coverageDirectory === undefined,
    ),
  );
  for (const name of ["web", "api"])
    assert.equal(
      jestConfig.projects.find((project) => project.displayName === name).moduleNameMapper[
        "^@isntgram-ai/shared-types$"
      ],
      "<rootDir>/packages/shared-types/src/index.ts",
    );
});

test("the reporter recognizes a zero-entry proxy and fails a missing executable entry", () =>
  withTemp((cwd) => {
    writeSummary(cwd, [["apps/web/proxy.ts", 0, 4]]);
    const zero = report.analyzeCoverage({ onlyFiles: ["apps/web/proxy.ts"], cwd });
    assert.deepEqual(zero.missingFiles, []);
    assert.equal(zero.results[0].statements, "0.00");
    const reporterCoverageFile = path.join(cwd, "reporter-summary.json");
    const reporterSummary = {
      total: { statements: metric(0, 1), branches: metric(0, 1), functions: metric(0, 1), lines: metric(0, 1) },
    };
    reporterSummary[path.join(process.cwd(), "apps/web/proxy.ts")] = {
      statements: metric(4, 4),
      branches: metric(4, 4),
      functions: metric(4, 4),
      lines: metric(4, 4),
    };
    fs.writeFileSync(reporterCoverageFile, JSON.stringify(reporterSummary));
    const messages = [];
    const code = report.generateReport({
      argv: ["node", "coverage-report.cjs"],
      cwd: process.cwd(),
      coverageFile: reporterCoverageFile,
      logger: { log: (value) => messages.push(value), error: (value) => messages.push(value) },
    });
    assert.equal(code, 1);
    assert.ok(messages.join("\n").includes("Missing coverage entries"));
  }));

test("changed paths use argv-safe Git calls and include committed, dirty and untracked files", () => {
  const runGit = gitMock({
    "rev-parse --verify origin/main": "base\n",
    "rev-parse --verify main": "base\n",
    "diff --name-only --diff-filter=ACMR origin/main...HEAD": "apps/api/src/auth/auth.service.ts\n",
    "diff --name-only --diff-filter=ACMR HEAD": "apps/web/proxy.ts\n",
    "ls-files --others --exclude-standard": "apps/web/components/ui/ErrorNotice.tsx\nnotes.txt\n",
  });
  assert.deepEqual(report.getChangedFiles({ env: {}, runGit }), [
    "apps/api/src/auth/auth.service.ts",
    "apps/web/components/ui/ErrorNotice.tsx",
    "apps/web/proxy.ts",
    "notes.txt",
  ]);
});

test("an explicit changed override must match the actual Git change set", () => {
  const runGit = gitMock({
    "rev-parse --verify origin/main": "base\n",
    "rev-parse --verify main": "base\n",
    "diff --name-only --diff-filter=ACMR origin/main...HEAD": "apps/web/proxy.ts\n",
    "diff --name-only --diff-filter=ACMR HEAD": "",
    "ls-files --others --exclude-standard": "",
  });
  assert.throws(
    () => report.getChangedFiles({ env: { COVERAGE_CHANGED_FILES: "apps/web/lib/not-real.ts" }, runGit }),
    /Unverified COVERAGE_CHANGED_FILES/,
  );
  assert.deepEqual(report.getChangedFiles({ env: { COVERAGE_CHANGED_FILES: "apps/web/proxy.ts" }, runGit }), [
    "apps/web/proxy.ts",
  ]);
});

test("ambiguous bases require an explicit ref", () => {
  const runGit = gitMock({ "rev-parse --verify origin/main": "origin\n", "rev-parse --verify main": "local\n" });
  assert.throws(() => report.resolveBaseRef({ env: {}, runGit }), /Ambiguous coverage base/);
});

test("Jest and the reporter share the same overall threshold policy", () => {
  assert.deepEqual(jestConfig.coverageThreshold.global, report.COVERAGE_THRESHOLD);
});

test("overall coverage passes with a low individual file and fails below each metric minimum", () =>
  withTemp((cwd) => {
    const coverageFile = path.join(cwd, "summary.json");
    const makeSummary = () => {
      const summary = { total: {} };
      report.INCLUDED_COVERAGE_PATHS.forEach((file, index) => {
        summary[path.join(process.cwd(), file)] = Object.fromEntries(
          Object.entries(report.COVERAGE_THRESHOLD).map(([name, threshold]) => [
            name,
            metric(index === 0 ? 0 : threshold + 1, 100),
          ]),
        );
      });
      return summary;
    };
    const run = (summary) => {
      fs.writeFileSync(coverageFile, JSON.stringify(summary));
      return report.generateReport({ cwd: process.cwd(), argv: [], coverageFile, logger: { log() {}, error() {} } });
    };
    assert.equal(run(makeSummary()), 0);
    for (const [name, threshold] of Object.entries(report.COVERAGE_THRESHOLD)) {
      const summary = makeSummary();
      for (const file of report.INCLUDED_COVERAGE_PATHS)
        summary[path.join(process.cwd(), file)][name] = metric(threshold - 1, 100);
      assert.equal(run(summary), 1, `${name} below minimum must fail`);
    }
  }));
