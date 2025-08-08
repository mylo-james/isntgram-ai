#!/usr/bin/env node

/**
 * Coverage reporting script to combine and analyze coverage from all packages
 */

import fs from "fs";
import path from "path";

const COVERAGE_THRESHOLD = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
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

function analyzeCoverage() {
  const coverageFiles = [
    // Root coverage directory (current Jest config)
    "coverage/coverage-final.json",
    "coverage/coverage-summary.json",
    // Fallback to individual app directories
    "apps/web/coverage/coverage-summary.json",
    "apps/api/coverage/coverage-summary.json",
    "packages/shared-types/coverage/coverage-summary.json",
    "apps/web/coverage/coverage-final.json",
    "apps/api/coverage/coverage-final.json",
    "packages/shared-types/coverage/coverage-final.json",
  ];

  const results = [];
  let totalStatements = { covered: 0, total: 0 };
  let totalBranches = { covered: 0, total: 0 };
  let totalFunctions = { covered: 0, total: 0 };
  let totalLines = { covered: 0, total: 0 };

  function coercePercentageFromEntry(entry) {
    if (!entry) return 0;
    const { pct, covered, total } = entry;
    if (pct !== undefined && pct !== null && !Number.isNaN(Number(pct))) {
      return Number(pct);
    }
    if (typeof covered === "number" && typeof total === "number" && total > 0) {
      return (covered / total) * 100;
    }
    return 0;
  }

  for (const file of coverageFiles) {
    const coverage = readCoverageFile(file);
    if (coverage && coverage.total) {
      // Handle root coverage file
      let packageName;
      if (file.startsWith("coverage/")) {
        packageName = "root";
      } else {
        const [scope, pkg] = file.split("/");
        packageName = `${scope}/${pkg}`;
      }
      const total = coverage.total;

      const stmtPct = coercePercentageFromEntry(total.statements);
      const brPct = coercePercentageFromEntry(total.branches);
      const fnPct = coercePercentageFromEntry(total.functions);
      const lnPct = coercePercentageFromEntry(total.lines);

      results.push({
        package: packageName,
        statements: stmtPct.toFixed(2),
        branches: brPct.toFixed(2),
        functions: fnPct.toFixed(2),
        lines: lnPct.toFixed(2),
      });

      totalStatements.covered += total.statements.covered || 0;
      totalStatements.total += total.statements.total || 0;
      totalBranches.covered += total.branches.covered || 0;
      totalBranches.total += total.branches.total || 0;
      totalFunctions.covered += total.functions.covered || 0;
      totalFunctions.total += total.functions.total || 0;
      totalLines.covered += total.lines.covered || 0;
      totalLines.total += total.lines.total || 0;
    } else if (coverage && coverage.coverageMap) {
      // support coverage-final.json shape (istanbul). Derive totals approximately
      const map = coverage.coverageMap;
      // When only coverage-final.json is present, skip strict enforcement and rely on existing thresholds elsewhere
      console.warn(`Found coverage-final.json without summary for: ${file}. Consider enabling json-summary reporter.`);
    }
  }

  const overall = {
    statements:
      totalStatements.total > 0 ? ((totalStatements.covered / totalStatements.total) * 100).toFixed(2) : "0.00",
    branches: totalBranches.total > 0 ? ((totalBranches.covered / totalBranches.total) * 100).toFixed(2) : "0.00",
    functions: totalFunctions.total > 0 ? ((totalFunctions.covered / totalFunctions.total) * 100).toFixed(2) : "0.00",
    lines: totalLines.total > 0 ? ((totalLines.covered / totalLines.total) * 100).toFixed(2) : "0.00",
  };

  return { results, overall };
}

function generateReport() {
  console.log("\n📊 Coverage Report Summary\n");
  console.log("=".repeat(70));

  const { results, overall } = analyzeCoverage();

  if (results.length === 0) {
    console.log("❌ No coverage data found. Run tests with coverage first.");
    process.exit(1);
  }

  console.log("\nPackage Coverage:");
  console.log("-".repeat(70));
  console.log(
    "Package".padEnd(20) + "Statements".padEnd(12) + "Branches".padEnd(12) + "Functions".padEnd(12) + "Lines",
  );
  console.log("-".repeat(70));

  for (const result of results) {
    const stmtColor = parseFloat(result.statements) >= COVERAGE_THRESHOLD.statements ? "✅" : "❌";
    const branchColor = parseFloat(result.branches) >= COVERAGE_THRESHOLD.branches ? "✅" : "❌";
    const funcColor = parseFloat(result.functions) >= COVERAGE_THRESHOLD.functions ? "✅" : "❌";
    const lineColor = parseFloat(result.lines) >= COVERAGE_THRESHOLD.lines ? "✅" : "❌";

    console.log(
      result.package.padEnd(20) +
        `${result.statements}% ${stmtColor}`.padEnd(12) +
        `${result.branches}% ${branchColor}`.padEnd(12) +
        `${result.functions}% ${funcColor}`.padEnd(12) +
        `${result.lines}% ${lineColor}`,
    );
  }

  console.log("\n" + "=".repeat(70));
  console.log("Overall Coverage:");
  console.log("-".repeat(70));

  const overallStmt = parseFloat(overall.statements) >= COVERAGE_THRESHOLD.statements ? "✅" : "❌";
  const overallBranch = parseFloat(overall.branches) >= COVERAGE_THRESHOLD.branches ? "✅" : "❌";
  const overallFunc = parseFloat(overall.functions) >= COVERAGE_THRESHOLD.functions ? "✅" : "❌";
  const overallLine = parseFloat(overall.lines) >= COVERAGE_THRESHOLD.lines ? "✅" : "❌";

  console.log(
    "TOTAL".padEnd(20) +
      `${overall.statements}% ${overallStmt}`.padEnd(12) +
      `${overall.branches}% ${overallBranch}`.padEnd(12) +
      `${overall.functions}% ${overallFunc}`.padEnd(12) +
      `${overall.lines}% ${overallLine}`,
  );

  const belowThreshold = [
    parseFloat(overall.statements) < COVERAGE_THRESHOLD.statements,
    parseFloat(overall.branches) < COVERAGE_THRESHOLD.branches,
    parseFloat(overall.functions) < COVERAGE_THRESHOLD.functions,
    parseFloat(overall.lines) < COVERAGE_THRESHOLD.lines,
  ].some(Boolean);

  console.log("\n" + "=".repeat(70));
  if (belowThreshold) {
    console.log("❌ Coverage below threshold. Improve test coverage.");
    process.exit(1);
  } else {
    console.log("✅ All coverage thresholds met!");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport();
}

export { analyzeCoverage, generateReport };
