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

variable "service_account_name" {
  type        = string
  description = "Prefix for resource ids created by this module"
}













/**
  * GitLab Workload Identity Federation Module Variables
variable "gitlab_url" {
  type        = string
  description = "URL of GitLab Installation"
  default     = "https://gitlab.com"
}

variable "google_project_id" {
  type        = string
  description = "Project ID of the GCP Project"
}

variable "gitlab_namespace_path" {
  type        = string
  description = "Path of a gitlab namespace (https://docs.gitlab.com/ee/api/namespaces.html)"
  default     = null
}

variable "oidc_service_account" {
  type = map(object({
    sa_email  = string
    attribute = string
  }))
  description = "OIDC service account email and projectID mapping"
}

variable "gitlab_project_id" {
  type        = number
  description = "ID of the GitLab project found in settings"
}

variable "bind_to_namespace" {
  type        = bool
  description = "OIDC condition will be bound to the specified GitLab namespace if this value is set to true. This means that the attribute will check the namespace with `startsWith` and all projects under it will be included in the scope."
  default     = false
}

variable "allowed_audiences" {
  type        = list(string)
  description = "Allowed audience value of tokens(aud claim)"
  default     = []
}

variable "workload_identity_name" {
  type        = string
  description = "Custom Workload Identity Pool name which useful in case of multiple pools in a single project (will be appended after `gitlab-pool-oidc-`)"
  default     = null
}

variable "custom_condition" {
  type        = string
  description = "If this is set, this is the OIDC condition to use to determine of the claim is valid or not"
  default     = null
}

*/
