locals {
  ready_to_deploy_iam      = var.bootstrap_deploy_stage >= 1
  ready_to_deploy_network  = var.bootstrap_deploy_stage >= 2
  ready_to_deploy_dbs      = var.bootstrap_deploy_stage >= 3
  ready_to_deploy_services = var.bootstrap_deploy_stage >= 4

  artifact_registry_url = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${var.env_name}-registry"

  # APIs
  enabled_apis = [
    "cloudkms.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "datamigration.googleapis.com",
    "iap.googleapis.com",
    "identitytoolkit.googleapis.com",
    "ids.googleapis.com",
    "networkmanagement.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "serviceusage.googleapis.com",
    "sqladmin.googleapis.com",
    "sheets.googleapis.com",
    "drive.googleapis.com",
    "aiplatform.googleapis.com"
  ]

  # IAM
  service_accounts = [
    {
      name        = "cloudrun-service-account"
      account_id  = "cloudrun-service-account"
      description = "Cloud Run service account"
      service_account_users = [
        "serviceAccount:${local.gitlab_service_account_name}@${var.gcp_project_id}.iam.gserviceaccount.com"
      ]
      roles = []
    },
    {
      name        = "cloudsql-proxy-service-account"
      account_id  = "cloudsql-proxy-service-account"
      description = "Service account for the GCE VM that serves as the Cloud SQL Auth Proxy bastion host"
      roles = [
        "roles/cloudsql.client"
      ]
    },
  ]

  # Name of the the Gitlab service account
  gitlab_service_account_name = "gitlab-service-account"

  # Name of the custom role for the Gitlab service account
  gitlab_custom_role_name = "gitlab_service_account_role"

  # Add roles here to fix missing permissions on Terraform deploy
  # Most areas will need at least an "editor" type role, if not "admin" because Terraform will need the ability to create and update resources.
  terraform_roles = [
    "projects/${var.gcp_project_id}/roles/${local.gitlab_custom_role_name}",
    "roles/artifactregistry.repoAdmin",
    "roles/cloudkms.admin",
    "roles/cloudsql.editor",
    "roles/compute.instanceAdmin.v1",
    "roles/compute.loadBalancerAdmin",
    "roles/compute.networkAdmin",
    "roles/compute.securityAdmin",
    "roles/iam.roleViewer",           # This won't allow creating/updating roles, but should help avoid privilege escalation
    "roles/iam.serviceAccountViewer", # This won't allow creating/updating service accounts, but should help avoid privilege escalation
    "roles/iam.workloadIdentityPoolViewer",
    "roles/iap.tunnelResourceAccessor",
    "roles/ids.admin",
    "roles/logging.admin",
    "roles/monitoring.admin",
    "roles/redis.editor",
    "roles/run.developer",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/storage.admin",
  ]

  # DevOps who need admin access to the project and the ability to run terraform deploys locally
  operations_roles = [
    "roles/artifactregistry.admin",
    "roles/browser",
    "roles/cloudkms.admin",
    "roles/cloudsql.admin",
    "roles/compute.admin",
    "roles/errorreporting.admin",
    "roles/iam.roleAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/iap.admin",
    "roles/redis.admin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/run.admin",
    "roles/securitycenter.adminEditor",
    "roles/vpcaccess.admin",
    "roles/oauthconfig.editor",
    "roles/securitycenter.settingsEditor",
    "roles/aiplatform.expressAdmin",
  ]

  # Developers with mainly read-only access to the project
  developer_roles = [
    "roles/browser",
    "roles/cloudsql.viewer",
    "roles/cloudsql.studioUser",
    "roles/compute.viewer",
    "roles/storage.objectUser",
    "roles/secretmanager.secretAccessor",
    "roles/secretmanager.viewer",
    "roles/iam.serviceAccountUser",
    "roles/redis.viewer",
    "roles/artifactregistry.reader",
    "roles/artifactregistry.reader",
    "roles/run.developer",
    "roles/monitoring.viewer",
    "roles/logging.viewer",
    "roles/vpcaccess.viewer",
    "roles/iam.roleViewer",
    "roles/errorreporting.viewer",
    "roles/oauthconfig.editor",
    "roles/aiplatform.expressUser",
  ]

  # Assignments of roles to users, groups, and service accounts
  # See https://cloud.google.com/iam/docs/overview#concepts_related_identity for what can be used as a principal.
  principals_to_roles = {
    # Groups that are defined and administrated at the organization level (whalesync.com)
    "group:role_operations@whalesync.com" : [local.terraform_roles, local.operations_roles],
    "group:role_developers@whalesync.com" : local.developer_roles,
  }
  principal_role_pairs = flatten([for principal, roles in local.principals_to_roles : [for role in distinct(flatten(roles)) : { principal : principal, role : role }]])

  # VPC
  vpc_network_name = "${var.env_name}-vpc"
  custom_subnetworks = [
    {
      region        = "us-central1"
      ip_cidr_range = "192.168.0.0/20" # 192.168.0.0 - 192.168.15.255
    },
    {
      region        = "us-central1"
      ip_cidr_range = "192.168.16.0/20" # 192.168.16.0 - 192.168.31.255
    }
  ]

  # CloudProxy
  proxy_instance_name = "cloudsql-proxy"
}

## ---------------------------------------------------------------------------------------------------------------------
## Required Services
## ---------------------------------------------------------------------------------------------------------------------

resource "google_project_service" "services" {
  for_each           = toset(local.enabled_apis)
  service            = each.key
  disable_on_destroy = false
}

## ---------------------------------------------------------------------------------------------------------------------
## Artifact Registry
## ---------------------------------------------------------------------------------------------------------------------

resource "google_artifact_registry_repository" "default" {
  count                  = local.ready_to_deploy_services ? 1 : 0
  repository_id          = "${var.env_name}-registry"
  description            = "Scratchpaper ${var.env_name} registry"
  format                 = "DOCKER"
  cleanup_policy_dry_run = true
  location               = var.gcp_region
  docker_config {
    immutable_tags = false
  }
}

## ---------------------------------------------------------------------------------------------------------------------
## IAM Role Assignments
## ---------------------------------------------------------------------------------------------------------------------

resource "google_project_iam_member" "roles" {
  for_each = {
    for pair in
    (local.ready_to_deploy_iam ? local.principal_role_pairs : []) :
    "${pair.principal}:${pair.role}" => pair
  }
  project = var.gcp_project_id
  role    = each.value.role
  member  = each.value.principal
}

## ---------------------------------------------------------------------------------------------------------------------
## IAM Service Account
## ---------------------------------------------------------------------------------------------------------------------

module "iam-sa" {
  source           = "../../modules/iam_service_accounts"
  count            = local.ready_to_deploy_iam ? 1 : 0
  gcp_project_id   = var.gcp_project_id
  service_accounts = local.service_accounts
  depends_on       = [module.gl_oidc]
}

## ---------------------------------------------------------------------------------------------------------------------
## IAM OIDC Permissions
## ---------------------------------------------------------------------------------------------------------------------
module "gl_oidc" {
  source               = "../../modules/gitlab_oidc"
  count                = local.ready_to_deploy_iam ? 1 : 0
  service_account_name = local.gitlab_service_account_name
  gcp_project_id       = var.gcp_project_id
  gitlab_namespace     = "whalesync"
  gitlab_project_name  = "spinner"
  depends_on           = [google_project_iam_custom_role.gitlab_tf_service_account_role]
  iam_roles = concat(
    local.terraform_roles,
    ["roles/run.serviceAgent"]
  )
}

## ---------------------------------------------------------------------------------------------------------------------
## VPC
## ---------------------------------------------------------------------------------------------------------------------

module "vpc" {
  source                         = "../../modules/vpc"
  count                          = local.ready_to_deploy_network ? 1 : 0
  gcp_project_id                 = var.gcp_project_id
  network_name                   = local.vpc_network_name
  enable_private_service_connect = true
  custom_subnetworks             = local.custom_subnetworks
  flow_sampling                  = 1.0
}
