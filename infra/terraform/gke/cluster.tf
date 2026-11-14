# GKE Standard cluster: zonal (control plane fee covered by the GKE free tier; a zone outage takes
# the cluster down, acceptable for a learning project; production would be regional).
resource "google_container_cluster" "todo" {
  name     = "todo"
  location = var.zone

  # GKE always creates a default node pool. Delete it right away and manage our own pool as a
  # separate resource, so node changes never force a cluster replacement.
  remove_default_node_pool = true
  initial_node_count       = 1

  # Lets `terraform destroy` remove the cluster at the end of the trial. Production: true.
  deletion_protection = false

  release_channel {
    channel = "REGULAR"
  }

  # Pods can act as Google service accounts without JSON keys.
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # GKE's Gateway controller for the HTTPRoutes in k8s/base.
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  # Managed Service for Prometheus: pod metrics in Cloud Monitoring.
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = true
    }
  }

  depends_on = [google_project_service.apis]
}

# Spot nodes: 60-90 % cheaper, Google may take them back at any time. The apps survive that with
# several replicas spread over nodes (topologySpreadConstraints in k8s/base).
resource "google_container_node_pool" "spot" {
  name     = "spot"
  cluster  = google_container_cluster.todo.id
  location = var.zone

  # Min 2: replicas spread over two machines. Max 3: room for a rolling update, a lost node and
  # HPA, and a hard cap on the cost.
  # The pool starts with initial_node_count nodes (default 1); the autoscaler does not add nodes
  # just to reach min_node_count without pending pods, so start with the minimum.
  initial_node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 3
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = "e2-medium" # 2 vCPU (shared), 4 GB; ~2.3 GiB left for pods = 4 pods of 512Mi
    spot         = true

    # The default 100 GB disk is paid even when empty. OS + images + container logs fit into 30 GB.
    disk_size_gb = 30
    disk_type    = "pd-balanced"

    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
