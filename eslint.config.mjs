import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Plain Node test helpers (the fake AI server for the browser journey) use CommonJS require.
  { files: ["e2e/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // The avatar engine moves three.js objects every frame (that is what a render loop is), which React's render-purity rules misread.
  { files: ["src/features/arya/engine/**"], rules: { "react-hooks/immutability": "off", "react-hooks/set-state-in-effect": "off", "react-hooks/refs": "off", "react-hooks/purity": "off" } },
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
