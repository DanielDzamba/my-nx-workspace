terraform {
  required_version = ">= 1.17"

  # State lives in a GCS bucket (versioned, never public). The bucket is created once by hand
  # (bootstrap, see README.md) because Terraform cannot store its state in a bucket it has not
  # created yet. Variables are not allowed in this block.
  backend "gcs" {
    bucket = "todo-gke-514711-tfstate"
    prefix = "gke"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
