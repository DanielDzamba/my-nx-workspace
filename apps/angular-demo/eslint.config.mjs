import playwright from 'eslint-plugin-playwright';
import nx from '@nx/eslint-plugin';
import sheriff from '@softarc/eslint-plugin-sheriff';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Modern Angular conventions (see AGENTS.md / docs/angular/coding-conventions.md)
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/use-injectable-provided-in': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.html'],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/no-any': 'error',
      '@angular-eslint/template/button-has-type': 'error',
      '@angular-eslint/template/eqeqeq': 'error',
    },
  },
  // Architecture boundaries: domains x layers, configured in /sheriff.config.ts
  {
    ...sheriff.configs.barrelModulesOnly,
    files: ['**/*.ts'],
  },
  // ui components are presentational: they may only use *types* from the data layer,
  // never stores or clients.
  {
    files: ['**/src/app/domains/*/ui/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data', '**/data/*'],
              allowTypeImports: true,
              message:
                'ui may only import types from the data layer (use `import type`). Stores belong to feature components.',
            },
          ],
        },
      ],
    },
  },
];
