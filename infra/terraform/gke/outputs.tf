output "cluster_name" {
  value = google_container_cluster.todo.name
}

output "image_repository" {
  description = "Prefix of the image names: <image_repository>/java-api:<git sha>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.todo.repository_id}"
}

output "get_credentials" {
  description = "Points kubectl at the cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.todo.name} --zone ${var.zone} --project ${var.project_id}"
}
