#!/usr/bin/env node

/**
 * Script Validation Utility
 *
 * This repo intentionally uses:
 * - root `build`/`lint` as noops (to avoid workspace-name collisions)
 * - explicit `pnpm`-based entrypoints (`build:all`, `lint:all`, etc.)
 *
 * This script validates that structure stays intact as the repo evolves.
 */

const fs = require("fs");
const path = require("path");

const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class ScriptValidator {
  constructor() {
    this.rootDir = process.cwd();
    this.errors = [];
    this.warnings = [];
    this.packages = {
      root: this.loadPackageJson("package.json"),
      web: this.loadPackageJson("apps/web/package.json"),
      api: this.loadPackageJson("apps/api/package.json"),
    };
  }

  loadPackageJson(relativePath) {
    const fullPath = path.join(this.rootDir, relativePath);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load ${relativePath}: ${error.message}`);
      return { scripts: {} };
    }
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix =
      type === "error" ? `${colors.red}❌` : type === "warning" ? `${colors.yellow}⚠️` : `${colors.green}✅`;
    console.log(`${prefix} ${timestamp} ${message}${colors.reset}`);
  }

  validateRequiredScripts() {
    this.log("Validating required scripts...", "info");

    const requiredRootScripts = [
      "lint",
      "lint:all",
      "type-check",
      "test",
      "build",
      "build:all",
      "dev:web",
      "dev:api",
      "dev:db",
      "dev:all",
      "test:integration",
      "test:e2e",
      "coverage:report",
    ];

    const requiredWebScripts = ["dev", "build", "start", "lint"];
    const requiredApiScripts = ["build", "start:dev", "start:prod", "lint"];

    requiredRootScripts.forEach((scriptName) => {
      if (!this.packages.root.scripts?.[scriptName]) {
        this.errors.push(`Missing required root script: ${scriptName}`);
      }
    });

    requiredWebScripts.forEach((scriptName) => {
      if (!this.packages.web.scripts?.[scriptName]) {
        this.errors.push(`Missing required web script: ${scriptName}`);
      }
    });

    requiredApiScripts.forEach((scriptName) => {
      if (!this.packages.api.scripts?.[scriptName]) {
        this.errors.push(`Missing required api script: ${scriptName}`);
      }
    });
  }

  validateNoStaleSharedTypesReferences() {
    this.log("Validating no stale shared-types references...", "info");

    const forbidden = ["packages/shared-types", "build:shared-types", "lint:shared-types"];
    const scriptsToCheck = [
      ...Object.entries(this.packages.root.scripts || {}),
      ...Object.entries(this.packages.web.scripts || {}).map(([k, v]) => [`web:${k}`, v]),
      ...Object.entries(this.packages.api.scripts || {}).map(([k, v]) => [`api:${k}`, v]),
    ];

    scriptsToCheck.forEach(([scriptName, scriptContent]) => {
      forbidden.forEach((needle) => {
        if (typeof scriptContent === "string" && scriptContent.includes(needle)) {
          this.errors.push(`Stale reference in script '${scriptName}': ${needle}`);
        }
      });
    });
  }

  validateNoopRootScripts() {
    this.log("Validating root script noops...", "info");

    const rootScripts = this.packages.root.scripts || {};

    if (typeof rootScripts.build !== "string" || !rootScripts.build.includes("root build noop")) {
      this.errors.push('root "build" script should be a noop (contain "root build noop")');
    }

    if (typeof rootScripts.lint !== "string" || !rootScripts.lint.includes("root lint noop")) {
      this.errors.push('root "lint" script should be a noop (contain "root lint noop")');
    }
  }

  validateRootScriptPatterns() {
    this.log("Validating root script patterns...", "info");

    const rootScripts = this.packages.root.scripts || {};

    if (rootScripts["build:all"] && !rootScripts["build:all"].includes("pnpm -r")) {
      this.errors.push('build:all should use "pnpm -r"');
    }

    if (rootScripts["lint:all"] && !rootScripts["lint:all"].includes("pnpm -r")) {
      this.errors.push('lint:all should use "pnpm -r"');
    }

    if (rootScripts["test:e2e"]) {
      if (!rootScripts["test:e2e"].includes("pnpm run build:all")) {
        this.errors.push('test:e2e should call "pnpm run build:all"');
      }
      if (!rootScripts["test:e2e"].includes("playwright test")) {
        this.errors.push('test:e2e should run "playwright test"');
      }
    }

    const riskyPatterns = [
      { label: "pnpm run build", regex: /(?:^|\s)pnpm run build(?!:)(?:\s|$)/ },
      { label: "pnpm run lint", regex: /(?:^|\s)pnpm run lint(?!:)(?:\s|$)/ },
      { label: "pnpm run start", regex: /(?:^|\s)pnpm run start(?!:)(?:\s|$)/ },
      { label: "npm run build", regex: /(?:^|\s)npm run build(?!:)(?:\s|$)/ },
      { label: "npm run lint", regex: /(?:^|\s)npm run lint(?!:)(?:\s|$)/ },
      { label: "npm run start", regex: /(?:^|\s)npm run start(?!:)(?:\s|$)/ },
    ];

    Object.entries(rootScripts).forEach(([scriptName, scriptContent]) => {
      if (typeof scriptContent !== "string") return;
      riskyPatterns.forEach(({ label, regex }) => {
        if (regex.test(scriptContent)) {
          this.warnings.push(`root script '${scriptName}' contains a potentially risky pattern: ${label}`);
        }
      });
    });
  }

  run() {
    this.log(`${colors.bold}Starting Script Validation${colors.reset}`, "info");

    this.validateRequiredScripts();
    this.validateNoStaleSharedTypesReferences();
    this.validateNoopRootScripts();
    this.validateRootScriptPatterns();

    console.log("\n" + "=".repeat(60));
    this.log(`${colors.bold}Validation Results${colors.reset}`, "info");

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log("All script validations passed!", "info");
      return true;
    }

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}Errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error) => console.log(`  ${colors.red}• ${error}${colors.reset}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bold}Warnings (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning) => console.log(`  ${colors.yellow}• ${warning}${colors.reset}`));
    }

    console.log("\n" + "=".repeat(60));

    if (this.errors.length > 0) {
      this.log("Script validation failed! Please fix the errors above.", "error");
      return false;
    }

    this.log("Script validation completed with warnings.", "warning");
    return true;
  }
}

if (require.main === module) {
  const validator = new ScriptValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = ScriptValidator;
