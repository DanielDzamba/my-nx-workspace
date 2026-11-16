# GitHub Actions log in to Google Cloud without a key: GitHub signs a short-lived OIDC token per
# job ("repo X, ref Y"), Google checks it and hands out credentials of a service account for about
# an hour (Workload Identity Federation). Nothing long-lived is stored in GitHub.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  # Tokens of any other repository are rejected outright
  attribute_condition = "assertion.repository == '${var.github_repository}'"
}

# --- Deploy: only workflows running on main --------------------------------------------------

resource "google_service_account" "github_deploy" {
  account_id   = "github-deploy"
  display_name = "GitHub Actions: build and deploy (main only)"
}

resource "google_service_account_iam_member" "github_deploy_main_only" {
  service_account_id = google_service_account.github_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.ref/refs/heads/main"
}

# Push images to this one repository
resource "google_artifact_registry_repository_iam_member" "github_deploy" {
  location   = google_artifact_registry_repository.todo.location
  repository = google_artifact_registry_repository.todo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_deploy.email}"
}

# kubectl apply in the cluster (Kubernetes objects; not the cluster or node settings themselves)
resource "google_project_iam_member" "github_deploy_gke" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

# --- Apply: only jobs in the GitHub environment `infrastructure` -----------------------------
# terraform apply creates service accounts, changes IAM and may delete the cluster, so it needs
# owner rights. Two locks keep them out of reach of ordinary workflows:
#   - Google: only tokens whose subject is the environment `infrastructure` may use this account
#   - GitHub: that environment accepts jobs from main only, and each job waits until a required
#     reviewer approves it (settings in .github/workflows/terraform-apply.yml)
# Bootstrap: this account cannot create itself, so this block was applied once by hand.

resource "google_service_account" "github_apply" {
  account_id   = "github-apply"
  display_name = "GitHub Actions: terraform apply (environment infrastructure, approved)"
}

resource "google_service_account_iam_member" "github_apply_environment_only" {
  service_account_id = google_service_account.github_apply.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/subject/repo:${var.github_repository}:environment:infrastructure"
}

resource "google_project_iam_member" "github_apply" {
  project = var.project_id
  role    = "roles/owner"
  member  = "serviceAccount:${google_service_account.github_apply.email}"
}

# --- Plan: any workflow of the repository (pull requests), read-only --------------------------

resource "google_service_account" "github_plan" {
  account_id   = "github-plan"
  display_name = "GitHub Actions: terraform plan (read-only)"
}

resource "google_service_account_iam_member" "github_plan_repository" {
  service_account_id = google_service_account.github_plan.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Read every resource and its IAM policy (terraform plan refreshes them), but no secret values
resource "google_project_iam_member" "github_plan" {
  for_each = toset(["roles/viewer", "roles/iam.securityReviewer"])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_plan.email}"
}

# Helm keeps its release records in Secrets of the release namespace, and `roles/viewer` cannot
# read Secrets. Let the plan identity read Secrets in the add-on namespaces only (Helm metadata;
# the app's credentials live in the namespace todo, out of its reach).
locals {
  helm_namespaces = toset([helm_release.external_secrets.namespace, helm_release.grafana.namespace])
}

moved {
  from = kubernetes_role_v1.helm_release_reader
  to   = kubernetes_role_v1.helm_release_reader["external-secrets"]
}

moved {
  from = kubernetes_role_binding_v1.github_plan_helm
  to   = kubernetes_role_binding_v1.github_plan_helm["external-secrets"]
}

resource "kubernetes_role_v1" "helm_release_reader" {
  for_each = local.helm_namespaces

  metadata {
    name      = "helm-release-reader"
    namespace = each.value
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list"]
  }
}

resource "kubernetes_role_binding_v1" "github_plan_helm" {
  for_each = local.helm_namespaces

  metadata {
    name      = "github-plan-helm-release-reader"
    namespace = each.value
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.helm_release_reader[each.key].metadata[0].name
  }
  # GKE maps a Google service account to a Kubernetes user named by its email
  subject {
    kind      = "User"
    name      = google_service_account.github_plan.email
    api_group = "rbac.authorization.k8s.io"
  }
}

# Read the state; plans in pull requests run with -lock=false, so no write access is needed
resource "google_storage_bucket_iam_member" "github_plan_state" {
  bucket = "todo-gke-514711-tfstate"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.github_plan.email}"
}
