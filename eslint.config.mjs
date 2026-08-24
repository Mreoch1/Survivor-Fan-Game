import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["app/components/AppShell.tsx"],
    rules: {
      // vinext client-side prefetching broke hosted navigation. These deliberate
      // document navigations keep every page usable on the production runtime.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["app/cast/page.tsx", "app/play/play-client.tsx"],
    rules: {
      // Cast portraits are small, local static assets; plain images also avoid
      // relying on an optimizer that the vinext runtime does not provide.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
