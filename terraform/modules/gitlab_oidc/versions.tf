terraform {
  required_version = ">= v1.4.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.55"
    }
  }
}
