output "cloud_run_environment" {
  value = module.production.cloud_run_environment
}

output "gitlab_oidc_service_account" {
  value = module.production.gitlab_oidc_service_account
}

output "database_url" {
  value     = module.production.database_url
  sensitive = true
}

output "redis_host" {
  value = module.production.redis_host
}

output "redis_password" {
  value     = module.production.redis_password
  sensitive = true
}

