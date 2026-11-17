# GKE infrastructure (Terraform)

Google Cloud resources for running the stack on GKE: the cluster, its nodes and the image registry.
Kubernetes objects (Deployments, Services, routes) are not here; they live in `k8s/`.

| File                   | What                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `versions.tf`          | Terraform + provider versions, remote state in GCS                            |
| `apis.tf`              | Google APIs the project needs (Compute, GKE, Artifact Registry)               |
| `cluster.tf`           | Zonal GKE Standard cluster `todo` + node pool `spot` (2–3 Spot e2-standard-2) |
| `iam.tf`               | Least-privilege service account for the nodes                                 |
| `artifact-registry.tf` | Docker repository `todo`, keeps the 10 newest versions of each image          |
| `dns.tf`               | Cloud DNS zone of the domain (nameservers set once at the registrar)          |
| `api-endpoint.tf`      | Static IP, `api.<domain>` record, Google-managed certificate + map            |
| `secrets.tf`           | Secret Manager secrets of the apps (no values) and who may read them          |
| `external-secrets.tf`  | External Secrets Operator (Helm) copying them into Kubernetes Secrets         |
| `github-wif.tf`        | Keyless login of GitHub Actions: `github-deploy` (main), `github-plan`        |
| `monitoring.tf`        | Grafana + Google's Prometheus frontend; dashboard in `dashboards/`            |

## Grafana

Not public and without a login: reaching it needs cluster access, which is the access control.

```sh
kubectl --context gke_todo-gke-514711_europe-west3-a_todo -n monitoring port-forward svc/grafana 3000:80
```

Then http://localhost:3000, dashboard _Todo – services_ (`dashboards/todo.json`; edit the file, not
the UI, or the next deploy overwrites the change). Data source: Managed Service for Prometheus
through `prometheus-frontend`, which adds Google credentials (monitoring.viewer) to the queries.
| `terraform.tfvars` | Values for this environment (project id; no secrets) |

## Decisions

- **Zonal, not regional:** the GKE free tier covers the control plane fee of one zonal cluster. A
  zone outage takes the cluster down, acceptable here; production would be regional.
- **Spot nodes:** 60–90 % cheaper, Google may take a node back at any time. The apps survive with
  several replicas spread over nodes (`topologySpreadConstraints` in `k8s/base`).
- **e2-standard-2, 2–3 nodes:** 2 dedicated vCPUs and ~1.9 CPU for pods per node, room for three
  java-api pods (500m each, HPA 2–5) next to the small ones. The cluster started on e2-medium, which
  the load tests (`tools/load-test`) outgrew: shared-core (about one core sustained) and ~940m for
  pods, so one java-api per node; the spare CPU was fragmented across five nodes, pods stayed
  Pending although two nodes idled, and a rollout got stuck. Fewer, bigger nodes also carry less
  per-node overhead (every node runs its own system pods).
- **30 GB disks:** the default 100 GB is paid even when empty.
- **Own node service account:** the default one has Editor on the whole project.
- **`deletion_protection = false`:** so the cluster can be destroyed at the end of the trial.

## Prerequisites

- `gcloud` and `terraform` (`winget install Google.CloudSDK Hashicorp.Terraform`), the
  `gke-gcloud-auth-plugin` (`gcloud components install gke-gcloud-auth-plugin`).
- `gcloud auth login` and `gcloud auth application-default login` (Terraform uses the second one).

## Bootstrap (done once)

Terraform cannot keep its state in a bucket it has not created yet, so the state bucket was created
by hand:

```sh
gcloud storage buckets create gs://todo-gke-514711-tfstate --location=europe-west3 \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://todo-gke-514711-tfstate --versioning
```

## Usage

```sh
cd infra/terraform/gke
terraform init        # once per machine: provider download, connects to the state bucket
terraform plan        # what would change; look for "-" and "-/+" (replace) before applying
terraform apply
gcloud container clusters get-credentials todo --zone europe-west3-a --project todo-gke-514711
kubectl get nodes
```

`kubectl` then points at GKE. Back to the local cluster: `kubectl config use-context kind-todo`.

Never change these resources in the console: the next `apply` reverts the change (drift).

### Workflow

1. Change the `.tf` files on a branch and open a pull request.
2. `.github/workflows/terraform-plan.yml` runs `terraform plan` as the read-only `github-plan@`
   (Workload Identity Federation, no key) and posts the plan as a PR comment; review it for `-` and
   `-/+`.
3. Merge. `.github/workflows/terraform-apply.yml` plans again on `main` (job summary) and, if there
   are changes, starts the apply job in the GitHub environment `infrastructure`. It waits for the
   required reviewer (Approve in the Actions run), then applies as `github-apply@`.

`github-apply@` has owner rights, so two locks guard it: Google lets only jobs of the environment
`infrastructure` use it (token subject `repo:<repo>:environment:infrastructure`), and GitHub runs
that environment only for `main` and only after an approval (Settings → Environments).

`terraform apply` from a laptop is left for bootstrapping (the state bucket, and `github-apply@`
itself, which cannot create itself) and for emergencies when GitHub is down.

## Cost

Roughly 1 € a day with two Spot nodes (the control plane fee is covered by the free tier); a load
balancer adds about 20 € a month once the Gateway exists. A budget alert (50 €/month) is set in the
billing console.

- **Pause** (keeps the cluster, removes the nodes): `terraform destroy -target=google_container_node_pool.spot`;
  resume with `terraform apply`.
- **End of the trial:** `terraform destroy` removes everything except the state bucket and the
  enabled APIs.
