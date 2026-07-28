import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These React-Compiler lint rules are too strict for legitimate uses of
    // browser/platform APIs in this app: reading the current time for "wilting"
    // calculations (purity), and syncing external systems like the Web Speech
    // API into state on mount (set-state-in-effect). Keep them as warnings so
    // production builds aren't blocked, without losing the signal entirely.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
