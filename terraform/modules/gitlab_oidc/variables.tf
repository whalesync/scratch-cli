/**
  * GitLab Workload Identity Federation Module Variables
*/

## ---------------------------------------------------------------------------------------------------------------------
## Required Variables
## ---------------------------------------------------------------------------------------------------------------------

variable "gcp_project_id" {
  type        = string
  description = "The GCP project ID where the service account and workload identity pool will be created."
}

variable "gitlab_namespace" {
  type        = string
  description = "The GitLab namespace the repo resides in. This is often the first value after the gitlab domain in the repo URL. (https://docs.gitlab.com/ee/api/namespaces.html)"
}

variable "gitlab_project_name" {
  type        = string
  description = "The name of the GitLab repo. This is often the value after the namespace in the repo URL."
}

variable "service_account_name" {
  type        = string
  description = "Name of the service account to create"
}

## ---------------------------------------------------------------------------------------------------------------------
## Optional Variables
## ---------------------------------------------------------------------------------------------------------------------

variable "gitlab_url" {
  type        = string
  description = "URL of GitLab Installation - change this value if you self-host GitLab or have a custom GitLab subdomain."
  default     = "https://gitlab.com"
}

variable "iam_roles" {
  type        = list(string)
  description = "A list of IAM roles to bind to the service account"
  default     = []
}
