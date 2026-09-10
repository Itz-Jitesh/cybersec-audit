import { FlatCompat } from "@eslint/eslintrc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // The verification and end-to-end builds write here, and build output is
      // not source. Without this, eslint lints minified bundles.
      ".next-*/**",
      "out/**",
      "test-results/**",
      "playwright-report/**",
      "build/**",
      "drizzle/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
  {
    // shadcn/ui primitives are vendored source with their own conventions.
    // Their prop signatures must not be modified, so they are not linted for
    // import order.
    files: ["src/components/ui/**"],
    rules: {
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off",
    },
  },
];

export default eslintConfig;
