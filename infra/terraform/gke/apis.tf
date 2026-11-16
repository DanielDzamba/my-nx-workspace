# A new project has most Google APIs turned off. Everything else in this folder depends on these.
locals {
  apis = [
    "compute.googleapis.com",            # VMs (nodes), static IPs, load balancers
    "container.googleapis.com",          # GKE
    "artifactregistry.googleapis.com",   # container images
    "dns.googleapis.com",                # Cloud DNS zone of the domain
    "certificatemanager.googleapis.com", # HTTPS certificate of api.<domain>
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  service = each.value
  # `terraform destroy` removes the resources but leaves the APIs on: turning an API off can break
  # other things in the project and costs nothing while unused.
  disable_on_destroy = false
}
