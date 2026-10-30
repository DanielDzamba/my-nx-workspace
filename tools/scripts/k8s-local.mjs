// Local Kubernetes (kind) for k8s/README.md. Run through Nx: `npx nx run k8s:<target>`.
//   cluster  create the kind cluster and install Envoy Gateway (Gateway API)
//   images   build java-api and notification-service, load them into the cluster
//   deploy   kubectl apply -k k8s/overlays/local and wait until everything is rolled out
//   down     delete the cluster (and all data in it)
//   lint     render the local overlay (catches broken Kustomize references); no cluster needed
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const CLUSTER = 'todo';
const NAMESPACE = 'todo';
// Envoy Gateway release: its install.yaml also brings the Gateway API CRDs
const ENVOY_GATEWAY_VERSION = 'v1.9.3';
const root = resolve(import.meta.dirname, '../..');

// `winget install Kubernetes.kind` adds its package folder to the user PATH, which a shell opened
// before the install does not see yet
if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
  const packages = join(
    process.env.LOCALAPPDATA,
    'Microsoft',
    'WinGet',
    'Packages'
  );
  const kindDirs = existsSync(packages)
    ? readdirSync(packages)
        .filter((name) => name.startsWith('Kubernetes.kind_'))
        .map((name) => join(packages, name))
    : [];
  process.env.PATH = [process.env.PATH, ...kindDirs].join(delimiter);
}

function run(command, args, { quiet = false } = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    // quiet: drop stdout (e.g. the rendered manifests), keep errors
    stdio: quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    console.error(
      result.error?.message ?? `${command} exited with ${result.status}`
    );
    process.exit(result.status ?? 1);
  }
}

const commands = {
  cluster() {
    run('kind', ['create', 'cluster', '--config', 'k8s/kind-config.yaml']);
    run('kubectl', [
      'apply',
      '--server-side',
      '-f',
      `https://github.com/envoyproxy/gateway/releases/download/${ENVOY_GATEWAY_VERSION}/install.yaml`,
    ]);
    run('kubectl', [
      'wait',
      '--namespace',
      'envoy-gateway-system',
      '--for=condition=Available',
      '--timeout=5m',
      'deployment/envoy-gateway',
    ]);
  },

  images() {
    for (const app of ['java-api', 'notification-service']) {
      // Repository root as context, like render.yaml (the builds need api-contract/)
      run('docker', [
        'build',
        '-f',
        `apps/${app}/Dockerfile`,
        '-t',
        `${app}:local`,
        '.',
      ]);
      run('kind', ['load', 'docker-image', `${app}:local`, '--name', CLUSTER]);
    }
  },

  deploy() {
    run('kubectl', ['apply', '-k', 'k8s/overlays/local']);
    for (const workload of [
      'statefulset/java-api-postgres',
      'statefulset/notification-postgres',
      'statefulset/rabbitmq',
      'deployment/redis',
      'deployment/java-api',
      'deployment/notification-service',
    ]) {
      run('kubectl', [
        'rollout',
        'status',
        '--namespace',
        NAMESPACE,
        '--timeout=5m',
        workload,
      ]);
    }
  },

  down() {
    run('kind', ['delete', 'cluster', '--name', CLUSTER]);
  },

  lint() {
    run('kubectl', ['kustomize', 'k8s/overlays/local'], { quiet: true });
  },
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(
    `Usage: node tools/scripts/k8s-local.mjs <${Object.keys(commands).join(
      '|'
    )}>`
  );
  process.exit(1);
}
command();
