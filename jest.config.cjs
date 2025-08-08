module.exports = {
  projects: [
    // Next.js Web App
    {
      displayName: 'web',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/apps/web/jest.setup.ts'],
      testMatch: ['<rootDir>/apps/web/**/*.(test|spec).(js|jsx|ts|tsx)'],
      testPathIgnorePatterns: [
        '<rootDir>/apps/web/.next/',
        '<rootDir>/node_modules/',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/web/$1',
        '^@/components/(.*)$': '<rootDir>/apps/web/components/$1',
        '^@/lib/(.*)$': '<rootDir>/apps/web/lib/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': [
          'babel-jest',
          {
            presets: ['next/babel'],
          },
        ],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      collectCoverageFrom: [
        'apps/web/app/**/*.{js,jsx,ts,tsx}',
        'apps/web/components/**/*.{js,jsx,ts,tsx}',
        'apps/web/lib/**/*.{js,jsx,ts,tsx}',
        '!apps/web/**/*.d.ts',
        '!apps/web/**/node_modules/**',
        '!apps/web/**/*.test.{js,jsx,ts,tsx}',
        '!apps/web/**/test-utils.{js,jsx,ts,tsx}',
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
      coverageDirectory: '<rootDir>/apps/web/coverage',
    },
    // NestJS API
    {
      displayName: 'api',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/apps/api/src/**/*.(test|spec).ts',
        '<rootDir>/apps/api/test/**/*.(test|spec).ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/apps/api/test/setup.ts'],
      transform: {
        '^.+\\.(t|j)s$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/apps/api/tsconfig.json',
          },
        ],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/apps/api/src/$1',
      },
      collectCoverageFrom: [
        'apps/api/src/**/*.(t|j)s',
        '!apps/api/src/**/*.spec.ts',
        '!apps/api/src/**/*.test.ts',
        '!apps/api/src/**/main.ts',
        '!apps/api/**/test/**',
        '!apps/api/**/*.d.ts',
        '!apps/api/**/node_modules/**',
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
      coverageDirectory: '<rootDir>/apps/api/coverage',
    },
    // Shared Types
    {
      displayName: 'shared-types',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/shared-types/src/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/packages/shared-types/tsconfig.json',
          },
        ],
      },
      collectCoverageFrom: [
        'packages/shared-types/src/**/*.ts',
        '!packages/shared-types/src/**/*.test.ts',
        '!packages/shared-types/src/**/*.d.ts',
      ],
      coverageDirectory: '<rootDir>/packages/shared-types/coverage',
    },
  ],
  collectCoverageFrom: [
    'apps/**/src/**/*.{js,jsx,ts,tsx}',
    'packages/**/src/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
};
