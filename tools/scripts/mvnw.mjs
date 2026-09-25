// Cross-platform launcher for a project's Maven wrapper (mvnw on Unix, mvnw.cmd on Windows).
// Nx runs this with cwd set to the project root; all arguments are forwarded to Maven.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';
const wrapper = resolve(isWindows ? 'mvnw.cmd' : 'mvnw');

const result = spawnSync(isWindows ? `"${wrapper}"` : wrapper, process.argv.slice(2), {
  stdio: 'inherit',
  shell: isWindows,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
