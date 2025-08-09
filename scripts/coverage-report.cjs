#!/usr/bin/env node

/**
 * Coverage reporting script to combine and analyze coverage from all packages
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

function readCoverageFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Could not read coverage file: ${filePath}`, error.message);
  }
  return null;
}

function analyzeCoverage() {
  const coverageFiles = [
    'apps/web/coverage/coverage-summary.json',
    'apps/api/coverage/coverage-summary.json',
    'packages/shared-types/coverage/coverage-summary.json',
  ];

  const results = [];
  let totalStatements = { covered: 0, total: 0 };
  let totalBranches = { covered: 0, total: 0 };
  let totalFunctions = { covered: 0, total: 0 };
  let totalLines = { covered: 0, total: 0 };

  for (const file of coverageFiles) {
    const coverage = readCoverageFile(file);
    if (coverage && coverage.total) {
      const packageName = file.split('/')[0] + '/' + file.split('/')[1];
      const total = coverage.total;

      results.push({
        package: packageName,
        statements: (total.statements.pct || 0).toFixed(2),
        branches: (total.branches.pct || 0).toFixed(2),
        functions: (total.functions.pct || 0).toFixed(2),
        lines: (total.lines.pct || 0).toFixed(2),
      });

      totalStatements.covered += total.statements.covered || 0;
      totalStatements.total += total.statements.total || 0;
      totalBranches.covered += total.branches.covered || 0;
      totalBranches.total += total.branches.total || 0;
      totalFunctions.covered += total.functions.covered || 0;
      totalFunctions.total += total.functions.total || 0;
      totalLines.covered += total.lines.covered || 0;
      totalLines.total += total.lines.total || 0;
    }
  }

  // Calculate overall percentages
  const overall = {
    statements:
      totalStatements.total > 0
        ? ((totalStatements.covered / totalStatements.total) * 100).toFixed(2)
        : '0.00',
    branches:
      totalBranches.total > 0
        ? ((totalBranches.covered / totalBranches.total) * 100).toFixed(2)
        : '0.00',
    functions:
      totalFunctions.total > 0
        ? ((totalFunctions.covered / totalFunctions.total) * 100).toFixed(2)
        : '0.00',
    lines:
      totalLines.total > 0
        ? ((totalLines.covered / totalLines.total) * 100).toFixed(2)
        : '0.00',
  };

  return { results, overall };
}

function generateReport() {
  console.log('\n📊 Coverage Report Summary\n');
  console.log('='.repeat(70));

  const { results, overall } = analyzeCoverage();

  if (results.length === 0) {
    console.log('❌ No coverage data found. Run tests with coverage first.');
    process.exit(1);
  }

  // Package-level results
  console.log('\nPackage Coverage:');
  console.log('-'.repeat(70));
  console.log(
    'Package'.padEnd(20) +
      'Statements'.padEnd(12) +
      'Branches'.padEnd(12) +
      'Functions'.padEnd(12) +
      'Lines'
  );
  console.log('-'.repeat(70));

  for (const result of results) {
    const stmtColor =
      parseFloat(result.statements) >= COVERAGE_THRESHOLD.statements
        ? '✅'
        : '❌';
    const branchColor =
      parseFloat(result.branches) >= COVERAGE_THRESHOLD.branches ? '✅' : '❌';
    const funcColor =
      parseFloat(result.functions) >= COVERAGE_THRESHOLD.functions
        ? '✅'
        : '❌';
    const lineColor =
      parseFloat(result.lines) >= COVERAGE_THRESHOLD.lines ? '✅' : '❌';

    console.log(
      result.package.padEnd(20) +
        `${result.statements}% ${stmtColor}`.padEnd(12) +
        `${result.branches}% ${branchColor}`.padEnd(12) +
        `${result.functions}% ${funcColor}`.padEnd(12) +
        `${result.lines}% ${lineColor}`
    );
  }

  // Overall results
  console.log('\n' + '='.repeat(70));
  console.log('Overall Coverage:');
  console.log('-'.repeat(70));

  const overallStmt =
    parseFloat(overall.statements) >= COVERAGE_THRESHOLD.statements
      ? '✅'
      : '❌';
  const overallBranch =
    parseFloat(overall.branches) >= COVERAGE_THRESHOLD.branches ? '✅' : '❌';
  const overallFunc =
    parseFloat(overall.functions) >= COVERAGE_THRESHOLD.functions ? '✅' : '❌';
  const overallLine =
    parseFloat(overall.lines) >= COVERAGE_THRESHOLD.lines ? '✅' : '❌';

  console.log(
    'TOTAL'.padEnd(20) +
      `${overall.statements}% ${overallStmt}`.padEnd(12) +
      `${overall.branches}% ${overallBranch}`.padEnd(12) +
      `${overall.functions}% ${overallFunc}`.padEnd(12) +
      `${overall.lines}% ${overallLine}`
  );

  // Threshold check
  const belowThreshold = [
    parseFloat(overall.statements) < COVERAGE_THRESHOLD.statements,
    parseFloat(overall.branches) < COVERAGE_THRESHOLD.branches,
    parseFloat(overall.functions) < COVERAGE_THRESHOLD.functions,
    parseFloat(overall.lines) < COVERAGE_THRESHOLD.lines,
  ].some(Boolean);

  console.log('\n' + '='.repeat(70));
  if (belowThreshold) {
    console.log('❌ Coverage below threshold. Improve test coverage.');
    process.exit(1);
  } else {
    console.log('✅ All coverage thresholds met!');
  }
}

if (require.main === module) {
  generateReport();
}

module.exports = { analyzeCoverage, generateReport };
