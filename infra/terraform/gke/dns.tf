# DNS of the domain lives in Cloud DNS, so its records are code like everything else. The domain
# is registered at Porkbun; there the nameservers are set once to the ones in the
# `dns_name_servers` output (delegation).
resource "google_dns_managed_zone" "main" {
  name        = replace(var.domain, ".", "-")
  dns_name    = "${var.domain}."
  description = "Public zone of ${var.domain}"

  depends_on = [google_project_service.apis]
}
