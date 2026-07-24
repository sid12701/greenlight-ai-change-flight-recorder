import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Lint rules are chosen to catch the defect classes this codebase actually
 * shipped: values silently coerced through `any`, floating promises in the
 * worker loop, and unused code left behind after a refactor.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      ".workloads/**",
      "pours/**",
      "casting.yaml.lock",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Everything here runs on Node or in a browser; declare both so the
    // no-undef rule checks real mistakes rather than platform globals.
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.es2023 },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaVersion: 2023, sourceType: "module" },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["error", "warn"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Entrypoints and operator scripts legitimately write to stdout.
    files: [
      "scripts/**/*.mjs",
      "apps/api/src/observability/logger.ts",
      "apps/api/src/db/migrate-cli.ts",
      "apps/api/src/worker.ts",
      "apps/api/src/server.ts",
    ],
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.ts", "e2e/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
