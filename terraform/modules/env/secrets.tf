locals {
  # Read the list of secrets from secrets.txt in the terraform directory.
  required_secrets = toset(compact(
    [
      for line in split("\n", file("${path.module}/../../secrets.txt")) :
      trimspace(line)
      if !startswith(line, "#")
    ]
  ))
}

# This output exists only for importing the existing secrets in each deploy. We can delete it after importing.
output "secrets" {
  value = local.required_secrets
}

# Manage all required secrets in Terraform, but not their values.
resource "google_secret_manager_secret" "required" {
  for_each  = local.required_secrets
  secret_id = each.key

  replication {
    auto {}
  }
}

# Memorystore Redis instances generate and expose an auth string internally,
# so write it to a secret version automatically.
resource "google_secret_manager_secret_version" "REDIS_PASSWORD" {
  secret      = google_secret_manager_secret.required["REDIS_PASSWORD"].id
  secret_data = module.redis.password
}

# Secret values accessed from Terraform:
# The following data resources pull in the values for secrets to pass to other resources.
# All access to secrets should be done here so we can manage them in one place.

data "google_secret_manager_secret_version" "pagerduty_integration_key" {
  count  = var.enable_pagerduty_notifications ? 1 : 0
  secret = "PAGERDUTY_INTEGRATION_KEY"
}
