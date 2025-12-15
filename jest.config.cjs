module.exports = {
  projects: [
    // Root-level tests (CI workflow, etc.)
    {
      displayName: "root",
      testEnvironment: "node",
      testMatch: ["<rootDir>/test/**/*.test.ts"],
      modulePathIgnorePatterns: ["<rootDir>/apps/web/.next/"],
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
      modulePathIgnorePatterns: ["<rootDir>/apps/web/.next/"],
      testTimeout: 15000,
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
            // Use the modern automatic JSX runtime to avoid noisy React warnings in tests.
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { node: "current" },
                },
              ],
              ["@babel/preset-react", { runtime: "automatic" }],
              "@babel/preset-typescript",
            ],
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
      modulePathIgnorePatterns: ["<rootDir>/apps/web/.next/"],
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
              ["@babel/plugin-transform-class-properties", { loose: true }],
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
  ],
  // Root-level coverage configuration for combined reports
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
