// Only catches undefined variables (for example a component using a helper it never imported).
// The production build cannot catch these: they crash the page at runtime instead.
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: false },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  globals: { __dirname: 'off' },
  rules: { 'no-undef': 'error' },
  overrides: [{ files: ['**/*.test.mjs', 'analytics/**/*.mjs', 'vite.config.js'], env: { node: true } }],
};
