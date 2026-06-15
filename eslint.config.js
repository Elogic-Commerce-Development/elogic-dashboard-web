import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks v7 turns on React Compiler correctness rules in
      // its `recommended` preset. Two of them flag deliberate, documented choices in
      // this MVP rather than real bugs, so we disable them here (and only here):
      //
      // - set-state-in-effect: every metric table fetches inside a useEffect keyed on
      //   `filters` and calls setLoading(true) synchronously so the spinner appears
      //   immediately when filters change. This is the intended MVP data-fetching
      //   pattern (see CLAUDE.md: "TanStack Query is NOT used; each table runs a
      //   useEffect on mount + filter changes"). The extra render the rule warns about
      //   is negligible for these small, filter-driven tables. Revisit if/when we move
      //   data fetching to TanStack Query, then re-enable this rule.
      'react-hooks/set-state-in-effect': 'off',
      // - incompatible-library: TanStack Table's useReactTable() returns functions the
      //   React Compiler can't memoize. The advisory isn't actionable without dropping
      //   our chosen headless-table library, so silence it.
      'react-hooks/incompatible-library': 'off',
    },
  },
])
