#!/usr/bin/env node
// Deterministic frontend checks shared by the Claude Code Stop hook and humans.
//
//   node tools/scripts/ci-checks.mjs          fast: format, lint (incl. Sheriff boundaries), typecheck,
//                                             unit tests with coverage thresholds
//   node tools/scripts/ci-checks.mjs --full   fast + production build + Playwright e2e (Chromium)
//
// Keep in sync with .github/workflows/ci.yml.
//
// runChecks() never throws; it returns { status: 'success' } or { status: 'error', message },
// so any agent hook can translate the result into its own protocol.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECTS = 'angular-demo,mylib';
const MAX_MESSAGE_CHARS = 8000;
const ANSI_ESCAPE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

const nx = (target, args = '') =>
  `npx nx run-many -t ${target} -p ${PROJECTS} --outputStyle=static ${args}`.trim();

// Separate steps keep the failure output focused on the failing target.
const fastSteps = [
  `npx nx format:check --projects=${PROJECTS}`,
  nx('lint'),
  nx('typecheck'),
  nx('test'),
];
const fullOnlySteps = [
  nx('build'),
  'npx nx e2e angular-demo --outputStyle=static -- --project=chromium',
];

export function runChecks({ full = false, capture = false } = {}) {
  const steps = full ? [...fastSteps, ...fullOnlySteps] : fastSteps;
  for (const step of steps) {
    const result = spawnSync(step, {
      shell: true,
      encoding: 'utf8',
      stdio: capture ? 'pipe' : 'inherit',
      env: { ...process.env, NX_TUI: 'false', FORCE_COLOR: '0' },
    });
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
        .replace(ANSI_ESCAPE, '')
        .trim();
      return {
        status: 'error',
        message: `Check failed: ${step}\n\n${tail(output)}`,
      };
    }
  }
  return { status: 'success' };
}

function tail(text) {
  return text.length <= MAX_MESSAGE_CHARS
    ? text
    : `…(truncated)\n${text.slice(-MAX_MESSAGE_CHARS)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runChecks({ full: process.argv.includes('--full') });
  if (result.status === 'error') {
    console.error(`\n${result.message.split('\n')[0]}`);
    process.exit(1);
  }
  console.log('\nAll frontend checks passed.');
}
