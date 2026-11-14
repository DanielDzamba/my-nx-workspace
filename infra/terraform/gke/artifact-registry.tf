# Private Docker registry next to the nodes (same region: fast pulls, no egress cost).
# Image: europe-west3-docker.pkg.dev/<project>/todo/<service>:<git sha>
resource "google_artifact_registry_repository" "todo" {
  repository_id = "todo"
  location      = var.region
  format        = "DOCKER"
  description   = "Images of java-api and notification-service, tagged with the git commit SHA."

  # Every commit pushes a new image (~100-200 MB). Storage is paid per GB, so keep only the newest
  # versions of each image; older ones are deleted automatically (enough for a rollback).
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-latest-10"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-older"
    action = "DELETE"
    condition {
      tag_state = "ANY"
    }
  }

  depends_on = [google_project_service.apis]
}
