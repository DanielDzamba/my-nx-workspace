import { sameTag, SheriffConfig } from '@softarc/sheriff-core';

/**
 * Architecture boundaries of the Angular frontend (angular-demo).
 * Rationale and how-to: docs/angular/architecture-boundaries.md
 *
 * Every folder listed here is a module; its index.ts is the public API
 * (deep imports into another module are lint errors).
 */
export const config: SheriffConfig = {
  entryPoints: {
    'angular-demo': 'apps/angular-demo/src/main.ts',
  },
  modules: {
    'apps/angular-demo/src/app/domains/<domain>': {
      'feature-<feature>': ['domain:<domain>', 'type:feature'],
      ui: ['domain:<domain>', 'type:ui'],
      data: ['domain:<domain>', 'type:data'],
      util: ['domain:<domain>', 'type:util'],
    },
    // Workspace library, consumed through the @mylib path alias.
    'mylib/src': ['domain:shared', 'type:ui'],
  },
  depRules: {
    // App shell (main.ts, app.*): wires features into routes and provides config.
    root: ['type:feature', 'domain:shared'],

    // Domains are isolated from each other; everyone may use `shared`.
    'domain:*': [sameTag, 'domain:shared'],

    // Layers only depend downwards.
    'type:feature': ['type:ui', 'type:data', 'type:util'],
    // ui may import models from data, but only as `import type` (see eslint.config.mjs).
    'type:ui': ['type:data', 'type:util'],
    'type:data': ['type:util'],
    'type:util': [],
  },
};
