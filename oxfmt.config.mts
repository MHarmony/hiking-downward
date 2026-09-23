import { defineConfig } from "oxfmt";

/** Oxfmt configuration for the HikingDownward workspace. */
export default defineConfig({
  arrowParens: "always",
  bracketSameLine: true,
  bracketSpacing: true,
  embeddedLanguageFormatting: "auto",
  endOfLine: "lf",
  experimentalOperatorPosition: "end",
  htmlWhitespaceSensitivity: "ignore",
  insertFinalNewline: true,
  jsdoc: true,
  printWidth: 100,
  quoteProps: "as-needed",
  semi: true,
  singleAttributePerLine: false,
  singleQuote: true,
  sortTailwindcss: true,
  trailingComma: "all",
  useTabs: false,
  overrides: [{ files: ["**/*.ng.html"], language: "angular" }],
});
