locals {
  # Generate a random UUID when force_reload_services is true to trigger service redeployment
  force_reload_uuid = var.force_reload_services ? uuid() : null
}

#region client_service

resource "google_cloud_run_v2_service" "client_service" {
  name     = "client-service"
  location = "us-central1"

  deletion_protection = false

  template {
    # Use gen1 environment for faster cold starts.
    execution_environment = "EXECUTION_ENVIRONMENT_GEN1"

    scaling {
      min_instance_count = var.client_service_min_instance_count
      max_instance_count = var.client_service_max_instance_count
    }
    service_account = module.iam-sa.service_accounts["cloudrun-service-account"].email
    vpc_access {
      network_interfaces {
        network    = module.vpc.network_id
        subnetwork = module.vpc.subnets_id[0]
      }
    }

    containers {
      image = "${local.artifact_registry_url}/spinner-client:latest"

      resources {
        limits = {
          cpu    = var.client_service_cpu_limit
          memory = var.client_service_memory_limit
        }
        cpu_idle = true # This service responds to requests so it doesn't need CPU all the time.
      }

      env {
        name  = "SERVICE_TYPE"
        value = "client"
      }
      env {
        name  = "GCP_PROJECT_NUMBER"
        value = var.gcp_project_number
      }
      env {
        name = "CLERK_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = "CLERK_SECRET_KEY"
            version = "latest"
          }
        }
      }
      env {
        name  = "NODE_OPTIONS"
        value = var.client_service_node_options
      }

      dynamic "env" {
        for_each = var.force_reload_services ? [1] : []
        content {
          name  = "FORCE_RELOAD"
          value = local.force_reload_uuid
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 3
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # Ignore changes to the image version after initial creation
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_service_iam_member" "client_service_public" {
  service  = google_cloud_run_v2_service.client_service.name
  location = google_cloud_run_v2_service.client_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

## ---------------------------------------------------------------------------------------------------------------------
## Load Balancer for Client Service
## ---------------------------------------------------------------------------------------------------------------------

module "client_lb" {
  count  = var.enable_client_load_balancer ? 1 : 0
  source = "../../modules/cloudrun_lb"

  name                   = "${var.env_name}-client"
  region                 = var.gcp_region
  cloud_run_service_name = google_cloud_run_v2_service.client_service.name
  domains                = [var.client_domain]
  enable_cdn             = var.enable_client_cdn
  enable_http_redirect   = true
  log_sample_rate        = 1.0

  depends_on = [google_cloud_run_v2_service.client_service]
}

#endregion

#region api_service

resource "google_cloud_run_v2_service" "api_service" {
  name     = "api-service"
  location = "us-central1"

  deletion_protection = false

  template {
    # Use gen1 environment for faster cold starts.
    execution_environment = "EXECUTION_ENVIRONMENT_GEN1"

    scaling {
      min_instance_count = var.api_service_min_instance_count
      max_instance_count = var.api_service_max_instance_count
    }
    service_account = module.iam-sa.service_accounts["cloudrun-service-account"].email
    vpc_access {
      network_interfaces {
        network    = module.vpc.network_id
        subnetwork = module.vpc.subnets_id[0]
      }
    }

    containers {
      image = "${local.artifact_registry_url}/spinner-server:latest"

      resources {
        limits = {
          cpu    = var.api_service_cpu_limit
          memory = var.api_service_memory_limit
        }
        cpu_idle = true # This service responds to requests so it doesn't need CPU all the time.
      }

      dynamic "env" {
        for_each = {
          "APP_ENV" : var.env_name,
          "AUTO_CREATE_TRIAL_SUBSCRIPTION" : "true",
          "GCP_PROJECT_NUMBER" : var.gcp_project_number,
          "GENERATE_OPENROUTER_KEY_FOR_NEW_USERS" : "true",
          "NEW_USER_OPENROUTER_CREDIT_LIMIT" : "5",
          "NODE_ENV" : "production",
          "NODE_OPTIONS" : var.api_service_node_options,
          "NOTION_PAGE_SIZE" : "100",
          "POSTHOG_HOST" : "https://us.i.posthog.com",
          "REDIRECT_URI" : "https://${var.client_domain}/oauth/callback",
          "REDIS_HOST" : module.redis.host,
          "REDIS_PASSWORD" : module.redis.password,
          "REDIS_PORT" : module.redis.port,
          "REQUIRE_SUBSCRIPTION" : "true",
          "SCRATCHPAD_AGENT_JWT_EXPIRES_IN" : "6h",
          "SERVICE_TYPE" : "monolith",
          "SLACK_NOTIFICATION_ENABLED" : "true",
          "TRIAL_REQUIRE_PAYMENT_METHOD" : "false",
          "USE_JOBS" : "true",
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      # Inject the following secrets into the container as env vars
      dynamic "env" {
        for_each = [
          "CLERK_PUBLISHABLE_KEY",
          "CLERK_SECRET_KEY",
          "DATABASE_URL",
          "ENCRYPTION_MASTER_KEY",
          "GEMINI_API_KEY",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "NOTION_CLIENT_ID",
          "NOTION_CLIENT_SECRET",
          "OPENROUTER_PROVISIONING_KEY",
          "POSTHOG_API_KEY",
          "POSTHOG_FEATURE_FLAG_API_KEY",
          "SCRATCHPAD_AGENT_AUTH_TOKEN",
          "SCRATCHPAD_AGENT_JWT_SECRET",
          "SLACK_NOTIFICATION_WEBHOOK_URL",
          "STRIPE_API_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "WEBFLOW_CLIENT_ID",
          "WEBFLOW_CLIENT_SECRET",
          "WIX_CLIENT_ID",
          "WIX_CLIENT_SECRET"
        ]
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
      dynamic "env" {
        for_each = var.force_reload_services ? [1] : []
        content {
          name  = "FORCE_RELOAD"
          value = local.force_reload_uuid
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 3
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # Ignore changes to the image version after initial creation
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_service_iam_member" "api_service_public" {
  service  = google_cloud_run_v2_service.api_service.name
  location = google_cloud_run_v2_service.api_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

module "api_lb" {
  source = "../../modules/cloudrun_lb"

  name                   = "${var.env_name}-api"
  region                 = var.gcp_region
  cloud_run_service_name = google_cloud_run_v2_service.api_service.name
  domains                = [var.api_domain]
  enable_cdn             = false
  enable_http_redirect   = true
  log_sample_rate        = 1.0
}

#endregion

#region agent_service

resource "google_cloud_run_v2_service" "agent_service" {
  name     = "agent-service"
  location = "us-central1"

  deletion_protection = false

  template {
    # Use gen1 environment for faster cold starts.
    execution_environment = "EXECUTION_ENVIRONMENT_GEN1"

    scaling {
      min_instance_count = var.agent_service_min_instance_count
      max_instance_count = var.agent_service_max_instance_count
    }
    service_account = module.iam-sa.service_accounts["cloudrun-service-account"].email
    vpc_access {
      network_interfaces {
        network    = module.vpc.network_id
        subnetwork = module.vpc.subnets_id[0]
      }
    }

    containers {
      image = "${local.artifact_registry_url}/spinner-agent:latest"
      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = var.agent_service_cpu_limit
          memory = var.agent_service_memory_limit
        }
        cpu_idle = true # This service responds to requests so it doesn't need CPU all the time.
      }

      dynamic "env" {
        for_each = {
          "APP_ENV" : var.env_name,
          "GCP_PROJECT_NUMBER" : var.gcp_project_number,
          "NODE_ENV" : "production",
          "NODE_OPTIONS" : var.agent_service_node_options,
          "LOGFIRE_ENABLE_FULL_INSTRUMENTATION" : "false",
          "LOGFIRE_ENVIRONMENT" : var.env_name,
          "MODEL_NAME" : "openai/gpt-4o-mini",
          "REQUIRE_USER_AGENT_CREDENTIALS" : "false",
          "SCRATCHPAD_SERVER_URL" : "https://${var.api_domain}",
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      # Inject the following secrets into the container as env vars
      dynamic "env" {
        for_each = [
          "GEMINI_API_KEY",
          "LOGFIRE_TOKEN",
          "OPENROUTER_API_KEY",
          "SCRATCHPAD_AGENT_AUTH_TOKEN",
          "SCRATCHPAD_AGENT_JWT_SECRET",
        ]
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
      dynamic "env" {
        for_each = var.force_reload_services ? [1] : []
        content {
          name  = "FORCE_RELOAD"
          value = local.force_reload_uuid
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 3
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 3
        timeout_seconds       = 3
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # Ignore changes to the image version after initial creation
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_service_iam_member" "agent_service_public" {
  service  = google_cloud_run_v2_service.agent_service.name
  location = google_cloud_run_v2_service.agent_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

module "agent_lb" {
  source = "../../modules/cloudrun_lb"

  name                   = "${var.env_name}-agent"
  region                 = var.gcp_region
  cloud_run_service_name = google_cloud_run_v2_service.agent_service.name
  domains                = [var.agent_domain]
  enable_cdn             = false
  enable_http_redirect   = true
  log_sample_rate        = 1.0
}

#endregion
