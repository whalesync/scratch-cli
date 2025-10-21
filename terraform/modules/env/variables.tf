variable "env_name" {
  type        = string
  description = "Name of the environment: test | staging | production"
}

variable "bootstrap_deploy_stage" {
  type        = number
  default     = 0
  description = "Use this to gradually build out a new environment without adding dependencies everywhere"
}

variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID where resources are to be deployed"
}

variable "gcp_project_number" {
  type        = number
  description = "The number of the GCP project"
}

variable "gcp_region" {
  type        = string
  description = "Region where cloud resources are to be created."
}

variable "gcp_zone" {
  description = "GCP zone for resources"
  type        = string
}

variable "as_gitlab" {
  type        = bool
  default     = false
  description = "Use the GitLab service account to run Terraform"
}
