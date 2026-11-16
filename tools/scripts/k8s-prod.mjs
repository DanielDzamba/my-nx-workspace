// Production on GKE (k8s/overlays/prod). Normally run by .github/workflows/deploy-gke.yml on every
// push to main; by hand through Nx: `npx nx run k8s:<target>`.
//   prod-images  build java-api and notification-service, tag them with the commit SHA, push them
//                to Artifact Registry
//   prod-deploy  render k8s/overlays/prod with that tag and apply it on the GKE cluster, then wait
//                for the rollout
// The tag is the commit SHA (12 characters) of HEAD, or IMAGE_TAG if set. The cluster itself is
// Terraform (infra/terraform/gke). One-time setup for manual use: k8s/overlays/prod/README.md.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REGISTRY = 'europe-west3-docker.pkg.dev/todo-gke-514711/todo';
// Every kubectl call names the context explicitly: the local cluster (kind-todo) and GKE are both
// in ~/.kube/config, and the current context may point at either. CI sets KUBE_CONTEXT to the
// name its own credentials step created.
const CONTEXT =
  process.env.KUBE_CONTEXT ?? 'gke_todo-gke-514711_europe-west3-a_todo';
const NAMESPACE = 'todo';
const OVERLAY = 'k8s/overlays/prod';
// Placeholder tag in the overlay's kustomization.yaml, replaced when rendering
const PLACEHOLDER = 'deploy-time';
const APPS = ['java-api', 'notification-service'];
const root = resolve(import.meta.dirname, '../..');

function run(command, args, { capture = false, input } = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    input,
    stdio: [
      input === undefined ? 'ignore' : 'pipe',
      capture ? 'pipe' : 'inherit',
      'inherit',
    ],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    console.error(
      result.error?.message ?? `${command} exited with ${result.status}`
    );
    process.exit(result.status ?? 1);
  }
  return capture ? result.stdout.trim() : '';
}

function imageTag() {
  if (process.env.IMAGE_TAG) return process.env.IMAGE_TAG;
  return run('git', ['rev-parse', '--short=12', 'HEAD'], { capture: true });
}

const commands = {
  'prod-images'() {
    // The tag must name exactly the code in the image: refuse uncommitted changes in the apps.
    const dirty = run(
      'git',
      [
        'status',
        '--porcelain',
        '--',
        'apps/java-api',
        'apps/notification-service',
        'api-contract',
      ],
      { capture: true }
    );
    if (dirty) {
      console.error(
        'Uncommitted changes in the apps; commit them first, the image tag is the commit SHA:\n' +
          dirty
      );
      process.exit(1);
    }
    const tag = imageTag();
    for (const app of APPS) {
      const image = `${REGISTRY}/${app}:${tag}`;
      // Repository root as context (the builds need api-contract/); amd64 like the GKE nodes
      run('docker', [
        'build',
        '--platform',
        'linux/amd64',
        '-f',
        `apps/${app}/Dockerfile`,
        '-t',
        image,
        '.',
      ]);
      run('docker', ['push', image]);
    }
  },

  'prod-deploy'() {
    const tag = imageTag();
    let manifests = run('kubectl', ['kustomize', OVERLAY], { capture: true });
    for (const app of APPS) {
      const placeholder = `${REGISTRY}/${app}:${PLACEHOLDER}`;
      if (!manifests.includes(placeholder)) {
        console.error(`${placeholder} not found in the rendered ${OVERLAY}`);
        process.exit(1);
      }
      manifests = manifests.replaceAll(
        placeholder,
        `${REGISTRY}/${app}:${tag}`
      );
    }
    console.log(`Deploying image tag ${tag}`);
    run('kubectl', ['--context', CONTEXT, 'apply', '-f', '-'], {
      input: manifests,
    });
    for (const workload of [
      'deployment/redis',
      ...APPS.map((app) => `deployment/${app}`),
    ]) {
      run('kubectl', [
        '--context',
        CONTEXT,
        'rollout',
        'status',
        '--namespace',
        NAMESPACE,
        '--timeout=10m',
        workload,
      ]);
    }
  },
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(
    `Usage: node tools/scripts/k8s-prod.mjs <${Object.keys(commands).join(
      '|'
    )}>`
  );
  process.exit(1);
}
command();
