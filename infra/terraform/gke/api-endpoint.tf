# Everything that makes https://api.<domain> reach the cluster. The load balancer itself is not
# here: GKE creates it from the Gateway in k8s/overlays/prod, which refers to the IP and the
# certificate map below by name.

locals {
  api_host = "api.${var.domain}"
}

# Static IP of the load balancer. Without it, a re-created Gateway would get a new address and DNS
# would point nowhere. Global, because the Gateway class is the global external load balancer.
resource "google_compute_global_address" "api" {
  name = "api-gateway"

  depends_on = [google_project_service.apis]
}

# api.<domain> -> that IP
resource "google_dns_record_set" "api" {
  managed_zone = google_dns_managed_zone.main.name
  name         = "${local.api_host}."
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.api.address]
}

# Google-managed certificate. Google proves we control the name with a DNS record (DNS
# authorization), so the certificate can be issued before any traffic reaches the cluster, and is
# renewed automatically.
resource "google_certificate_manager_dns_authorization" "api" {
  name   = "api"
  domain = local.api_host

  depends_on = [google_project_service.apis]
}

resource "google_dns_record_set" "api_cert_authorization" {
  managed_zone = google_dns_managed_zone.main.name
  name         = google_certificate_manager_dns_authorization.api.dns_resource_record[0].name
  type         = google_certificate_manager_dns_authorization.api.dns_resource_record[0].type
  ttl          = 300
  rrdatas      = [google_certificate_manager_dns_authorization.api.dns_resource_record[0].data]
}

resource "google_certificate_manager_certificate" "api" {
  name = "api"

  managed {
    domains            = [local.api_host]
    dns_authorizations = [google_certificate_manager_dns_authorization.api.id]
  }
}

# The Gateway picks its certificates from a map (annotation networking.gke.io/certmap: api).
resource "google_certificate_manager_certificate_map" "api" {
  name = "api"

  depends_on = [google_project_service.apis]
}

resource "google_certificate_manager_certificate_map_entry" "api" {
  name         = "api"
  map          = google_certificate_manager_certificate_map.api.name
  hostname     = local.api_host
  certificates = [google_certificate_manager_certificate.api.id]
}
