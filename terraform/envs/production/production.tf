module "production" {
  source = "../../modules/env"

  env_name           = "production"
  gcp_project_id     = "spv1-production"
  gcp_project_number = 806617013435
  gcp_region         = "us-central1"
  gcp_zone           = "us-central1-c"
  as_gitlab          = var.as_gitlab

  # Cloud IDS.
  enable_intrusion_detection = true

  # Load Balancer
  enable_client_load_balancer = true
  client_domain              = "app.scratch.md"
  enable_client_cdn          = true

  # Monitoring
  enable_pagerduty_notifications = false
}

variable "as_gitlab" {
  type        = bool
  default     = false
  description = "Use the GitLab service account to run Terraform"
}
