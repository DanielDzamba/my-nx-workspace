output "cluster_name" {
  value = google_container_cluster.todo.name
}

output "image_repository" {
  description = "Prefix of the image names: <image_repository>/java-api:<git sha>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.todo.repository_id}"
}

output "dns_name_servers" {
  description = "Set these as the domain's nameservers at the registrar (Porkbun)."
  value       = google_dns_managed_zone.main.name_servers
}

output "api_url" {
  value = "https://${local.api_host}"
}

output "api_ip" {
  value = google_compute_global_address.api.address
}

output "github_workload_identity_provider" {
  description = "For google-github-actions/auth in .github/workflows (not a secret)."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_deploy_service_account" {
  value = google_service_account.github_deploy.email
}

output "github_apply_service_account" {
  value = google_service_account.github_apply.email
}

output "github_plan_service_account" {
  value = google_service_account.github_plan.email
}

output "get_credentials" {
  description = "Points kubectl at the cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.todo.name} --zone ${var.zone} --project ${var.project_id}"
}
