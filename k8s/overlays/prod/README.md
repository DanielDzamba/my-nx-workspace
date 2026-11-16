# Production overlay (GKE)

Runs java-api, notification-service and a Redis cache on the GKE cluster from
`infra/terraform/gke`, reachable at https://api.tododan.life. PostgreSQL (Neon) and RabbitMQ
(CloudAMQP) stay outside the cluster, shared with the former Render deployment.

```
internet ──https──▶ Google load balancer (Gateway, static IP, managed certificate)
                      ├─ /api/notifications/... ──▶ notification-service (2 pods) ──▶ Neon `notifications`
                      └─ /api/...               ──▶ java-api (3 pods) ──▶ Neon, Redis (in cluster)
                                                       └─ events ──▶ CloudAMQP ──▶ notification-service
```

| File                    | What                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `kustomization.yaml`    | base + the files below, image names and tags, ConfigMaps, Secrets                     |
| `gateway.yaml`          | GKE Gateway (global external load balancer), HTTPS only                               |
| `health-checks.yaml`    | load balancer health checks on `/actuator/health/readiness` (default `/` answers 401) |
| `redis.yaml`            | Redis cache, one pod without a volume                                                 |
| `*.secrets.env.example` | keys of the git-ignored `*.secrets.env` files                                         |

Created by Terraform and referenced by name: the static IP `api-gateway`, the certificate map
`api`, the DNS record `api.tododan.life`.

Only `/api/...` is routed, so the actuator and the OpenAPI document are not public.

## One-time setup on a machine

1. Terraform applied, `kubectl` credentials:
   `gcloud container clusters get-credentials todo --zone europe-west3-a --project todo-gke-514711`
2. Docker may push to Artifact Registry: `gcloud auth configure-docker europe-west3-docker.pkg.dev`
3. Secrets: copy `java-api.secrets.env.example` to `java-api.secrets.env` (and the same for
   notification-service) and fill in the Neon and CloudAMQP values. These files are git-ignored and
   never committed; moving them to Google Secret Manager is planned.

## Deploy

```sh
npx nx run k8s:prod-images   # build, tag with the commit SHA, push, write the tag into kustomization.yaml
npx nx run k8s:prod-deploy   # kubectl apply -k k8s/overlays/prod on GKE, wait for the rollout
```

Commit the changed tag in `kustomization.yaml`: Git then records which version runs. Every kubectl
call names the GKE context, so the current context (kind or GKE) does not matter.

## Check

```sh
kubectl --context gke_todo-gke-514711_europe-west3-a_todo -n todo get pods,gateway,httproute
curl -i https://api.tododan.life/api/todos   # 401 without a token = routed to java-api
```

A new Gateway needs a few minutes after `PROGRAMMED True` before HTTPS answers (the load balancer
configuration and certificate are rolled out to Google's edge).
