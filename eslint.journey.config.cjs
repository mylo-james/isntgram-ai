const globals = require("./apps/api/node_modules/globals");
module.exports = [
  {
    files: [
      "apps/api/scripts/journey/*.cjs",
      "apps/api/scripts/v1/*.cjs",
      "apps/api/v1-test/*.cjs",
      "scripts/coverage-producer.test.cjs",
      "scripts/coverage-report.cjs",
      "scripts/coverage-report.test.cjs",
      "apps/api/test/test-database-target.cjs",
      "scripts/jest.cjs",
      "scripts/test-env.cjs",
      "scripts/journey-test-env.test.cjs",
      "scripts/contracts.cjs",
      "scripts/contracts.test.cjs",
    ],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
