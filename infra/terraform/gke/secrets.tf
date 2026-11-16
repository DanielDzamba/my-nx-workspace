# Production credentials (Neon, CloudAMQP) live only in Secret Manager. Terraform creates the
# secrets and who may read them, never the values: a value set here would also be stored in the
# Terraform state. The values are added by hand (k8s/overlays/prod/README.md), one JSON object per
# service with the same keys as the environment variables, e.g.
#   {"SPRING_DATASOURCE_URL": "...", "SPRING_DATASOURCE_PASSWORD": "...", ...}
# External Secrets Operator (external-secrets.tf) turns each into the Kubernetes Secret
# <service>-secrets in the namespace todo.
locals {
  app_secrets = ["java-api-secrets", "notification-service-secrets"]
}

resource "google_secret_manager_secret" "app" {
  for_each = toset(local.app_secrets)

  secret_id = each.value
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Only the operator's Kubernetes service account may read the values (GKE Workload Identity: the
# pod gets short-lived Google credentials for this identity, no key file).
resource "google_secret_manager_secret_iam_member" "external_secrets" {
  for_each = google_secret_manager_secret.app

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "principal://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${var.project_id}.svc.id.goog/subject/ns/external-secrets/sa/external-secrets"
}

data "google_project" "this" {}
