// ESLint 9 flat config. The repo shipped a `lint` script and the eslint
// dependency without this file, so `npm run lint` could never run.
//
// Type-aware linting via typescript-eslint's `recommendedTypeChecked`: the
// SDK is a thin typed wrapper around the openai package, and the bugs worth
// catching here are the ones types can see — a forgotten `await`, a value
// narrowed to `any` on the way out of a `fetch`.
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "examples/**", "*.config.js", "*.config.ts"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // The build tsconfig excludes tests/ (they must not land in dist), so
        // point the type-aware rules at a lint-only project that covers both.
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // The codebase marks a deliberately unused binding with a leading
      // underscore (`_client` in a type-only test, `_opts` on the clients).
      // Honour that convention rather than rewriting the call sites.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests assert on loosely typed mock payloads; the type-aware rules that
    // police `any` flowing through them add noise without catching bugs.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
