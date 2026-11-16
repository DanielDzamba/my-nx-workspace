// Runs tools/load-test/todos.js with k6, passing the credentials from the git-ignored secrets.env
// as environment variables (never as command-line arguments, which other processes can see).
//   node tools/load-test/run.mjs           smoke test (5 VUs, 1 minute)
//   node tools/load-test/run.mjs ramp      50 → 200 → 500 VUs, about 16 minutes
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = import.meta.dirname;
const secretsFile = resolve(dir, 'secrets.env');
if (!existsSync(secretsFile)) {
  console.error(
    `Missing ${secretsFile}: copy secrets.env.example and fill it in.`
  );
  process.exit(1);
}
const secrets = Object.fromEntries(
  readFileSync(secretsFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const result = spawnSync('k6', ['run', resolve(dir, 'todos.js')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ...secrets,
    PROFILE: process.argv[2] ?? 'smoke',
    // Public values (Auth0 tenant, the "k6 load test" application, the test user)
    AUTH0_DOMAIN: 'todo-app-todos.eu.auth0.com',
    AUTH0_CLIENT_ID: 'KaKfcQRqhYKQNLAnPFypsEE3exkat2Xo',
    LOADTEST_USER: 'loadtest@tododan.life',
  },
});
process.exit(result.status ?? 1);
