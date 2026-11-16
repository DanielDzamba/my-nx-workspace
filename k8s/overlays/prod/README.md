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
| `kustomization.yaml`    | base + the files below, image names (tag filled in at deploy time), ConfigMaps        |
| `gateway.yaml`          | GKE Gateway (global external load balancer), HTTPS only                               |
| `health-checks.yaml`    | load balancer health checks on `/actuator/health/readiness` (default `/` answers 401) |
| `redis.yaml`            | Redis cache, one pod without a volume                                                 |
| `external-secrets.yaml` | Neon and CloudAMQP credentials from Google Secret Manager                             |

Created by Terraform and referenced by name: the static IP `api-gateway`, the certificate map
`api`, the DNS record `api.tododan.life`, the Secret Manager secrets and the External Secrets
Operator.

Only `/api/...` is routed, so the actuator and the OpenAPI document are not public.

## Credentials

Google Secret Manager holds one secret per service, `java-api-secrets` and
`notification-service-secrets`, each a JSON object with the environment variables
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` and
`SPRING_RABBITMQ_ADDRESSES`. The External Secrets Operator copies them into the Kubernetes Secrets
of the same name (refresh every hour). Neither Git nor CI ever holds the values.

Change a value: write the whole JSON as a new version, then restart the pods (they read the
environment only at startup):

```sh
gcloud secrets versions add java-api-secrets --data-file=java-api.json   # delete the file afterwards
kubectl --context gke_todo-gke-514711_europe-west3-a_todo -n todo annotate externalsecret java-api-secrets force-sync=$(date +%s) --overwrite
kubectl --context gke_todo-gke-514711_europe-west3-a_todo -n todo rollout restart deployment/java-api
```

## Deploy

Automatic: every push to `main` that touches the apps, the API contract or the manifests runs
`.github/workflows/deploy-gke.yml`. It logs in to Google Cloud through Workload Identity Federation
(no key), builds both images tagged with the commit SHA, pushes them to Artifact Registry and
applies this overlay with that tag. The running version is the image tag:
`kubectl ... get deploy -o wide`.

By hand (same steps, e.g. to test a change of the scripts): once
`gcloud container clusters get-credentials todo --zone europe-west3-a --project todo-gke-514711`
and `gcloud auth configure-docker europe-west3-docker.pkg.dev`, then

```sh
npx nx run k8s:prod-images   # build, tag with the commit SHA of HEAD, push
npx nx run k8s:prod-deploy   # render with that tag, kubectl apply on GKE, wait for the rollout
```

Every kubectl call names the GKE context, so the current context (kind or GKE) does not matter.

## Check

```sh
kubectl --context gke_todo-gke-514711_europe-west3-a_todo -n todo get pods,gateway,httproute
curl -i https://api.tododan.life/api/todos   # 401 without a token = routed to java-api
```

A new Gateway needs a few minutes after `PROGRAMMED True` before HTTPS answers (the load balancer
configuration and certificate are rolled out to Google's edge).
