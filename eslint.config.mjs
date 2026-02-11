import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noHardcodedTailwindPalette from "./eslint/rules/no-hardcoded-tailwind-palette.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "design-system": {
        rules: {
          "no-hardcoded-tailwind-palette": noHardcodedTailwindPalette,
        },
      },
    },
    rules: {
      "design-system/no-hardcoded-tailwind-palette": "error",
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
