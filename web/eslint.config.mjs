import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pastas de build das janelas, bancos e saídas de teste:
    ".next-s1/**",
    ".next-s2/**",
    ".next-s3/**",
    "data/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
