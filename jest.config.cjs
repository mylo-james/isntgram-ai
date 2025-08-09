module.exports = {
  projects: [
    // Root-level tests (CI workflow, etc.)
    {
      displayName: "root",
      testEnvironment: "node",
      testMatch: ["<rootDir>/test/**/*.test.ts"],
      transform: {
        "^.+\\.ts$": [
          "babel-jest",
          {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { node: "20" },
                },
              ],
              "@babel/preset-typescript",
            ],
          },
        ],
      },
      moduleFileExtensions: ["ts", "js"],
    },
    // Next.js Web App
    {
      displayName: "web",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/apps/web/jest.setup.ts"],
      testMatch: ["<rootDir>/apps/web/**/*.test.(js|jsx|ts|tsx)"],
      testPathIgnorePatterns: ["<rootDir>/apps/web/.next/", "<rootDir>/node_modules/"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/apps/web/$1",
        "^@/components/(.*)$": "<rootDir>/apps/web/components/$1",
        "^@/lib/(.*)$": "<rootDir>/apps/web/lib/$1",
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
      transform: {
        "^.+\\.(js|jsx|ts|tsx)$": [
          "babel-jest",
          {
            presets: ["next/babel"],
          },
        ],
      },
      moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
      collectCoverageFrom: [
        "apps/web/app/**/*.{js,jsx,ts,tsx}",
        "apps/web/components/**/*.{js,jsx,ts,tsx}",
        "apps/web/lib/**/*.{js,jsx,ts,tsx}",
        "!apps/web/**/*.d.ts",
        "!apps/web/**/node_modules/**",
        "!apps/web/**/*.test.{js,jsx,ts,tsx}",
        "!apps/web/**/test-utils.{js,jsx,ts,tsx}",
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      coverageReporters: ["text", "lcov", "html", "json-summary"],
      coverageDirectory: "<rootDir>/apps/web/coverage",
    },
    // NestJS API
    {
      displayName: "api",
      testEnvironment: "node",
      testMatch: ["<rootDir>/apps/api/src/**/*.test.ts", "<rootDir>/apps/api/test/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/apps/api/test/setup.ts"],
      transform: {
        "^.+\\.(t|j)s$": [
          "babel-jest",
          {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { node: "20" },
                },
              ],
              "@babel/preset-typescript",
            ],
            plugins: [
              ["@babel/plugin-proposal-decorators", { legacy: true }],
              ["@babel/plugin-proposal-class-properties", { loose: true }],
              "babel-plugin-transform-typescript-metadata",
            ],
          },
        ],
      },
      moduleFileExtensions: ["js", "json", "ts"],
      moduleNameMapper: {
        "^src/(.*)$": "<rootDir>/apps/api/src/$1",
      },
      testTimeout: 30000, // 30 second timeout for database setup
      collectCoverageFrom: [
        "apps/api/src/**/*.(t|j)s",
        "!apps/api/src/**/*.spec.ts",
        "!apps/api/src/**/*.test.ts",
        "!apps/api/src/**/main.ts",
        "!apps/api/**/test/**",
        "!apps/api/**/*.d.ts",
        "!apps/api/**/node_modules/**",
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      coverageReporters: ["text", "lcov", "html", "json-summary"],
      coverageDirectory: "<rootDir>/apps/api/coverage",
    },
    // Shared Types
    {
      displayName: "shared-types",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/shared-types/src/**/*.test.ts"],
      transform: {
        "^.+\\.ts$": [
          "babel-jest",
          {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { node: "20" },
                },
              ],
              "@babel/preset-typescript",
            ],
          },
        ],
      },
      collectCoverageFrom: [
        "packages/shared-types/src/**/*.ts",
        "!packages/shared-types/src/**/*.test.ts",
        "!packages/shared-types/src/**/*.d.ts",
      ],
      coverageReporters: ["text", "lcov", "html", "json-summary"],
      coverageDirectory: "<rootDir>/packages/shared-types/coverage",
    },
  ],
  // Removed root-level collectCoverageFrom to prevent cross-project instrumentation
  coverageProvider: "babel",
  // Removed root-level coverageDirectory; each project writes to its own directory
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
