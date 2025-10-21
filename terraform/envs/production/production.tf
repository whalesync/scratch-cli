module "production" {
  source = "../../modules/env"

  env_name               = "production"
  gcp_project_id         = "spv1-production"
  gcp_project_number     = 806617013435
  gcp_region             = "us-central1"
  gcp_zone               = "us-central1-c"
  as_gitlab              = var.as_gitlab
  bootstrap_deploy_stage = 2
}

variable "as_gitlab" {
  type        = bool
  default     = false
  description = "Use the GitLab service account to run Terraform"
}
