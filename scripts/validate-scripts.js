#!/usr/bin/env node

/**
 * Script Validation Utility
 *
 * This script validates npm scripts across the monorepo to prevent:
 * - Circular dependencies
 * - Missing scripts
 * - Incorrect script patterns
 * - Workspace conflicts
 */

const fs = require("fs");
const path = require("path");

// ANSI color codes for output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
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
      sharedTypes: this.loadPackageJson("packages/shared-types/package.json"),
    };
  }

  loadPackageJson(relativePath) {
    try {
      const fullPath = path.join(this.rootDir, relativePath);
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

  validateCircularDependencies() {
    this.log("Validating circular dependencies...", "info");

    const dangerousPatterns = ["npm run build", "npm run dev", "npm run start", "npm run test", "npm run lint"];

    // Check root scripts
    Object.entries(this.packages.root.scripts || {}).forEach(([scriptName, scriptContent]) => {
      dangerousPatterns.forEach((pattern) => {
        if (scriptContent.includes(pattern) && !scriptContent.includes("--workspace=")) {
          this.errors.push(`Potential circular dependency in root script '${scriptName}': ${pattern}`);
        }
      });
    });

    // Check workspace scripts
    ["web", "api", "sharedTypes"].forEach((pkgName) => {
      const pkg = this.packages[pkgName];
      Object.entries(pkg.scripts || {}).forEach(([scriptName, scriptContent]) => {
        dangerousPatterns.forEach((pattern) => {
          if (scriptContent.includes(pattern)) {
            this.errors.push(`Workspace script '${pkgName}:${scriptName}' calls root script: ${pattern}`);
          }
        });
      });
    });
  }

  validateRequiredScripts() {
    this.log("Validating required scripts...", "info");

    const requiredRootScripts = [
      "build",
      "build:api",
      "build:web",
      "build:shared-types",
      "dev",
      "dev:web",
      "dev:api",
      "start",
      "ci:start:web",
      "ci:start:api",
      "test:e2e",
      "lint",
      "lint:web",
      "lint:api",
      "lint:shared-types",
    ];

    const requiredWebScripts = ["start:e2e", "build:local"];
    const requiredApiScripts = ["start:prod:e2e", "build:local"];
    const requiredSharedTypesScripts = ["build:local"];

    // Check root scripts
    requiredRootScripts.forEach((scriptName) => {
      if (!this.packages.root.scripts[scriptName]) {
        this.errors.push(`Missing required root script: ${scriptName}`);
      }
    });

    // Check workspace scripts
    requiredWebScripts.forEach((scriptName) => {
      if (!this.packages.web.scripts[scriptName]) {
        this.errors.push(`Missing required web script: ${scriptName}`);
      }
    });

    requiredApiScripts.forEach((scriptName) => {
      if (!this.packages.api.scripts[scriptName]) {
        this.errors.push(`Missing required api script: ${scriptName}`);
      }
    });

    requiredSharedTypesScripts.forEach((scriptName) => {
      if (!this.packages.sharedTypes.scripts[scriptName]) {
        this.errors.push(`Missing required shared-types script: ${scriptName}`);
      }
    });
  }

  validateScriptPatterns() {
    this.log("Validating script patterns...", "info");

    const rootScripts = this.packages.root.scripts;

    // Validate build scripts use direct commands
    if (rootScripts["build:api"] && !rootScripts["build:api"].includes("nest build")) {
      this.errors.push('build:api should use "nest build" command');
    }
    if (rootScripts["build:web"] && !rootScripts["build:web"].includes("next build")) {
      this.errors.push('build:web should use "next build" command');
    }
    if (rootScripts["build:shared-types"] && !rootScripts["build:shared-types"].includes("tsc")) {
      this.errors.push('build:shared-types should use "tsc" command');
    }

    // Validate dev scripts use cd commands
    if (rootScripts["dev:web"] && !rootScripts["dev:web"].includes("cd apps/web")) {
      this.errors.push('dev:web should use "cd apps/web" command');
    }
    if (rootScripts["dev:api"] && !rootScripts["dev:api"].includes("cd apps/api")) {
      this.errors.push('dev:api should use "cd apps/api" command');
    }

    // Validate start scripts
    if (rootScripts.start && !rootScripts.start.includes("npx next start")) {
      this.errors.push('root start script should use "npx next start"');
    }
    if (rootScripts.start && !rootScripts.start.includes("node dist/main")) {
      this.errors.push('root start script should use "node dist/main"');
    }

    // Validate CI start scripts use workspace syntax
    if (rootScripts["ci:start:web"] && !rootScripts["ci:start:web"].includes("--workspace=apps/web")) {
      this.errors.push("ci:start:web should use --workspace=apps/web syntax");
    }
    if (rootScripts["ci:start:api"] && !rootScripts["ci:start:api"].includes("--workspace=apps/api")) {
      this.errors.push("ci:start:api should use --workspace=apps/api syntax");
    }
  }

  validateEnvironmentVariables() {
    this.log("Validating environment variables...", "info");

    const rootScripts = this.packages.root.scripts;
    const webScripts = this.packages.web.scripts;
    const apiScripts = this.packages.api.scripts;

    // Check root start script has proper environment variables
    if (rootScripts.start) {
      if (!rootScripts.start.includes("PORT=3000")) {
        this.warnings.push("root start script should set PORT=3000 for web");
      }
      if (!rootScripts.start.includes("PORT=3001")) {
        this.warnings.push("root start script should set PORT=3001 for api");
      }
      if (!rootScripts.start.includes("SKIP_DB=true")) {
        this.warnings.push("root start script should set SKIP_DB=true for api");
      }
    }

    // Check web E2E script has port
    if (webScripts["start:e2e"] && !webScripts["start:e2e"].includes("PORT=3000")) {
      this.warnings.push("web start:e2e script should set PORT=3000");
    }

    // Check api E2E script has environment variables
    if (apiScripts["start:prod:e2e"]) {
      if (!apiScripts["start:prod:e2e"].includes("SKIP_DB=true")) {
        this.warnings.push("api start:prod:e2e script should set SKIP_DB=true");
      }
      if (!apiScripts["start:prod:e2e"].includes("PORT=3001")) {
        this.warnings.push("api start:prod:e2e script should set PORT=3001");
      }
    }
  }

  validateScriptExecutionOrder() {
    this.log("Validating script execution order...", "info");

    const rootScripts = this.packages.root.scripts;

    // Check build script calls all individual builds
    if (rootScripts.build) {
      ["build:api", "build:web", "build:shared-types"].forEach((script) => {
        if (!rootScripts.build.includes(script)) {
          this.errors.push(`build script should call ${script}`);
        }
      });
    }

    // Check test:e2e calls build first
    if (rootScripts["test:e2e"] && !rootScripts["test:e2e"].includes("npm run build")) {
      this.errors.push('test:e2e should call "npm run build" first');
    }

    // Check dev calls both dev scripts
    if (rootScripts.dev) {
      ["dev:web", "dev:api"].forEach((script) => {
        if (!rootScripts.dev.includes(script)) {
          this.errors.push(`dev script should call ${script}`);
        }
      });
    }
  }

  validateWorkspaceScripts() {
    this.log("Validating workspace scripts...", "info");

    // Check that workspace scripts are distinct
    if (this.packages.web.scripts["start:e2e"] === this.packages.web.scripts.start) {
      this.errors.push("web start:e2e should be different from web start");
    }
    if (this.packages.api.scripts["start:prod:e2e"] === this.packages.api.scripts["start:prod"]) {
      this.errors.push("api start:prod:e2e should be different from api start:prod");
    }

    // Check build:local scripts match regular build scripts
    ["web", "api", "sharedTypes"].forEach((pkgName) => {
      const pkg = this.packages[pkgName];
      if (pkg.scripts["build:local"] && pkg.scripts.build) {
        if (pkg.scripts["build:local"] !== pkg.scripts.build) {
          this.warnings.push(`${pkgName} build:local should match build script`);
        }
      }
    });
  }

  run() {
    this.log(`${colors.bold}Starting Script Validation${colors.reset}`, "info");

    this.validateCircularDependencies();
    this.validateRequiredScripts();
    this.validateScriptPatterns();
    this.validateEnvironmentVariables();
    this.validateScriptExecutionOrder();
    this.validateWorkspaceScripts();

    // Report results
    console.log("\n" + "=".repeat(60));
    this.log(`${colors.bold}Validation Results${colors.reset}`, "info");

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log("All script validations passed! 🎉", "info");
      return true;
    }

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}Errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error) => {
        console.log(`  ${colors.red}• ${error}${colors.reset}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bold}Warnings (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning) => {
        console.log(`  ${colors.yellow}• ${warning}${colors.reset}`);
      });
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

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new ScriptValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = ScriptValidator;
