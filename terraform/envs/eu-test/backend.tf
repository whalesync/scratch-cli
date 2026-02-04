terraform {
  # Update .terraform-version along with this
  required_version = "1.13.4"
  backend "gcs" {
    bucket = "spv1eu-test-tfstate"
    prefix = "terraform/state"
  }
}
