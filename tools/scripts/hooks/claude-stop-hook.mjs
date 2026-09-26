#!/usr/bin/env node
// Claude Code Stop hook: before Claude finishes a turn that touched the frontend,
// run the fast checks (lint incl. Sheriff + unit tests). On failure, exit 2 so the
// errors are fed back to Claude to fix. Gives up after MAX_ATTEMPTS consecutive
// failures in a session so it can never loop forever.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runChecks } from '../ci-checks.mjs';

const MAX_ATTEMPTS = 3;
const WATCHED_PATHS = [
  'apps/angular-demo',
  'mylib',
  'sheriff.config.ts',
  'package.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
];

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const counterFile = join(
  tmpdir(),
  `claude-stop-hook-${input.session_id ?? 'unknown'}.txt`
);

if (!hasFrontendChanges()) {
  process.exit(0);
}

const result = runChecks({ capture: true });
if (result.status === 'success') {
  rmSync(counterFile, { force: true });
  process.exit(0);
}

const attempts =
  (existsSync(counterFile) ? Number(readFileSync(counterFile, 'utf8')) : 0) + 1;
if (attempts > MAX_ATTEMPTS) {
  // Let Claude stop; the user sees the failing state and decides.
  rmSync(counterFile, { force: true });
  process.exit(0);
}
writeFileSync(counterFile, String(attempts));

process.stderr.write(
  `Frontend checks failed (attempt ${attempts}/${MAX_ATTEMPTS}). ` +
    `Fix the errors below. For architecture (Sheriff) errors follow ` +
    `docs/angular/architecture-boundaries.md; never loosen sheriff.config.ts or lint rules ` +
    `without asking the user.\n\n${result.message}\n`
);
process.exit(2);

function hasFrontendChanges() {
  try {
    return (
      execSync(`git status --porcelain -- ${WATCHED_PATHS.join(' ')}`, {
        encoding: 'utf8',
      }).trim() !== ''
    );
  } catch {
    return true;
  }
}
