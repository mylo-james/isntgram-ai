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
      "no-unused-vars": "warn",
      "no-console": "warn",
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
        project: ["./apps/api/tsconfig.json", "./apps/web/tsconfig.json", "./packages/shared-types/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-unused-vars": "off", // Turn off base rule
      "@typescript-eslint/no-unused-vars": "warn",
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true, allowDefinitionFiles: true }],
    },
  },
  // Test files - more lenient rules
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}", "**/e2e/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-console": "off",
    },
  },
];
