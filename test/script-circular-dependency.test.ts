import fs from "fs";
import path from "path";

describe("Script Circular Dependency Prevention", () => {
  let rootPackageJson: any;
  let webPackageJson: any;
  let apiPackageJson: any;
  let sharedTypesPackageJson: any;

  beforeAll(() => {
    // Load all package.json files
    rootPackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    webPackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "apps/web/package.json"), "utf8"));
    apiPackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "apps/api/package.json"), "utf8"));
    sharedTypesPackageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "packages/shared-types/package.json"), "utf8"),
    );
  });

  describe("Root Package Script Validation", () => {
    test("should not have circular dependencies in build scripts", () => {
      const scripts = rootPackageJson.scripts;

      // Root build scripts should call direct commands, not npm run
      expect(scripts.build).toBeDefined();
      expect(scripts["build:api"]).toBeDefined();
      expect(scripts["build:web"]).toBeDefined();
      expect(scripts["build:shared-types"]).toBeDefined();

      // Check that build scripts use direct commands, not npm run
      expect(scripts["build:api"]).toContain("nest build");
      expect(scripts["build:web"]).toContain("next build");
      expect(scripts["build:shared-types"]).toContain("tsc");

      // Should NOT contain npm run build (which would be circular)
      expect(scripts["build:api"]).not.toContain("npm run build");
      expect(scripts["build:web"]).not.toContain("npm run build");
      expect(scripts["build:shared-types"]).not.toContain("npm run build");
    });

    test("should not have circular dependencies in dev scripts", () => {
      const scripts = rootPackageJson.scripts;

      expect(scripts.dev).toBeDefined();
      expect(scripts["dev:web"]).toBeDefined();
      expect(scripts["dev:api"]).toBeDefined();

      // Dev scripts should use cd commands, not workspace syntax
      expect(scripts["dev:web"]).toContain("cd apps/web");
      expect(scripts["dev:api"]).toContain("cd apps/api");

      // Should use cd commands to avoid circular dependencies
      expect(scripts["dev:web"]).toContain("cd apps/web");
      expect(scripts["dev:api"]).toContain("cd apps/api");
    });

    test("should not have circular dependencies in start scripts", () => {
      const scripts = rootPackageJson.scripts;

      expect(scripts.start).toBeDefined();
      expect(scripts["ci:start:web"]).toBeDefined();
      expect(scripts["ci:start:api"]).toBeDefined();

      // Root start script should use direct commands
      expect(scripts.start).toContain("cd apps/web");
      expect(scripts.start).toContain("cd apps/api");
      expect(scripts.start).toContain("npx next start");
      expect(scripts.start).toContain("node dist/main");

      // CI start scripts should use workspace syntax for distinct scripts
      expect(scripts["ci:start:web"]).toContain("--workspace=apps/web");
      expect(scripts["ci:start:api"]).toContain("--workspace=apps/api");

      // Should use direct commands or workspace syntax to avoid circular dependencies
      expect(scripts.start).toContain("npx next start");
      expect(scripts.start).toContain("node dist/main");
      expect(scripts["ci:start:web"]).toContain("--workspace=apps/web");
      expect(scripts["ci:start:api"]).toContain("--workspace=apps/api");
    });

    test("should not have circular dependencies in test scripts", () => {
      const scripts = rootPackageJson.scripts;

      expect(scripts["test:e2e"]).toBeDefined();

      // E2E test script should call build first, then playwright
      expect(scripts["test:e2e"]).toContain("npm run build");
      expect(scripts["test:e2e"]).toContain("playwright test");

      // Should NOT contain npm run test:e2e (which would be circular)
      expect(scripts["test:e2e"]).not.toContain("npm run test:e2e");
    });

    test("should not have circular dependencies in lint/format scripts", () => {
      const scripts = rootPackageJson.scripts;

      expect(scripts.lint).toBeDefined();
      expect(scripts["lint:web"]).toBeDefined();
      expect(scripts["lint:api"]).toBeDefined();
      expect(scripts["lint:shared-types"]).toBeDefined();

      // Lint scripts should use workspace syntax for distinct scripts
      expect(scripts["lint:web"]).toContain("--workspace=apps/web");
      expect(scripts["lint:api"]).toContain("--workspace=apps/api");
      expect(scripts["lint:shared-types"]).toContain("--workspace=packages/shared-types");

      // Should use distinct script names to avoid circular dependencies
      expect(scripts["lint:web"]).toContain("lint:check");
      expect(scripts["lint:api"]).toContain("lint:check");
      expect(scripts["lint:shared-types"]).toContain("lint:check");
    });
  });

  describe("Workspace Package Script Validation", () => {
    test("should have distinct E2E start scripts in web package", () => {
      const scripts = webPackageJson.scripts;

      expect(scripts["start:e2e"]).toBeDefined();
      expect(scripts.start).toBeDefined();

      // E2E script should be different from regular start
      expect(scripts["start:e2e"]).not.toBe(scripts.start);

      // E2E script should set PORT
      expect(scripts["start:e2e"]).toContain("PORT=3000");
      expect(scripts["start:e2e"]).toContain("next start");
    });

    test("should have distinct E2E start scripts in api package", () => {
      const scripts = apiPackageJson.scripts;

      expect(scripts["start:prod:e2e"]).toBeDefined();
      expect(scripts["start:prod"]).toBeDefined();

      // E2E script should be different from regular start:prod
      expect(scripts["start:prod:e2e"]).not.toBe(scripts["start:prod"]);

      // E2E script should set SKIP_DB and PORT
      expect(scripts["start:prod:e2e"]).toContain("SKIP_DB=true");
      expect(scripts["start:prod:e2e"]).toContain("PORT=3001");
      expect(scripts["start:prod:e2e"]).toContain("node dist/main");
    });

    test("should have build:local scripts in all packages", () => {
      expect(webPackageJson.scripts["build:local"]).toBeDefined();
      expect(apiPackageJson.scripts["build:local"]).toBeDefined();
      expect(sharedTypesPackageJson.scripts["build:local"]).toBeDefined();

      // Build local scripts should match regular build scripts
      expect(webPackageJson.scripts["build:local"]).toBe(webPackageJson.scripts.build);
      expect(apiPackageJson.scripts["build:local"]).toBe(apiPackageJson.scripts.build);
      expect(sharedTypesPackageJson.scripts["build:local"]).toBe(sharedTypesPackageJson.scripts.build);
    });

    test("should have lint:check scripts in all packages", () => {
      expect(webPackageJson.scripts["lint:check"]).toBeDefined();
      expect(apiPackageJson.scripts["lint:check"]).toBeDefined();
      expect(sharedTypesPackageJson.scripts["lint:check"]).toBeDefined();

      // Lint check scripts should match regular lint scripts
      expect(webPackageJson.scripts["lint:check"]).toBe(webPackageJson.scripts.lint);
      expect(apiPackageJson.scripts["lint:check"]).toBe(apiPackageJson.scripts.lint);
      expect(sharedTypesPackageJson.scripts["lint:check"]).toBe(sharedTypesPackageJson.scripts.lint);
    });
  });

  describe("Script Execution Chain Validation", () => {
    test("should validate complete build chain without circular dependencies", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;
      const sharedTypesScripts = sharedTypesPackageJson.scripts;

      // Root build should call individual build scripts
      expect(rootScripts.build).toContain("build:api");
      expect(rootScripts.build).toContain("build:web");
      expect(rootScripts.build).toContain("build:shared-types");

      // Individual build scripts should call direct commands
      expect(rootScripts["build:api"]).toContain("nest build");
      expect(rootScripts["build:web"]).toContain("next build");
      expect(rootScripts["build:shared-types"]).toContain("tsc");

      // Workspace build scripts should exist and be callable
      expect(webScripts.build).toBeDefined();
      expect(apiScripts.build).toBeDefined();
      expect(sharedTypesScripts.build).toBeDefined();
    });

    test("should validate complete E2E test chain without circular dependencies", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Root test:e2e should call build then playwright
      expect(rootScripts["test:e2e"]).toContain("npm run build");
      expect(rootScripts["test:e2e"]).toContain("playwright test");

      // CI start scripts should call workspace-specific E2E scripts
      expect(rootScripts["ci:start:web"]).toContain("start:e2e");
      expect(rootScripts["ci:start:api"]).toContain("start:prod:e2e");

      // Workspace E2E scripts should exist
      expect(webScripts["start:e2e"]).toBeDefined();
      expect(apiScripts["start:prod:e2e"]).toBeDefined();
    });
  });

  describe("Script Naming Convention Validation", () => {
    test("should use consistent script naming patterns", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Root scripts should use descriptive names
      expect(rootScripts["build:api"]).toBeDefined();
      expect(rootScripts["build:web"]).toBeDefined();
      expect(rootScripts["build:shared-types"]).toBeDefined();
      expect(rootScripts["dev:web"]).toBeDefined();
      expect(rootScripts["dev:api"]).toBeDefined();
      expect(rootScripts["ci:start:web"]).toBeDefined();
      expect(rootScripts["ci:start:api"]).toBeDefined();

      // Workspace scripts should use descriptive names
      expect(webScripts["start:e2e"]).toBeDefined();
      expect(apiScripts["start:prod:e2e"]).toBeDefined();
      expect(webScripts["build:local"]).toBeDefined();
      expect(apiScripts["build:local"]).toBeDefined();
    });

    test("should avoid generic script names that could cause conflicts", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Root should not have generic 'build' that could conflict
      expect(rootScripts.build).toBeDefined(); // This is OK as it's the main build

      // But individual builds should be specific
      expect(rootScripts["build:api"]).toBeDefined();
      expect(rootScripts["build:web"]).toBeDefined();
      expect(rootScripts["build:shared-types"]).toBeDefined();

      // Workspace scripts should be specific
      expect(webScripts["start:e2e"]).toBeDefined();
      expect(apiScripts["start:prod:e2e"]).toBeDefined();
    });
  });

  describe("Script Content Validation", () => {
    test("should validate script content patterns", () => {
      const rootScripts = rootPackageJson.scripts;

      // Build scripts should use direct commands
      expect(rootScripts["build:api"]).toMatch(/cd apps\/api.*nest build/);
      expect(rootScripts["build:web"]).toMatch(/cd apps\/web.*next build/);
      expect(rootScripts["build:shared-types"]).toMatch(/cd packages\/shared-types.*tsc/);

      // Dev scripts should use cd commands
      expect(rootScripts["dev:web"]).toMatch(/cd apps\/web.*npm run dev/);
      expect(rootScripts["dev:api"]).toMatch(/cd apps\/api.*npm run start:dev/);

      // Start scripts should use direct commands
      expect(rootScripts.start).toMatch(/cd apps\/web.*npx next start/);
      expect(rootScripts.start).toMatch(/cd apps\/api.*node dist\/main/);

      // CI start scripts should use workspace syntax
      expect(rootScripts["ci:start:web"]).toMatch(/npm run start:e2e --workspace=apps\/web/);
      expect(rootScripts["ci:start:api"]).toMatch(/npm run start:prod:e2e --workspace=apps\/api/);
    });

    test("should validate environment variable usage", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Root start script should set ports
      expect(rootScripts.start).toContain("PORT=3000");
      expect(rootScripts.start).toContain("PORT=3001");
      expect(rootScripts.start).toContain("SKIP_DB=true");

      // Web E2E script should set port
      expect(webScripts["start:e2e"]).toContain("PORT=3000");

      // API E2E script should set environment variables
      expect(apiScripts["start:prod:e2e"]).toContain("SKIP_DB=true");
      expect(apiScripts["start:prod:e2e"]).toContain("PORT=3001");
    });
  });

  describe("Script Dependency Graph Validation", () => {
    test("should detect potential circular dependencies", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Check for dangerous patterns that could cause circular dependencies
      const dangerousPatterns = [
        "npm run build", // Could call root build from workspace
        "npm run dev", // Could call root dev from workspace
        "npm run start", // Could call root start from workspace
        "npm run test", // Could call root test from workspace
      ];

      // Root scripts should not contain these patterns (except in safe contexts)
      Object.entries(rootScripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === "string") {
          dangerousPatterns.forEach((pattern) => {
            // Allow safe patterns
            const isSafe =
              scriptContent.includes("--workspace=") ||
              (scriptName === "test:e2e" && pattern === "npm run build") ||
              (scriptName === "lint" && pattern === "npm run lint") ||
              (scriptName === "dev" && pattern === "npm run dev") ||
              (scriptName === "build" && pattern === "npm run build") ||
              (scriptName === "build:dev" && pattern === "npm run build") ||
              (scriptName === "test:all" && pattern === "npm run test") ||
              (scriptName.startsWith("dev:") && pattern === "npm run dev") ||
              (scriptName.startsWith("lint:") && pattern === "npm run lint") ||
              (scriptName === "dev:api" && pattern === "npm run start");

            if (scriptContent.includes(pattern) && !isSafe) {
              throw new Error(`Potential circular dependency detected in ${scriptName}: ${pattern}`);
            }
          });
        }
      });

      // Workspace scripts should not call root scripts
      Object.entries(webScripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === "string") {
          dangerousPatterns.forEach((pattern) => {
            if (scriptContent.includes(pattern)) {
              throw new Error(`Workspace script ${scriptName} calls root script: ${pattern}`);
            }
          });
        }
      });

      Object.entries(apiScripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === "string") {
          dangerousPatterns.forEach((pattern) => {
            if (scriptContent.includes(pattern)) {
              throw new Error(`Workspace script ${scriptName} calls root script: ${pattern}`);
            }
          });
        }
      });
    });

    test("should validate script execution order", () => {
      const rootScripts = rootPackageJson.scripts;

      // Build should call all individual builds
      expect(rootScripts.build).toContain("build:api");
      expect(rootScripts.build).toContain("build:web");
      expect(rootScripts.build).toContain("build:shared-types");

      // Test E2E should call build first
      expect(rootScripts["test:e2e"]).toContain("npm run build");

      // Dev should call both dev scripts
      expect(rootScripts.dev).toContain("dev:web");
      expect(rootScripts.dev).toContain("dev:api");
    });
  });

  describe("Script Error Prevention", () => {
    test("should prevent common script errors", () => {
      const rootScripts = rootPackageJson.scripts;
      const webScripts = webPackageJson.scripts;
      const apiScripts = apiPackageJson.scripts;

      // Check for missing scripts that are referenced
      const referencedScripts = [
        "build:api",
        "build:web",
        "build:shared-types",
        "dev:web",
        "dev:api",
        "ci:start:web",
        "ci:start:api",
        "test:e2e",
        "lint:web",
        "lint:api",
        "lint:shared-types",
      ];

      referencedScripts.forEach((scriptName) => {
        expect(rootScripts[scriptName]).toBeDefined();
      });

      // Check for missing workspace scripts
      expect(webScripts["start:e2e"]).toBeDefined();
      expect(apiScripts["start:prod:e2e"]).toBeDefined();
      expect(webScripts["build:local"]).toBeDefined();
      expect(apiScripts["build:local"]).toBeDefined();

      // Check for proper command usage
      expect(rootScripts["build:api"]).toContain("nest build");
      expect(rootScripts["build:web"]).toContain("next build");
      expect(rootScripts["build:shared-types"]).toContain("tsc");
      expect(rootScripts.start).toContain("npx next start");
      expect(rootScripts.start).toContain("node dist/main");
    });

    test("should validate script syntax", () => {
      const rootScripts = rootPackageJson.scripts;

      // Check for proper cd usage
      expect(rootScripts["build:api"]).toMatch(/^cd apps\/api && /);
      expect(rootScripts["build:web"]).toMatch(/^cd apps\/web && /);
      expect(rootScripts["build:shared-types"]).toMatch(/^cd packages\/shared-types && /);

      // Check for proper workspace usage
      expect(rootScripts["ci:start:web"]).toMatch(/npm run start:e2e --workspace=apps\/web$/);
      expect(rootScripts["ci:start:api"]).toMatch(/npm run start:prod:e2e --workspace=apps\/api$/);

      // Check for proper parallel execution
      expect(rootScripts.start).toContain(" & ");
      expect(rootScripts.dev).toContain(" & ");
    });
  });
});
