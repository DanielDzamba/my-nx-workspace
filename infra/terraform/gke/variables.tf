variable "project_id" {
  description = "Google Cloud project that holds the cluster."
  type        = string
}

variable "region" {
  description = "Region for regional resources (Artifact Registry, static IP). Frankfurt, next to Neon (AWS eu-central-1)."
  type        = string
  default     = "europe-west3"
}

variable "zone" {
  description = "Zone of the cluster. A zonal cluster has its control plane fee covered by the GKE free tier."
  type        = string
  default     = "europe-west3-a"
}
