output "gitlab_oidc_service_account" {
  value = module.test.gitlab_oidc_service_account
}

output "database_url" {
  value     = module.test.database_url
  sensitive = true
}

output "redis_host" {
  value = module.test.redis_host
}

output "redis_password" {
  value     = module.test.redis_password
  sensitive = true
}

