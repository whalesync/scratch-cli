terraform {
  required_providers {
    google = {
      source                = "hashicorp/google"
      configuration_aliases = [google.no_labels]
    }
  }
}
