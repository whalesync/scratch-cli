module "test" {
  source = "../../modules/env"

  env_name               = "test"
  gcp_project_id         = "spv1-test"
  gcp_project_number     = 211553068097
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
