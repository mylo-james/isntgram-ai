#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const INVENTORY_POLICY = require("./coverage-inventory.json");

const COVERAGE_THRESHOLD = Object.freeze({ statements: 85, branches: 79, functions: 87, lines: 87 });
const SOURCE_EXTENSIONS = new Set(INVENTORY_POLICY.extensions);
const INCLUDED_COVERAGE_PATHS = Object.freeze([...INVENTORY_POLICY.included].sort());
const INCLUDED_COVERAGE_PATH_SET = new Set(INCLUDED_COVERAGE_PATHS);

function normalizePath(filePath, cwd = process.cwd()) {
  const normalized = String(filePath).replaceAll("\\", "/");
  return (path.isAbsolute(normalized) ? path.relative(cwd, normalized) : normalized)
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
}
function isTestPath(filePath) {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);
}
function isDeclarationPath(filePath) {
  return filePath.endsWith(".d.ts");
}
function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : entry.isFile() ? [entryPath] : [];
  });
}
function discoverSourcePaths(cwd = process.cwd()) {
  const paths = new Set();
  for (const root of INVENTORY_POLICY.roots) {
    const absolute = path.resolve(cwd, root);
    if (!fs.existsSync(absolute)) continue;
    if (fs.statSync(absolute).isFile()) {
      paths.add(normalizePath(absolute, cwd));
      continue;
    }
    for (const filePath of walkFiles(absolute)) {
      const relative = normalizePath(filePath, cwd);
      if (SOURCE_EXTENSIONS.has(path.extname(relative))) paths.add(relative);
    }
  }
  return [...paths].sort();
}
function classifySourcePath(filePath) {
  if (INCLUDED_COVERAGE_PATH_SET.has(filePath)) return { path: filePath, included: true, reason: null };
  if (Object.hasOwn(INVENTORY_POLICY.exclusions, filePath))
    return { path: filePath, included: false, reason: INVENTORY_POLICY.exclusions[filePath] };
  if (isTestPath(filePath)) return { path: filePath, included: false, reason: "test code" };
  if (isDeclarationPath(filePath)) return { path: filePath, included: false, reason: "type declaration" };
  return null;
}
function validateCoverageInventory(cwd = process.cwd()) {
  const discovered = discoverSourcePaths(cwd);
  const unclassified = discovered.filter((filePath) => !classifySourcePath(filePath));
  const missingIncluded = INCLUDED_COVERAGE_PATHS.filter((filePath) => !discovered.includes(filePath));
  if (unclassified.length || missingIncluded.length) {
    const parts = [];
    if (unclassified.length) parts.push(`unclassified runtime source: ${unclassified.join(", ")}`);
    if (missingIncluded.length) parts.push(`approved runtime source missing from disk: ${missingIncluded.join(", ")}`);
    throw new Error(`Coverage inventory validation failed: ${parts.join("; ")}`);
  }
  return discovered.map(classifySourcePath);
}
function getCoverageInventory(cwd = process.cwd()) {
  return validateCoverageInventory(cwd);
}
function getIncludedCoveragePaths(cwd = process.cwd()) {
  validateCoverageInventory(cwd);
  return [...INCLUDED_COVERAGE_PATHS];
}
function git(args, runGit = defaultGit) {
  return runGit(args);
}
function defaultGit(args) {
  return childProcess.execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}
function gitRefExists(ref, runGit) {
  try {
    git(["rev-parse", "--verify", ref], runGit);
    return true;
  } catch {
    return false;
  }
}
function gitCommit(ref, runGit) {
  return git(["rev-parse", "--verify", ref], runGit).trim();
}
function resolveBaseRef({ base, env = process.env, runGit = defaultGit } = {}) {
  if (base) {
    if (!gitRefExists(base, runGit)) throw new Error(`Coverage base ref does not exist: ${base}`);
    return base;
  }
  if (env.GITHUB_BASE_REF) {
    const ref = `origin/${env.GITHUB_BASE_REF}`;
    if (!gitRefExists(ref, runGit)) throw new Error(`Coverage base ref does not exist: ${ref}`);
    return ref;
  }
  const origin = gitRefExists("origin/main", runGit);
  const main = gitRefExists("main", runGit);
  if (origin && main) {
    if (gitCommit("origin/main", runGit) !== gitCommit("main", runGit))
      throw new Error("Ambiguous coverage base: origin/main and main differ; use --base <ref>.");
    return "origin/main";
  }
  if (origin) return "origin/main";
  if (main) return "main";
  if (gitRefExists("HEAD~1", runGit)) return "HEAD~1";
  throw new Error("Could not determine a base ref for --changed coverage (use --base <ref>).");
}
function parsePathList(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => normalizePath(line))
    .filter(Boolean);
}
function gitChangedFiles({ base, env, runGit }) {
  const baseRef = resolveBaseRef({ base, env, runGit });
  return [
    ...new Set([
      ...parsePathList(git(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`], runGit)),
      ...parsePathList(git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"], runGit)),
      ...parsePathList(git(["ls-files", "--others", "--exclude-standard"], runGit)),
    ]),
  ].sort();
}
function getChangedFiles({ base, env = process.env, runGit = defaultGit, cwd = process.cwd() } = {}) {
  const actual = gitChangedFiles({ base, env, runGit });
  if (!env.COVERAGE_CHANGED_FILES?.trim()) return actual;
  const explicit = [...new Set(parsePathList(env.COVERAGE_CHANGED_FILES))].sort();
  const discovered = new Set(discoverSourcePaths(cwd));
  for (const filePath of explicit)
    if (
      !fs.existsSync(path.resolve(cwd, filePath)) ||
      (SOURCE_EXTENSIONS.has(path.extname(filePath)) && !discovered.has(filePath))
    )
      throw new Error(`Unverified COVERAGE_CHANGED_FILES path: ${filePath}`);
  if (explicit.length !== actual.length || explicit.some((filePath, index) => filePath !== actual[index]))
    throw new Error("Unverified COVERAGE_CHANGED_FILES does not match the Git change set.");
  return explicit;
}
function isCoveredSourceFile(filePath, cwd = process.cwd()) {
  return INCLUDED_COVERAGE_PATH_SET.has(normalizePath(filePath, cwd));
}
function readCoverageFile(filePath) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
  } catch (error) {
    console.warn(`Could not read coverage file: ${filePath}`, error.message);
    return null;
  }
}
function analyzeCoverage({ onlyFiles, coverageFile = "coverage/coverage-summary.json", cwd = process.cwd() } = {}) {
  const coverage = readCoverageFile(path.resolve(cwd, coverageFile));
  if (!coverage?.total) return { results: [], overall: null, missingFiles: [] };
  const entries = new Map(
    Object.entries(coverage)
      .filter(([filePath]) => filePath !== "total")
      .map(([filePath, data]) => [path.resolve(cwd, filePath), data]),
  );
  const selected = onlyFiles || INCLUDED_COVERAGE_PATHS;
  const results = [];
  const missingFiles = [];
  const totals = Object.fromEntries(Object.keys(COVERAGE_THRESHOLD).map((key) => [key, { covered: 0, total: 0 }]));
  for (const filePath of selected) {
    const relative = normalizePath(filePath, cwd);
    const data = entries.get(path.resolve(cwd, relative));
    if (!data) {
      missingFiles.push(relative);
      continue;
    }
    const result = { file: relative };
    for (const metric of Object.keys(totals)) {
      const value = data[metric] || {};
      result[metric] = Number(value.pct || 0).toFixed(2);
      totals[metric].covered += value.covered || 0;
      totals[metric].total += value.total || 0;
    }
    results.push(result);
  }
  return {
    results,
    missingFiles,
    overall: Object.fromEntries(
      Object.entries(totals).map(([metric, value]) => [
        metric,
        value.total ? ((value.covered / value.total) * 100).toFixed(2) : "100.00",
      ]),
    ),
  };
}
function generateReport({
  argv = process.argv,
  cwd = process.cwd(),
  env = process.env,
  runGit = defaultGit,
  logger = console,
  coverageFile,
} = {}) {
  try {
    validateCoverageInventory(cwd);
    const changed = argv.includes("--changed");
    const baseIndex = argv.indexOf("--base");
    const base = baseIndex >= 0 ? argv[baseIndex + 1] : null;
    const selected = changed
      ? getChangedFiles({ base, env, runGit, cwd }).filter((filePath) => isCoveredSourceFile(filePath, cwd))
      : INCLUDED_COVERAGE_PATHS;
    if (changed && !selected.length) {
      logger.log("✅ No covered source files changed; skipping changed-files coverage gate.");
      return 0;
    }
    const { overall, missingFiles } = analyzeCoverage({ onlyFiles: selected, cwd, coverageFile });
    if (!overall) {
      logger.log("❌ No coverage data found. Run tests with coverage first.");
      return 1;
    }
    if (missingFiles.length) {
      logger.log(
        `❌ Missing coverage entries for executable inventory paths:\n${missingFiles.map((filePath) => `- ${filePath}`).join("\n")}`,
      );
      return 1;
    }
    const below = (values) =>
      Object.entries(COVERAGE_THRESHOLD).some(([metric, threshold]) => Number(values[metric]) < threshold);
    if (below(overall)) {
      logger.log(
        changed ? "❌ Changed-files coverage below threshold." : "❌ Coverage below threshold. Improve test coverage.",
      );
      return 1;
    }
    logger.log(changed ? "✅ Changed-files coverage thresholds met!" : "✅ All coverage thresholds met!");
    return 0;
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
if (require.main === module) process.exitCode = generateReport();
module.exports = {
  COVERAGE_THRESHOLD,
  INCLUDED_COVERAGE_PATHS,
  analyzeCoverage,
  classifySourcePath,
  discoverSourcePaths,
  generateReport,
  getChangedFiles,
  getCoverageInventory,
  getIncludedCoveragePaths,
  isCoveredSourceFile,
  resolveBaseRef,
  validateCoverageInventory,
};
