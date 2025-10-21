output "oidc_wip_id" {
  value       = google_iam_workload_identity_pool.gitlab.workload_identity_pool_id
  description = "GCP Workload Identity Pool ID"
}

output "oidc_wip_provider_id" {
  value       = google_iam_workload_identity_pool_provider.gitlab.workload_identity_pool_provider_id
  description = "GCP Workload Identity Pool Provider ID"
}

output "oidc_service_account_email" {
  value       = google_service_account.service_account.email
  description = "OIDC Service Account ID"
}
