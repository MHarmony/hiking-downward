import '@angular/localize/init';

/** Describes the optional translation hook used by the test environment. */
type LocalizeGlobal = typeof globalThis & {
  $localize: {
    translate?: (
      messageParts: TemplateStringsArray,
      expressions: readonly unknown[],
    ) => [TemplateStringsArray, readonly unknown[]];
  };
};

/** Uses Angular's localize global and preserves messages unchanged when no translator is installed. */
const localize = (globalThis as LocalizeGlobal).$localize;
localize.translate ??= (messageParts, expressions): [TemplateStringsArray, readonly unknown[]] => [
  messageParts,
  expressions,
];
