import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Only the two long-standing hook rules, not the React Compiler ruleset
      // that eslint-plugin-react-hooks v7 turns on by default. Those extra
      // rules assume the compiler's whole-program analysis; without it they
      // misread this file — reporting `performance.now()` inside an event
      // handler as an impure render, and `camera.isActive` (a useState value)
      // as a ref read, merely because useCamera also returns a ref. Turn them
      // on the day this project adopts React Compiler, not before.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // CLAUDE.md: avoid `any`. Escaping it should be a deliberate, visible act.
      "@typescript-eslint/no-explicit-any": "error",

      // An unused argument named with a leading underscore is documentation,
      // not dead code — it says the callback receives a value we ignore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Formatting is Prettier's job. Listed last so it switches off every ESLint
  // rule that would otherwise argue with it.
  prettierConfig,
);
