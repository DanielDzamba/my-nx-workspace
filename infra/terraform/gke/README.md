# GKE infrastructure (Terraform)

Google Cloud resources for running the stack on GKE: the cluster, its nodes and the image registry.
Kubernetes objects (Deployments, Services, routes) are not here; they live in `k8s/`.

| File                   | What                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| `versions.tf`          | Terraform + provider versions, remote state in GCS                        |
| `apis.tf`              | Google APIs the project needs (Compute, GKE, Artifact Registry)           |
| `cluster.tf`           | Zonal GKE Standard cluster `todo` + node pool `spot` (2–3 Spot e2-medium) |
| `iam.tf`               | Least-privilege service account for the nodes                             |
| `artifact-registry.tf` | Docker repository `todo`, keeps the 10 newest versions of each image      |
| `dns.tf`               | Cloud DNS zone of the domain (nameservers set once at the registrar)      |
| `api-endpoint.tf`      | Static IP, `api.<domain>` record, Google-managed certificate + map        |
| `secrets.tf`           | Secret Manager secrets of the apps (no values) and who may read them      |
| `external-secrets.tf`  | External Secrets Operator (Helm) copying them into Kubernetes Secrets     |
| `github-wif.tf`        | Keyless login of GitHub Actions: `github-deploy` (main), `github-plan`    |
| `terraform.tfvars`     | Values for this environment (project id; no secrets)                      |

## Decisions

- **Zonal, not regional:** the GKE free tier covers the control plane fee of one zonal cluster. A
  zone outage takes the cluster down, acceptable here; production would be regional.
- **Spot nodes:** 60–90 % cheaper, Google may take a node back at any time. The apps survive with
  several replicas spread over nodes (`topologySpreadConstraints` in `k8s/base`).
- **e2-medium, 2–3 nodes:** a pod requests 512Mi, a node leaves ~2.7 GiB for pods, so 2 nodes hold
  the 5 pods; the third is room for rolling updates, a lost node and HPA. Smaller machines waste
  most of their memory on per-node overhead.
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
3. After the merge, apply by hand from `main` (`terraform apply`). Apply is not automated: it needs
   owner-like rights, which no CI identity has.

## Cost

Roughly 1 € a day with two Spot nodes (the control plane fee is covered by the free tier); a load
balancer adds about 20 € a month once the Gateway exists. A budget alert (50 €/month) is set in the
billing console.

- **Pause** (keeps the cluster, removes the nodes): `terraform destroy -target=google_container_node_pool.spot`;
  resume with `terraform apply`.
- **End of the trial:** `terraform destroy` removes everything except the state bucket and the
  enabled APIs.
