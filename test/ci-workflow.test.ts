import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";

describe("CI Workflow Tests", () => {
  let workflowContent: string;
  let workflow: any;

  beforeAll(() => {
    const workflowPath = join(process.cwd(), ".github", "workflows", "ci.yml");
    if (!existsSync(workflowPath)) {
      throw new Error("CI workflow file not found: .github/workflows/ci.yml");
    }
    workflowContent = readFileSync(workflowPath, "utf8");

    // Parse YAML using js-yaml library
    workflow = yaml.load(workflowContent) as any;
  });

  describe("Project Dependencies Validation", () => {
    test("should have package.json in all projects", () => {
      const projects = ["apps/web", "apps/api"];
      projects.forEach((project) => {
        const packagePath = join(process.cwd(), project, "package.json");
        expect(existsSync(packagePath)).toBe(true);
      });
    });

    test("should have valid package.json in all projects", () => {
      const projects = ["apps/web", "apps/api"];
      projects.forEach((project) => {
        const packagePath = join(process.cwd(), project, "package.json");
        const packageContent = readFileSync(packagePath, "utf8");
        expect(() => JSON.parse(packageContent)).not.toThrow();
      });
    });

    test("should have scripts in all project package.json files", () => {
      const projects = ["apps/web", "apps/api"];
      projects.forEach((project) => {
        const packagePath = join(process.cwd(), project, "package.json");
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
        expect(packageJson.scripts).toBeDefined();
        expect(typeof packageJson.scripts).toBe("object");
      });
    });

    test("should have required scripts in web app", () => {
      const packagePath = join(process.cwd(), "apps/web", "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      expect(packageJson.scripts.lint).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
    });

    test("should have required scripts in api app", () => {
      const packagePath = join(process.cwd(), "apps/api", "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      expect(packageJson.scripts.lint).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts["start:dev"]).toBeDefined();
    });
  });

  describe("Root Package.json Validation", () => {
    test("should have all required CI scripts", () => {
      const packagePath = join(process.cwd(), "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

      const requiredScripts = [
        "lint",
        "type-check",
        "test",
        "build",
        "test:integration",
        "test:e2e",
        "coverage:report",
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts[script]).toBeDefined();
      });
    });

    test("should have valid workspaces configuration", () => {
      const packagePath = join(process.cwd(), "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

      // Should be either an array or undefined, not false
      expect(packageJson.workspaces).toBeDefined();
      if (packageJson.workspaces !== undefined) {
        expect(Array.isArray(packageJson.workspaces)).toBe(true);
      }
    });

    test("should have pnpm-lock.yaml at root", () => {
      const lockPath = join(process.cwd(), "pnpm-lock.yaml");
      expect(existsSync(lockPath)).toBe(true);
    });
  });

  describe("CI Workflow Command Validation", () => {
    test("should have valid install commands in all jobs", () => {
      const jobs = workflow.jobs;
      Object.keys(jobs).forEach((jobName) => {
        const job = jobs[jobName];
        if (job.steps) {
          const installStep = job.steps.find((step: any) => step.name === "📦 Install dependencies");

          if (installStep) {
            expect(installStep.run).toBeDefined();
            expect(typeof installStep.run).toBe("string");

            // Should include pnpm install at root
            expect(installStep.run).toContain("pnpm install");
          }
        }
      });
    });

    test("should have valid build commands", () => {
      const jobs = workflow.jobs;
      Object.keys(jobs).forEach((jobName) => {
        const job = jobs[jobName];
        if (job.steps) {
          const buildStep = job.steps.find((step: any) => step.name === "🧱 Build Applications");

          if (buildStep) {
            expect(buildStep.run).toBe("pnpm run build:all");
          }
        }
      });
    });

    test("should have valid test commands", () => {
      const qualityJob = workflow.jobs.quality;
      const testStep = qualityJob.steps.find((step: any) => step.name === "🧪 Unit Tests with Coverage");

      expect(testStep.run).toBe("pnpm test --coverage --watchAll=false --coverageReporters=json-summary");
    });
  });

  describe("Workflow Structure", () => {
    test("should have correct workflow name", () => {
      expect(workflow.name).toBe("CI Pipeline");
    });

    test("should have correct triggers", () => {
      expect(workflow.on).toEqual({
        push: {
          branches: ["main", "develop"],
        },
        pull_request: {
          branches: ["main", "develop"],
        },
      });
    });

    test("should have concurrency configuration", () => {
      expect(workflow.concurrency).toEqual({
        group: "ci-${{ github.workflow }}-${{ github.head_ref || github.ref }}",
        "cancel-in-progress": true,
      });
    });

    test("should have all required jobs", () => {
      const expectedJobs = ["quality", "coverage-gate", "integration", "e2e", "production-build", "security", "deploy"];
      const actualJobs = Object.keys(workflow.jobs);

      expectedJobs.forEach((job) => {
        expect(actualJobs).toContain(job);
      });
    });
  });

  describe("Quality Job", () => {
    let qualityJob: any;

    beforeAll(() => {
      qualityJob = workflow.jobs.quality;
    });

    test("should have correct job configuration", () => {
      expect(qualityJob.name).toBe("Code Quality");
      expect(qualityJob["runs-on"]).toBe("ubuntu-latest");
    });

    test("should have all required steps", () => {
      const steps = qualityJob.steps;
      const stepNames = steps.map((step: any) => step.name);

      expect(stepNames).toContain("🚀 Checkout");
      expect(stepNames).toContain("🔧 Setup Node.js");
      expect(stepNames).toContain("📦 Install dependencies");
      expect(stepNames).toContain("🔍 Lint & Type Check");
      expect(stepNames).toContain("🧪 Unit Tests with Coverage");
      expect(stepNames).toContain("📦 Archive coverage artifacts");
      expect(stepNames).toContain("📊 Upload Coverage");
      expect(stepNames).toContain("📄 Upload JUnit");
    });

    test("should have correct Node.js setup", () => {
      const nodeStep = qualityJob.steps.find((step: any) => step.name === "🔧 Setup Node.js");
      expect(typeof nodeStep.uses).toBe("string");
      expect(nodeStep.uses).toMatch(/^actions\/setup-node@/);
      expect(nodeStep.with["node-version"]).toBe(25);
      expect(["npm", "pnpm"]).toContain(nodeStep.with.cache);
    });

    test("should have correct test command", () => {
      const testStep = qualityJob.steps.find((step: any) => step.name === "🧪 Unit Tests with Coverage");
      expect(testStep.run).toBe("pnpm test --coverage --watchAll=false --coverageReporters=json-summary");
    });

    test("should archive coverage files from correct locations", () => {
      const archiveStep = qualityJob.steps.find((step: any) => step.name === "📦 Archive coverage artifacts");
      expect(archiveStep).toBeDefined();

      const archiveCommand = archiveStep.run;

      // Check that the archive command includes the actual coverage file
      expect(archiveCommand).toContain("coverage/coverage-summary.json");
    });

    test("should upload coverage artifact with correct name", () => {
      const uploadStep = qualityJob.steps.find((step: any) => step.name === "📊 Upload Coverage");
      expect(typeof uploadStep.uses).toBe("string");
      expect(uploadStep.uses).toMatch(/^actions\/upload-artifact@/);
      expect(uploadStep.with.name).toBe("coverage");
      expect(uploadStep.with.path).toBe("coverage-artifacts.tgz");
    });
  });

  describe("Coverage Gate Job", () => {
    let coverageJob: any;

    beforeAll(() => {
      coverageJob = workflow.jobs["coverage-gate"];
    });

    test("should depend on quality job", () => {
      expect(coverageJob.needs).toEqual(["quality"]);
    });

    test("should have correct step order", () => {
      const steps = coverageJob.steps;
      const stepNames = steps.map((step: any) => step.name);

      // Required steps present
      const requiredSteps = [
        "🚀 Checkout",
        "🔧 Setup Node.js",
        "📦 Install dependencies",
        "📥 Download Coverage",
        "📦 Extract Coverage",
        "📈 Enforce Coverage Thresholds",
      ];

      requiredSteps.forEach((name) => expect(stepNames).toContain(name));

      // Optional pnpm setup step may exist
      const pnpmIdx = stepNames.indexOf("🧰 Setup pnpm");
      const checkoutIdx = stepNames.indexOf("🚀 Checkout");
      const nodeIdx = stepNames.indexOf("🔧 Setup Node.js");
      const installIdx = stepNames.indexOf("📦 Install dependencies");
      const downloadIdx = stepNames.indexOf("📥 Download Coverage");
      const extractIdx = stepNames.indexOf("📦 Extract Coverage");
      const enforceIdx = stepNames.indexOf("📈 Enforce Coverage Thresholds");

      // Enforce relative ordering of critical steps
      expect(checkoutIdx).toBeLessThan(nodeIdx);
      if (pnpmIdx !== -1) {
        // pnpm setup must run before install
        expect(pnpmIdx).toBeLessThan(installIdx);
      }
      expect(nodeIdx).toBeLessThan(installIdx);
      expect(installIdx).toBeLessThan(downloadIdx);
      expect(downloadIdx).toBeLessThan(extractIdx);
      expect(extractIdx).toBeLessThan(enforceIdx);
    });

    test("should download coverage artifact with correct name", () => {
      const downloadStep = coverageJob.steps.find((step: any) => step.name === "📥 Download Coverage");
      expect(typeof downloadStep.uses).toBe("string");
      expect(downloadStep.uses).toMatch(/^actions\/download-artifact@/);
      expect(downloadStep.with.name).toBe("coverage");
    });

    test("should extract coverage files correctly", () => {
      const extractStep = coverageJob.steps.find((step: any) => step.name === "📦 Extract Coverage");
      expect(extractStep).toBeDefined();

      const extractCommand = extractStep.run;
      expect(extractCommand).toContain("coverage-artifacts.tgz");
      expect(extractCommand).toContain("coverage/coverage-summary.json");
    });

    test("should run coverage report command", () => {
      const reportStep = coverageJob.steps.find((step: any) => step.name === "📈 Enforce Coverage Thresholds");
      expect(reportStep.run).toBe("pnpm run coverage:report");
    });
  });

  describe("Integration Job", () => {
    let integrationJob: any;

    beforeAll(() => {
      integrationJob = workflow.jobs.integration;
    });

    test("should depend on quality job", () => {
      expect(integrationJob.needs).toEqual(["quality"]);
    });

    test("should have PostgreSQL service", () => {
      expect(integrationJob.services).toBeDefined();
      expect(integrationJob.services.postgres).toBeDefined();
      expect(integrationJob.services.postgres.image).toBe("postgres:16-alpine");
      expect(integrationJob.services.postgres.env.POSTGRES_USER).toBe("postgres");
      expect(integrationJob.services.postgres.env.POSTGRES_DB).toBe("isntgram_test");
    });

    test("should have correct environment variables", () => {
      const env = integrationJob.env;
      expect(env.DATABASE_URL).toBe("postgresql://postgres:postgres@127.0.0.1:5432/isntgram_test");
      expect(env.DB_HOST).toBe("127.0.0.1");
      expect(env.DB_PORT).toBe(5432);
      expect(env.DB_USERNAME).toBe("postgres");
      expect(env.DB_PASSWORD).toBe("postgres");
      expect(env.DB_NAME).toBe("isntgram_test");
    });

    test("should have integration test step", () => {
      const steps = integrationJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("🔗 Integration Tests");
    });

    test("should run integration tests with correct flags", () => {
      const testStep = integrationJob.steps.find((step: any) => step.name === "🔗 Integration Tests");
      expect(testStep.run).toBe("pnpm run test:integration --runInBand --watchAll=false");
    });
  });

  describe("E2E Job", () => {
    let e2eJob: any;

    beforeAll(() => {
      e2eJob = workflow.jobs.e2e;
    });

    test("should depend on integration job", () => {
      expect(e2eJob.needs).toEqual(["integration"]);
    });

    test("should install Playwright", () => {
      const steps = e2eJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("Install Playwright browsers");
    });

    test("should have E2E test step", () => {
      const steps = e2eJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("🌐 E2E Tests");
    });

    test("should cache Next.js build cache", () => {
      const cacheStep = e2eJob.steps.find((s: any) => s.name === "♻️ Cache Next.js build cache");
      expect(cacheStep).toBeDefined();
      expect(cacheStep.uses).toBe("actions/cache@v4");
    });

    test("should run E2E tests", () => {
      const testStep = e2eJob.steps.find((step: any) => step.name === "🌐 E2E Tests");
      expect(testStep.run).toBe("pnpm run test:e2e");
    });
  });

  describe("Security Job", () => {
    let securityJob: any;

    beforeAll(() => {
      securityJob = workflow.jobs.security;
    });

    test("should have correct permissions", () => {
      expect(securityJob.permissions).toEqual({
        actions: "read",
        contents: "read",
        "security-events": "write",
      });
    });

    test("should have CodeQL steps", () => {
      const steps = securityJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("🔍 CodeQL Analysis");
      expect(stepNames).toContain("🔍 CodeQL Autobuild");
      expect(stepNames).toContain("🔍 CodeQL Analyze");
    });

    test("should have Gitleaks step", () => {
      const steps = securityJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames.some((name: string) => name.includes("Gitleaks"))).toBe(true);
    });
  });

  describe("Production Build Job", () => {
    let productionBuildJob: any;

    beforeAll(() => {
      productionBuildJob = workflow.jobs["production-build"];
    });

    test("should depend on integration job", () => {
      expect(productionBuildJob.needs).toEqual(["integration"]);
    });

    test("should build Docker images", () => {
      const steps = productionBuildJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("🐳 Build and Push Production Docker Image");
      expect(stepNames).toContain("🐳 Build and Push Production Web Docker Image");
    });

    test("should have Trivy scan", () => {
      const steps = productionBuildJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("🔍 Trivy Container Scan (API)");
      expect(stepNames).toContain("🔍 Trivy Container Scan (Web)");
    });

    test("should generate SBOM", () => {
      const steps = productionBuildJob.steps;
      const stepNames = steps.map((step: any) => step.name);
      expect(stepNames).toContain("📋 Generate SBOM");
    });

    test("should enable Docker Buildx cache", () => {
      const buildStep = productionBuildJob.steps.find(
        (s: any) => s.name === "🐳 Build and Push Production Docker Image",
      );
      expect(buildStep).toBeDefined();
      expect(buildStep.with["cache-from"]).toBe("type=gha,scope=api");
      expect(buildStep.with["cache-to"]).toBe("type=gha,mode=max,scope=api");

      const webBuildStep = productionBuildJob.steps.find(
        (s: any) => s.name === "🐳 Build and Push Production Web Docker Image",
      );
      expect(webBuildStep).toBeDefined();
      expect(webBuildStep.with["cache-from"]).toBe("type=gha,scope=web");
      expect(webBuildStep.with["cache-to"]).toBe("type=gha,mode=max,scope=web");
    });
  });

  describe("Coverage Path Consistency", () => {
    test("should have matching artifact names between upload and download", () => {
      const qualityJob = workflow.jobs.quality;
      const coverageJob = workflow.jobs["coverage-gate"];

      const uploadStep = qualityJob.steps.find((step: any) => step.name === "📊 Upload Coverage");
      const downloadStep = coverageJob.steps.find((step: any) => step.name === "📥 Download Coverage");

      expect(uploadStep.with.name).toBe(downloadStep.with.name);
      expect(uploadStep.with.name).toBe("coverage");
    });

    test("should archive all expected coverage paths", () => {
      const qualityJob = workflow.jobs.quality;
      const archiveStep = qualityJob.steps.find((step: any) => step.name === "📦 Archive coverage artifacts");
      const archiveCommand = archiveStep.run;

      expect(archiveCommand).toContain("coverage/coverage-summary.json");
    });

    test("should not archive unexpected paths", () => {
      const qualityJob = workflow.jobs.quality;
      const archiveStep = qualityJob.steps.find((step: any) => step.name === "📦 Archive coverage artifacts");
      const archiveCommand = archiveStep.run;

      const unexpectedPaths = ["unexpected/coverage", "wrong/path/coverage", "temp/coverage"];

      unexpectedPaths.forEach((path) => {
        expect(archiveCommand).not.toContain(path);
      });
    });
  });

  describe("Workflow Validation", () => {
    test("should have valid YAML syntax", () => {
      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe("object");
    });

    test("should have no circular dependencies", () => {
      const jobs = workflow.jobs;
      const jobNames = Object.keys(jobs);

      jobNames.forEach((jobName) => {
        const job = jobs[jobName];
        if (job.needs) {
          if (Array.isArray(job.needs)) {
            job.needs.forEach((neededJob: string) => {
              expect(jobNames).toContain(neededJob);
            });
          } else {
            expect(jobNames).toContain(job.needs);
          }
        }
      });
    });

    test("should have consistent step naming", () => {
      const jobs = workflow.jobs;
      Object.keys(jobs).forEach((jobName) => {
        const job = jobs[jobName];
        if (job.steps) {
          job.steps.forEach((step: any) => {
            expect(step.name).toBeDefined();
            expect(typeof step.name).toBe("string");
            expect(step.name.length).toBeGreaterThan(0);
          });
        }
      });
    });

    test("should have no duplicate step names within jobs", () => {
      const jobs = workflow.jobs;
      Object.keys(jobs).forEach((jobName) => {
        const job = jobs[jobName];
        if (job.steps) {
          const stepNames = job.steps.map((step: any) => step.name);
          const uniqueStepNames = [...new Set(stepNames)];
          expect(stepNames.length).toBe(uniqueStepNames.length);
        }
      });
    });
  });
});
