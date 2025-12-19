const globals = require("globals");

const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      ".next/**",
      "eslint.config.js",
      "jest.setup.cjs",
      "next.config.mjs",
      "node_modules/**",
      "out/**",
      "tailwind.config.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // This project does not opt into React Compiler; avoid noise from compiler-compat heuristics.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/__tests__/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
