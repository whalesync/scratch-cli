/**
  * GitLab Workload Identity Federation Module
  *
  * Creates a service account, IAM bindings, workload identity pool, and workload identity provider used
  * to authenticate GitLab CI jobs to GCP using OpenID Connect (OIDC) tokens.
*/

locals {
  version = "0.1.0"
}

data "google_project" "project" {}

## ---------------------------------------------------------------------------------------------------------------------
## Workload Identity Service Account & IAM Permissions
## ---------------------------------------------------------------------------------------------------------------------

resource "google_service_account" "service_account" {
  account_id   = lower("${var.service_account_name}")
  display_name = "GitLab Workload Identity Service Account (TF)"
}

resource "google_project_iam_member" "roles" {
  for_each = toset(var.iam_roles)
  project  = var.gcp_project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.service_account.email}"

  depends_on = [google_service_account.service_account]
}

## ---------------------------------------------------------------------------------------------------------------------
## Workload Identity Provider & Pool
## ---------------------------------------------------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "gitlab" {
  workload_identity_pool_id = lower("gitlab-oidc-pool")
  display_name              = "GitLab OIDC Pool"
  description               = "Workload Identity Pool for GitLab OIDC"
}

resource "google_iam_workload_identity_pool_provider" "gitlab" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.gitlab.workload_identity_pool_id
  workload_identity_pool_provider_id = lower("gitlab-oidc-provider")
  display_name                       = "GitLab OIDC Provider"
  description                        = "Identity pool provider for GitLab OIDC"

  attribute_condition = "assertion.project_path == \"${var.gitlab_namespace}/${var.gitlab_project_name}\""
  attribute_mapping = {
    "google.subject"           = "assertion.sub",
    "attribute.aud"            = "assertion.aud",
    "attribute.project_path"   = "assertion.project_path",
    "attribute.project_id"     = "assertion.project_id",
    "attribute.namespace_id"   = "assertion.namespace_id",
    "attribute.namespace_path" = "assertion.namespace_path",
    "attribute.user_email"     = "assertion.user_email",
    "attribute.ref"            = "assertion.ref",
    "attribute.ref_type"       = "assertion.ref_type",
  }

  oidc {
    allowed_audiences = [var.gitlab_url]
    issuer_uri        = var.gitlab_url
  }

  depends_on = [google_iam_workload_identity_pool.gitlab]
}


## ---------------------------------------------------------------------------------------------------------------------
## Workload Identity / Service Account Binding
## ---------------------------------------------------------------------------------------------------------------------

# Allow GitLab to impersonate the service account
resource "google_service_account_iam_binding" "service-account-wi-binding" {
  service_account_id = google_service_account.service_account.id
  role               = "roles/iam.workloadIdentityUser"
  members            = ["principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.gitlab.workload_identity_pool_id}/attribute.namespace_path/${var.gitlab_namespace}"]

  depends_on = [google_iam_workload_identity_pool_provider.gitlab, google_service_account.service_account]
}
