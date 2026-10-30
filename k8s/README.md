# Kubernetes

The two backend services on Kubernetes, managed with Kustomize: shared manifests in `base/`, one
overlay per environment for what differs.

```
k8s/
  kind-config.yaml        local cluster: 1 control-plane node + 2 workers (kind = nodes are Docker containers)
  base/                   the same in every environment
    java-api.yaml           Deployment (3 replicas, probes, graceful shutdown) + Service
    notification-service.yaml  Deployment (2 replicas) + Service
    api-route.yaml          HTTPRoute: /api/notifications → notification-service, /api → java-api
  overlays/local/         kind: base + infrastructure + Envoy Gateway + development credentials
    infra/                  PostgreSQL ×2 and RabbitMQ (StatefulSets), Redis (Deployment)
    gateway.yaml            GatewayClass/Gateway (Envoy Gateway), NodePort 30080 → localhost:8088
    wait-for-database.yaml  init containers: the apps start only once their PostgreSQL answers
```

```
browser ─► nx serve angular-demo -c k8s (localhost:4200, proxy.k8s.json)
              │ /api/**
              ▼
          localhost:8088 ─► Gateway api-gateway (Envoy) ─► HTTPRoute api
                                    │ /api/notifications/**          │ /api/**
                                    ▼                                ▼
                     Service notification-service          Service java-api
                        2 pods ─► notification-postgres      3 pods ─► java-api-postgres, redis
                              ◄────────────── rabbitmq ◄──────────────┘ (events)
```

## Prerequisites

- Docker Desktop running, with about 5 GB of memory for its VM (Settings → Resources).
- `kubectl` (ships with Docker Desktop) and `kind` (`winget install Kubernetes.kind`).

Day-to-day development stays on Docker Compose + native apps (`runapp` skill); the cluster is for
trying Kubernetes itself. Run one of the two at a time: both share Docker's VM, and with both up
probes time out, pods get restarted and requests end in `504`. Pause Compose with
`docker compose -f apps/java-api/compose.yaml stop` (data stays in its volumes), the cluster with
`docker stop todo-control-plane todo-worker todo-worker2` (`docker start` resumes it).

The cluster has its own, empty databases: todos created against Compose are not in it.

## Commands

```sh
npx nx run k8s:cluster   # create the kind cluster "todo" and install Envoy Gateway (once)
npx nx run k8s:images    # build both images (:local) and load them into the cluster
npx nx run k8s:deploy    # kubectl apply -k k8s/overlays/local, wait for all rollouts
npx nx serve angular-demo -c k8s   # frontend on http://localhost:4200, /api goes to the cluster
npx nx run k8s:down      # delete the cluster and everything in it
```

After a code change: `npx nx run k8s:images`, then `kubectl -n todo rollout restart deployment/java-api`
(the tag stays `:local`, so only a restart picks up the new image). `npx nx lint k8s` renders the
overlay (also in CI), which catches broken Kustomize references.

Looking around (namespace `todo`):

```sh
kubectl -n todo get pods -o wide          # which pod runs on which node, READY, RESTARTS
kubectl -n todo describe pod <pod>        # events: scheduling, probe failures, OOMKilled
kubectl -n todo logs -f deployment/java-api   # logs of one of its pods (-l app.kubernetes.io/name=java-api for all)
kubectl -n todo get events --sort-by=.lastTimestamp
kubectl -n todo port-forward svc/rabbitmq 15672   # RabbitMQ UI on http://localhost:15672 (java_api / java_api)
kubectl -n todo exec -it java-api-postgres-0 -- psql -U java_api java_api
```

## The objects, in one sentence each

| Object                | Here                                           | What it does                                                                     |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Pod                   | `java-api-7c9f...-x2k4p`                       | one running copy of the container; replaceable, gets a new name and IP           |
| Deployment            | `java-api`, `notification-service`, `redis`    | keeps N identical pods running, replaces them one by one on a change             |
| StatefulSet           | `java-api-postgres-0`, `rabbitmq-0`            | like a Deployment, but stable pod names and one volume per pod (databases)       |
| Service               | `java-api` (port 80)                           | stable DNS name and virtual IP in front of the **ready** pods                    |
| ConfigMap / Secret    | `java-api-config-<hash>`, `java-api-secrets-…` | environment variables for the pods; a changed value creates a new name → rollout |
| PersistentVolumeClaim | `data-java-api-postgres-0`                     | "I need 1 GiB of disk"; survives pod restarts                                    |
| Gateway / HTTPRoute   | `api-gateway`, `api`                           | entry point from outside and the path rules (Gateway API, successor of Ingress)  |
| Namespace             | `todo`                                         | a folder for all of the above                                                    |

## Probes, shutdown and resources (`base/java-api.yaml`)

- **startupProbe** (`/actuator/health/liveness`, up to 3 min): only while the JVM starts; without
  it, a slow start would fail the liveness probe and Kubernetes would restart the pod forever.
- **livenessProbe** (`/actuator/health/liveness`): "is the process stuck?" → restart. Never includes
  the database or the broker (experiment 4).
- **readinessProbe** (`/actuator/health/readiness`): "may I get traffic?" → removed from the
  Service while it fails, not restarted. Spring reports not-ready during startup and shutdown.
- **Shutdown:** SIGTERM → `preStop` sleep 5 s (routers still send requests for a moment) →
  Spring graceful shutdown finishes running requests (max 20 s) → exit. All within
  `terminationGracePeriodSeconds: 30`, after that SIGKILL.
- **Rolling update:** `maxSurge: 1, maxUnavailable: 0`: a new pod first, an old one stops only
  when the new one is ready.
- **Resources:** memory request = limit (512 Mi; the heap is 60 % of it), no CPU limit (it would
  throttle the JVM; the request reserves a share). Over the memory limit the container is
  `OOMKilled`.
- **Several replicas:** Flyway takes a database lock, so 3 pods starting at once migrate once; the
  outbox relay uses `FOR UPDATE SKIP LOCKED`, so no event is sent twice; the RabbitMQ consumers of
  the notification-service pods share the queues (competing consumers).

## Experiments

Run each in a second terminal while watching `kubectl -n todo get pods -w`. The load loop counts
the HTTP status codes through the Gateway; `401` means a pod answered (no token), `502`/`503`/`000`
means a request was lost:

```sh
for i in $(seq 1 400); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/api/hello; sleep 0.05; done | sort | uniq -c
```

1. **Self-healing.** `kubectl -n todo delete pod <a java-api pod>`: the Deployment starts a
   replacement at once; the Service only routes to it once it is ready.
2. **Rolling update without downtime.** Start the load loop, then
   `kubectl -n todo rollout restart deployment/java-api`. Expected: only `401`.
   Now break it: remove all three probes and the preStop sleep (the patch itself rolls the pods),
   with the load loop running, and look for `503`. Removing only the readiness probe is not
   enough: until the startup probe has passed, a pod is not ready either.
   ```sh
   kubectl -n todo patch deployment java-api --type=json -p '[{"op":"remove","path":"/spec/template/spec/containers/0/startupProbe"},{"op":"remove","path":"/spec/template/spec/containers/0/livenessProbe"},{"op":"remove","path":"/spec/template/spec/containers/0/readinessProbe"},{"op":"remove","path":"/spec/template/spec/containers/0/lifecycle"}]'
   ```
   `npx nx run k8s:deploy` restores the manifest.
3. **Scaling and scheduling.** `kubectl -n todo scale deployment/java-api --replicas=6`: some pods
   may stay `Pending` (`describe` says `Insufficient memory`), because the requests no longer fit
   on the nodes. Scale back to 3.
4. **Database outage.** `kubectl -n todo scale statefulset/java-api-postgres --replicas=0`: the
   java-api pods stay `Running`, `READY` and with `RESTARTS 0`, requests that need the database
   fail, `/actuator/health` (not a probe) says `DOWN`. With the database in the liveness probe,
   all three would be restarted over and over (`CrashLoopBackOff`). Scale back to 1: the app
   recovers by itself.
5. **Config change.** Change a literal in `overlays/local/kustomization.yaml` (e.g. the CORS
   origin), `npx nx run k8s:deploy`: a new `java-api-config-<hash>` appears and the pods roll.
6. **Events between pods.** With the frontend on `-c k8s`, complete a few todos: every one gives
   exactly one notification, although 3 relays and 2 consumers run.
