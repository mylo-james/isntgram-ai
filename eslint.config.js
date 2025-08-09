import tseslint from "typescript-eslint";

export default [
  // JavaScript files
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["node_modules/**", "playwright.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "error",
      "no-console": "error",
    },
  },
  // TypeScript files
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["apps/**/**/*.{ts,tsx}", "packages/**/**/*.{ts,tsx}"],
    ignores: ["node_modules/**"],
  })),
  {
    files: ["apps/**/**/*.{ts,tsx}", "packages/**/**/*.{ts,tsx}"],
    ignores: ["node_modules/**", "playwright.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        project: [
          "./apps/api/tsconfig.eslint.json",
          "./apps/web/tsconfig.eslint.json",
          "./packages/shared-types/tsconfig.eslint.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-unused-vars": "off", // Turn off base rule
      "@typescript-eslint/no-unused-vars": "error",
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true, allowDefinitionFiles: true }],
    },
  },
  // Test files - more lenient rules
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}", "**/e2e/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tseslint.parser,
      // Do not require a project for tests; we only need syntax parsing here
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-console": "off",
    },
  },
];
