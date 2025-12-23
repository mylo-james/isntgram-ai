#!/usr/bin/env node

/**
 * Coverage reporting script to analyze Jest coverage.
 *
 * Supports:
 * - Default mode: enforce combined thresholds from coverage/coverage-summary.json
 * - --changed mode: enforce thresholds on changed source files only
 */

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const COVERAGE_THRESHOLD = {
  statements: 95,
  branches: 90,
  functions: 95,
  lines: 95,
};

function readCoverageFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (error) {
    console.warn(`Could not read coverage file: ${filePath}`, error.message);
  }
  return null;
}

function parseArgs(argv) {
  const args = { changed: false, base: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--changed") args.changed = true;
    if (token === "--base") {
      args.base = argv[i + 1] || null;
      i += 1;
    }
  }
  return args;
}

function git(command) {
  return childProcess.execSync(`git ${command}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function gitRefExists(ref) {
  try {
    git(`rev-parse --verify ${ref}`);
    return true;
  } catch {
    return false;
  }
}

function getChangedFiles({ base } = {}) {
  const fromEnv = process.env.COVERAGE_CHANGED_FILES;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const baseRef =
    base ||
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null) ||
    (gitRefExists("origin/main") ? "origin/main" : null) ||
    (gitRefExists("main") ? "main" : null) ||
    (gitRefExists("HEAD~1") ? "HEAD~1" : null);

  if (!baseRef) {
    throw new Error("Could not determine a base ref for --changed coverage (use --base <ref>).");
  }

  return git(`diff --name-only --diff-filter=ACMR ${baseRef}...HEAD`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isCoveredSourceFile(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (!/\.(ts|tsx|js|jsx)$/.test(normalized)) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(normalized)) return false;

  // Align with collectCoverageFrom in jest.config.cjs
  if (normalized.startsWith("apps/web/")) {
    return (
      normalized.startsWith("apps/web/app/") ||
      normalized.startsWith("apps/web/components/") ||
      normalized.startsWith("apps/web/lib/")
    );
  }

  if (normalized.startsWith("apps/api/src/")) {
    if (normalized.endsWith("/main.ts")) return false;
    return true;
  }

  if (normalized.startsWith("packages/shared-types/src/")) {
    if (normalized.endsWith("/openapi.ts")) return false;
    return true;
  }

  return false;
}

function analyzeCoverage({ onlyFiles } = {}) {
  const coverageFile = "coverage/coverage-summary.json";

  const coverage = readCoverageFile(coverageFile);
  if (!coverage || !coverage.total) return { results: [], overall: null, missingFiles: [] };

  const byAbsPath = new Map();
  for (const [filePath, fileData] of Object.entries(coverage)) {
    if (filePath === "total") continue;
    byAbsPath.set(path.resolve(filePath), fileData);
  }

  const results = [];
  const missingFiles = [];
  let totalStatements = { covered: 0, total: 0 };
  let totalBranches = { covered: 0, total: 0 };
  let totalFunctions = { covered: 0, total: 0 };
  let totalLines = { covered: 0, total: 0 };

  const filesToReport = Array.isArray(onlyFiles) ? onlyFiles : Array.from(byAbsPath.keys());

  for (const filePath of filesToReport) {
    const abs = path.resolve(filePath);
    const fileData = byAbsPath.get(abs);

    if (!fileData) {
      missingFiles.push(filePath);
      continue;
    }

    const relativePath = path.relative(process.cwd(), abs);
    results.push({
      file: relativePath,
      statements: (fileData.statements.pct || 0).toFixed(2),
      branches: (fileData.branches.pct || 0).toFixed(2),
      functions: (fileData.functions.pct || 0).toFixed(2),
      lines: (fileData.lines.pct || 0).toFixed(2),
    });

    totalStatements.covered += fileData.statements.covered || 0;
    totalStatements.total += fileData.statements.total || 0;
    totalBranches.covered += fileData.branches.covered || 0;
    totalBranches.total += fileData.branches.total || 0;
    totalFunctions.covered += fileData.functions.covered || 0;
    totalFunctions.total += fileData.functions.total || 0;
    totalLines.covered += fileData.lines.covered || 0;
    totalLines.total += fileData.lines.total || 0;
  }

  const overall = {
    statements:
      totalStatements.total > 0 ? ((totalStatements.covered / totalStatements.total) * 100).toFixed(2) : "100.00",
    branches: totalBranches.total > 0 ? ((totalBranches.covered / totalBranches.total) * 100).toFixed(2) : "100.00",
    functions: totalFunctions.total > 0 ? ((totalFunctions.covered / totalFunctions.total) * 100).toFixed(2) : "100.00",
    lines: totalLines.total > 0 ? ((totalLines.covered / totalLines.total) * 100).toFixed(2) : "100.00",
  };

  return { results, overall, missingFiles };
}

function printTable(results) {
  console.log("File".padEnd(52) + "Statements".padEnd(12) + "Branches".padEnd(12) + "Functions".padEnd(12) + "Lines");
  console.log("-".repeat(100));

  const sorted = [...results].sort((a, b) => parseFloat(a.lines) - parseFloat(b.lines));
  for (const result of sorted) {
    const stmtOk = parseFloat(result.statements) >= COVERAGE_THRESHOLD.statements ? "✅" : "❌";
    const branchOk = parseFloat(result.branches) >= COVERAGE_THRESHOLD.branches ? "✅" : "❌";
    const funcOk = parseFloat(result.functions) >= COVERAGE_THRESHOLD.functions ? "✅" : "❌";
    const lineOk = parseFloat(result.lines) >= COVERAGE_THRESHOLD.lines ? "✅" : "❌";

    console.log(
      result.file.padEnd(52) +
        `${result.statements}% ${stmtOk}`.padEnd(12) +
        `${result.branches}% ${branchOk}`.padEnd(12) +
        `${result.functions}% ${funcOk}`.padEnd(12) +
        `${result.lines}% ${lineOk}`,
    );
  }
}

function isBelowThreshold(pctString, threshold) {
  return parseFloat(pctString) < threshold;
}

function generateReport() {
  const args = parseArgs(process.argv);

  console.log("\n📊 Coverage Report Summary\n");
  console.log("=".repeat(70));

  if (args.changed) {
    const changedFiles = getChangedFiles({ base: args.base }).filter(isCoveredSourceFile);

    if (changedFiles.length === 0) {
      console.log("✅ No covered source files changed; skipping changed-files coverage gate.");
      return;
    }

    const { results, overall, missingFiles } = analyzeCoverage({ onlyFiles: changedFiles });
    if (!overall) {
      console.log("❌ No coverage data found. Run tests with coverage first.");
      process.exit(1);
    }

    console.log("\nChanged Files Coverage:");
    console.log("-".repeat(70));
    printTable(results);

    if (missingFiles.length > 0) {
      console.log("\n❌ Missing coverage entries for changed files:");
      for (const file of missingFiles) console.log(`- ${file}`);
      process.exit(1);
    }

    const anyFileBelow = results.some(
      (r) =>
        isBelowThreshold(r.statements, COVERAGE_THRESHOLD.statements) ||
        isBelowThreshold(r.branches, COVERAGE_THRESHOLD.branches) ||
        isBelowThreshold(r.functions, COVERAGE_THRESHOLD.functions) ||
        isBelowThreshold(r.lines, COVERAGE_THRESHOLD.lines),
    );

    console.log("\n" + "=".repeat(70));
    console.log("Changed Files Overall:");
    console.log("-".repeat(70));
    console.log(
      "TOTAL".padEnd(20) +
        `${overall.statements}%`.padEnd(12) +
        `${overall.branches}%`.padEnd(12) +
        `${overall.functions}%`.padEnd(12) +
        `${overall.lines}%`,
    );

    const overallBelow =
      isBelowThreshold(overall.statements, COVERAGE_THRESHOLD.statements) ||
      isBelowThreshold(overall.branches, COVERAGE_THRESHOLD.branches) ||
      isBelowThreshold(overall.functions, COVERAGE_THRESHOLD.functions) ||
      isBelowThreshold(overall.lines, COVERAGE_THRESHOLD.lines);

    if (anyFileBelow || overallBelow) {
      console.log("❌ Changed-files coverage below threshold.");
      process.exit(1);
    }

    console.log("✅ Changed-files coverage thresholds met!");
    return;
  }

  const { results, overall } = analyzeCoverage();
  if (!overall || results.length === 0) {
    console.log("❌ No coverage data found. Run tests with coverage first.");
    process.exit(1);
  }

  console.log("\nFile Coverage:");
  console.log("-".repeat(70));
  printTable(results);

  console.log("\n" + "=".repeat(70));
  console.log("Overall Coverage:");
  console.log("-".repeat(70));
  console.log(
    "TOTAL".padEnd(20) +
      `${overall.statements}%`.padEnd(12) +
      `${overall.branches}%`.padEnd(12) +
      `${overall.functions}%`.padEnd(12) +
      `${overall.lines}%`,
  );

  const belowThreshold =
    isBelowThreshold(overall.statements, COVERAGE_THRESHOLD.statements) ||
    isBelowThreshold(overall.branches, COVERAGE_THRESHOLD.branches) ||
    isBelowThreshold(overall.functions, COVERAGE_THRESHOLD.functions) ||
    isBelowThreshold(overall.lines, COVERAGE_THRESHOLD.lines);

  console.log("\n" + "=".repeat(70));
  if (belowThreshold) {
    console.log("❌ Coverage below threshold. Improve test coverage.");
    process.exit(1);
  }

  console.log("✅ All coverage thresholds met!");
}

if (require.main === module) {
  generateReport();
}

module.exports = { analyzeCoverage, generateReport, getChangedFiles };
