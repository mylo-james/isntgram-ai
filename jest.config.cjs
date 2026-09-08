const { getIncludedCoveragePaths, COVERAGE_THRESHOLD } = require("./scripts/coverage-report.cjs");

// Every project retains its established transformer for its own source. The
// root collector also traverses the other approved runtime paths, so each
// project needs the same path-specific transform map while emitting one root
// summary.
const WEB_TRANSFORM = ["babel-jest", { presets: ["next/babel"] }];
const API_TRANSFORM = [
  "babel-jest",
  {
    presets: [["@babel/preset-env", { targets: { node: "20" } }], "@babel/preset-typescript"],
    plugins: [
      ["@babel/plugin-proposal-decorators", { legacy: true }],
      ["@babel/plugin-transform-class-properties", { loose: true }],
      "babel-plugin-transform-typescript-metadata",
    ],
  },
];
const SHARED_TYPES_TRANSFORM = [
  "babel-jest",
  { presets: [["@babel/preset-env", { targets: { node: "20" } }], "@babel/preset-typescript"] },
];
const COVERAGE_TRANSFORM = {
  "^.+/apps/web/.+\\.(js|jsx|ts|tsx)$": WEB_TRANSFORM,
  "^.+/apps/api/(src|test)/.+\\.(t|j)s$": API_TRANSFORM,
  "^.+/packages/shared-types/src/.+\\.ts$": SHARED_TYPES_TRANSFORM,
};

module.exports = {
  projects: [
    // Next.js Web App
    {
      displayName: "web",
      modulePathIgnorePatterns: ["<rootDir>/.local/"],
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/apps/web/jest.setup.ts"],
      testMatch: ["<rootDir>/apps/web/**/*.test.(js|jsx|ts|tsx)"],
      testPathIgnorePatterns: ["<rootDir>/apps/web/.next/", "<rootDir>/node_modules/"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/apps/web/$1",
        "^@/components/(.*)$": "<rootDir>/apps/web/components/$1",
        "^@/lib/(.*)$": "<rootDir>/apps/web/lib/$1",
        "^@isntgram-ai/shared-types$": "<rootDir>/packages/shared-types/src/index.ts",
        "^next-auth/jwt$": "<rootDir>/apps/web/test/next-auth-jwt.ts",
        "^server-only$": "<rootDir>/apps/web/test/server-only.ts",
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
      transform: COVERAGE_TRANSFORM,
      moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
    },
    // NestJS API
    {
      displayName: "api",
      modulePathIgnorePatterns: ["<rootDir>/.local/"],
      testEnvironment: "node",
      testMatch: ["<rootDir>/apps/api/src/**/*.test.ts", "<rootDir>/apps/api/test/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/apps/api/test/setup.ts"],
      transform: COVERAGE_TRANSFORM,
      moduleFileExtensions: ["js", "json", "ts"],
      moduleNameMapper: {
        "^src/(.*)$": "<rootDir>/apps/api/src/$1",
        "^@isntgram-ai/shared-types$": "<rootDir>/packages/shared-types/src/index.ts",
      },
      testTimeout: 30000, // 30 second timeout for database setup
    },
    // Shared Types
    {
      displayName: "shared-types",
      modulePathIgnorePatterns: ["<rootDir>/.local/"],
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/shared-types/src/**/*.test.ts"],
      transform: COVERAGE_TRANSFORM,
    },
  ],
  // One root inventory and one root summary feed the coverage reporter.
  collectCoverageFrom: getIncludedCoveragePaths(),
  coverageThreshold: {
    global: COVERAGE_THRESHOLD,
  },
  coverageProvider: "babel",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  coverageDirectory: "<rootDir>/coverage",
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results/junit",
        outputName: "jest-junit.xml",
        addFileAttribute: "true",
        ancestorSeparator: " › ",
        suiteNameTemplate: "{filepath}",
      },
    ],
  ],
};
