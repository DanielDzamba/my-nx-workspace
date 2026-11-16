# External Secrets Operator: copies the Secret Manager secrets (secrets.tf) into Kubernetes Secrets.
# A cluster add-on, so it is installed with the cluster; the ExternalSecret objects that say what to
# copy belong to the app and live in k8s/overlays/prod.
data "google_client_config" "current" {}

locals {
  cluster_host = "https://${google_container_cluster.todo.endpoint}"
  cluster_ca   = base64decode(google_container_cluster.todo.master_auth[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes = {
    host                   = local.cluster_host
    token                  = data.google_client_config.current.access_token
    cluster_ca_certificate = local.cluster_ca
  }
}

provider "kubernetes" {
  host                   = local.cluster_host
  token                  = data.google_client_config.current.access_token
  cluster_ca_certificate = local.cluster_ca
}

resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  namespace        = "external-secrets"
  create_namespace = true
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "2.14.0"

  # Small footprint: one controller, no separate webhook/cert-controller replicas to spare memory
  # on the e2-medium nodes.
  values = [yamlencode({
    replicaCount = 1
    resources = {
      requests = { cpu = "10m", memory = "64Mi" }
      limits   = { memory = "128Mi" }
    }
    webhook = {
      resources = {
        requests = { cpu = "10m", memory = "32Mi" }
        limits   = { memory = "64Mi" }
      }
    }
    certController = {
      resources = {
        requests = { cpu = "10m", memory = "32Mi" }
        limits   = { memory = "64Mi" }
      }
    }
  })]

  depends_on = [google_container_node_pool.spot]
}
