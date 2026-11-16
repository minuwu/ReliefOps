import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const NO_TIMER =
  'Raw timers hide timing bugs. Use useInterval/useTimeout from @/lib/hooks/useTimers, CSS (scroll-behavior, animation) or a ref callback.';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vite', 'walkthrough'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: NO_TIMER },
        { name: 'setInterval', message: NO_TIMER },
        { name: 'requestAnimationFrame', message: NO_TIMER },
        { name: 'requestIdleCallback', message: NO_TIMER },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useEffect'], CallExpression[callee.name='useLayoutEffect'], CallExpression[callee.object.name='React'][callee.property.name=/^use(Layout)?Effect$/]",
          message: 'useEffect is banned in product code. Use useAsyncResource (data), useInterval/useTimeout (timers), useEventListener (DOM events) from @/lib/hooks, a ref callback, derived state, or an event handler. Missing a case? Add a small wrapper hook inside src/lib/hooks.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned: it opens an XSS hole. Render text or React nodes.',
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name=/^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/]",
          message: NO_TIMER,
        },
      ],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/lib/hooks/**', 'src/services/http.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/pages/*', '**/pages/*'], message: 'Pages are leaves: never import a page from a page or a component.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/types/**', 'src/services/mockData.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
