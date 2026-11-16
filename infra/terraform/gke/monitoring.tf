# Grafana on top of Managed Service for Prometheus. Not public: open it with
#   kubectl -n monitoring port-forward svc/grafana 3000:80   → http://localhost:3000
#
#   Grafana ──PromQL──▶ prometheus-frontend ──(Google credentials)──▶ Managed Prometheus
#
# Managed Prometheus answers only authenticated Google API calls, which Grafana's Prometheus data
# source cannot make. Google's frontend proxy speaks the plain Prometheus HTTP API inside the
# cluster and adds the credentials of its own identity (Workload Identity, monitoring.viewer).

resource "kubernetes_namespace_v1" "monitoring" {
  metadata {
    name = "monitoring"
  }

  depends_on = [google_container_node_pool.spot]
}

# --- prometheus-frontend ---------------------------------------------------------------------

resource "kubernetes_service_account_v1" "prometheus_frontend" {
  metadata {
    name      = "prometheus-frontend"
    namespace = kubernetes_namespace_v1.monitoring.metadata[0].name
  }
}

# Read metrics of this project, nothing else
resource "google_project_iam_member" "prometheus_frontend" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "principal://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${var.project_id}.svc.id.goog/subject/ns/monitoring/sa/prometheus-frontend"
}

resource "kubernetes_deployment_v1" "prometheus_frontend" {
  metadata {
    name      = "prometheus-frontend"
    namespace = kubernetes_namespace_v1.monitoring.metadata[0].name
  }
  spec {
    replicas = 1
    selector {
      match_labels = { "app.kubernetes.io/name" = "prometheus-frontend" }
    }
    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "prometheus-frontend" }
      }
      spec {
        service_account_name = kubernetes_service_account_v1.prometheus_frontend.metadata[0].name
        container {
          name  = "frontend"
          image = "gke.gcr.io/prometheus-engine/frontend:v0.19.4-gke.0"
          args  = ["--web.listen-address=:9090", "--query.project-id=${var.project_id}"]
          port {
            name           = "web"
            container_port = 9090
          }
          readiness_probe {
            http_get {
              path = "/-/ready"
              port = "web"
            }
          }
          resources {
            requests = { cpu = "10m", memory = "32Mi" }
            limits   = { memory = "64Mi" }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "prometheus_frontend" {
  metadata {
    name      = "prometheus-frontend"
    namespace = kubernetes_namespace_v1.monitoring.metadata[0].name
  }
  spec {
    selector = { "app.kubernetes.io/name" = "prometheus-frontend" }
    port {
      name        = "web"
      port        = 9090
      target_port = "web"
    }
  }

  # GKE adds this annotation to every Service itself; without the ignore every plan would show a
  # change that removes it, and GKE would add it again right after the apply.
  lifecycle {
    ignore_changes = [metadata[0].annotations["cloud.google.com/neg"]]
  }
}

# --- Grafana ---------------------------------------------------------------------------------

resource "helm_release" "grafana" {
  name       = "grafana"
  namespace  = kubernetes_namespace_v1.monitoring.metadata[0].name
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = "10.5.14"

  values = [yamlencode({
    # No login: Grafana has no Service exposed outside the cluster, so whoever reaches it has
    # already passed Google IAM (kubectl port-forward needs cluster access). A password would only
    # be one more secret, readable by the plan identity together with Helm's release records.
    "grafana.ini" = {
      "auth.anonymous" = { enabled = true, org_role = "Admin" }
      "auth"           = { disable_login_form = true }
    }
    testFramework = { enabled = false }
    persistence   = { enabled = false } # dashboards come from code, nothing to keep
    resources = {
      requests = { cpu = "20m", memory = "128Mi" }
      limits   = { memory = "256Mi" }
    }
    datasources = {
      "datasources.yaml" = {
        apiVersion = 1
        datasources = [{
          name      = "Managed Prometheus"
          uid       = "prometheus"
          type      = "prometheus"
          url       = "http://prometheus-frontend.monitoring.svc:9090"
          access    = "proxy"
          isDefault = true
          # The scrape interval (k8s/overlays/prod/pod-monitoring.yaml); $__rate_interval builds on it
          jsonData = { timeInterval = "60s" }
        }]
      }
    }
    dashboardProviders = {
      "dashboardproviders.yaml" = {
        apiVersion = 1
        providers = [{
          name    = "default"
          orgId   = 1
          folder  = ""
          type    = "file"
          options = { path = "/var/lib/grafana/dashboards/default" }
        }]
      }
    }
    dashboards = {
      default = {
        todo = { json = file("${path.module}/dashboards/todo.json") }
      }
    }
  })]

  depends_on = [kubernetes_service_v1.prometheus_frontend]
}
