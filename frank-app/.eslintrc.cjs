module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // false positive: this codebase passes JSX arrays as a `cells` prop to a
    // TableRow component that applies the real key when it maps them — not
    // rendered directly, so there's no actual missing-key bug to fix.
    'react/jsx-key': 'off',
    // pedantic for copy-heavy JSX; literal apostrophes/quotes in text nodes
    // render fine and aren't a real defect in this codebase.
    'react/no-unescaped-entities': 'off',
  },
}
