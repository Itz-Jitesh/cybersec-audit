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
    /**
     * Nothing under src/components/ may reach the server sanitiser.
     * These files are Client Components or are imported by them, and their
     * module graph is still loaded during SSR — where jsdom fails, twice now
     * (ENOENT on its default stylesheet, ERR_REQUIRE_ESM out of
     * html-encoding-sniffer). The pure helpers live in the core module.
     */
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/utils/sanitize-html",
              message:
                "Barrel re-exports the server sanitiser. Import pure helpers from @/lib/utils/sanitize-html-core, or sanitize with @/lib/utils/sanitize-html-client.",
            },
            {
              name: "@/lib/utils/sanitize-html-server",
              message:
                "jsdom cannot load in a Client Component's SSR pass. Use @/lib/utils/sanitize-html-client.",
            },
          ],
        },
      ],
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
