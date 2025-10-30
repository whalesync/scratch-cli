locals {
  # Generate a random UUID when force_reload_services is true to trigger service redeployment
  force_reload_uuid = var.force_reload_services ? uuid() : null
}

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
        cpu_idle = true # Dusky responds to requests so it doesn't need CPU all the time.
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
      #template[0].containers[0].image, # Ignore changes to the image version after initial creation
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

  name                    = "${var.env_name}-client"
  region                  = var.gcp_region
  cloud_run_service_name  = google_cloud_run_v2_service.client_service.name
  domains                 = [var.client_domain]
  enable_cdn              = var.enable_client_cdn
  enable_http_redirect    = true
  log_sample_rate         = 1.0

  depends_on = [google_cloud_run_v2_service.client_service]
}
