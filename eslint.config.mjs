import js from '@eslint/js';
import globals from 'globals';

// Renderer types and unused symbols are checked by strict TypeScript; this covers Node code.
export default [
  { ignores: ['node_modules/**', 'dist/**', 'release/**', 'artifacts/**', '.venv/**', '.model-cache/**', '.npm-cache/**'] },
  {
    files: ['**/*.cjs', '**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
    rules: { ...js.configs.recommended.rules, 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  // Playwright serializes these callbacks into the renderer's browser context.
  { files: ['scripts/*smoke.mjs', 'scripts/installed-cache-check.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
