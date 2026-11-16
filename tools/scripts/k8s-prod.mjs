// Production on GKE (k8s/overlays/prod). Run through Nx: `npx nx run k8s:<target>`.
//   prod-images  build java-api and notification-service, tag them with the current commit, push
//                them to Artifact Registry and write the tag into k8s/overlays/prod
//   prod-deploy  kubectl apply -k k8s/overlays/prod on the GKE cluster and wait for the rollout
// The cluster itself is Terraform (infra/terraform/gke). One-time setup: k8s/overlays/prod/README.md.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTRY = 'europe-west3-docker.pkg.dev/todo-gke-514711/todo';
// Every kubectl call names the context explicitly: the local cluster (kind-todo) and GKE are both
// in ~/.kube/config, and the current context may point at either.
const CONTEXT = 'gke_todo-gke-514711_europe-west3-a_todo';
const NAMESPACE = 'todo';
const OVERLAY = 'k8s/overlays/prod';
const APPS = ['java-api', 'notification-service'];
const root = resolve(import.meta.dirname, '../..');

function run(command, args, { capture = false } = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
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
    const tag = run('git', ['rev-parse', '--short=12', 'HEAD'], {
      capture: true,
    });

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

    // Record the tag in the overlay: Git then says which version runs in production.
    const file = resolve(root, OVERLAY, 'kustomization.yaml');
    let text = readFileSync(file, 'utf8');
    for (const app of APPS) {
      const pattern = new RegExp(
        `(newName: ${REGISTRY}/${app}\\r?\\n\\s+newTag: ).*`
      );
      if (!pattern.test(text)) {
        console.error(
          `No image entry for ${app} in ${OVERLAY}/kustomization.yaml`
        );
        process.exit(1);
      }
      text = text.replace(pattern, `$1${tag}`);
    }
    writeFileSync(file, text);
    console.log(
      `\nImages pushed with tag ${tag}; commit ${OVERLAY}/kustomization.yaml.`
    );
  },

  'prod-deploy'() {
    run('kubectl', ['--context', CONTEXT, 'apply', '-k', OVERLAY]);
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
