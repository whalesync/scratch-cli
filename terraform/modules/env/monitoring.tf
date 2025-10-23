locals {
  display_env                = title(var.env_name)
  renotify_interval          = "1800s"  # 30 mins
  extended_renotify_interval = "21600s" # 6 hours
  notification_channels = compact([
    var.enable_email_notifications ? google_monitoring_notification_channel.team_email[0].name : "",
    var.enable_pagerduty_notifications ? google_monitoring_notification_channel.pagerduty[0].name : "",
  ])
  warning_notification_channels = compact([
    var.enable_email_notifications ? google_monitoring_notification_channel.team_email[0].name : "",
  ])
  alert_database_id             = "${var.gcp_project_id}:${module.db_primary.instance_id}"
  db_connection_alert_threshold = var.db_connection_limit * 0.95
  alert_redis_id                = "projects/${var.gcp_project_id}/locations/${var.gcp_region}/instances/${local.redis_name}"
  playbook_link                 = "https://www.notion.so/whalesync/Playbook-Firefighing-and-On-Call-GCP-c1914705f4ed45eba45d6c92e786ddfa?pvs=4"
}

## ---------------------------------------------------------------------------------------------------------------------
## Notification Channels
## ---------------------------------------------------------------------------------------------------------------------

resource "google_monitoring_notification_channel" "team_email" {
  count = var.enable_email_notifications ? 1 : 0

  display_name = "Team Email"
  type         = "email"
  labels = {
    email_address = var.alert_notification_email
  }
  force_delete = false
  depends_on   = [google_project_service.services]
}

resource "google_monitoring_notification_channel" "pagerduty" {
  count = var.enable_pagerduty_notifications ? 1 : 0

  display_name = "GCP Bottlenose Prod"
  description  = "PagerDuty alerting channel"
  type         = "pagerduty"
  #sensitive_labels {
  #  # TODO: Set Pagerduty key
  #  service_key = data.google_secret_manager_secret_version.pagerduty_integration_key.secret_data
  #}
  force_delete = false
  depends_on   = [google_project_service.services]
}

## ---------------------------------------------------------------------------------------------------------------------
## Intrusion detection system notifications (Vanta)
## ---------------------------------------------------------------------------------------------------------------------

resource "google_logging_metric" "intrusion_detection_system_notifications" {
  count  = var.enable_intrusion_detection ? 1 : 0
  name   = "intrusion-detection-metric"
  filter = "logName=\"projects/${var.gcp_project_id}/logs/ids.googleapis.com%2Fthreat\" AND resource.type=\"ids.googleapis.com/Endpoint\" AND jsonPayload.alert_severity=(\"HIGH\" OR \"CRITICAL\")"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "logName"
      value_type  = "STRING"
      description = "The name of the log where the intrusion was detected"
    }
  }

  label_extractors = {
    "logName" = "EXTRACT(logName)"
  }
  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "intrusion_detection_system_alert" {
  count        = var.enable_intrusion_detection ? 1 : 0
  display_name = "${local.display_env} Intrusion Detection System - Alert"
  enabled      = var.enable_alerts
  documentation {
    subject = "${local.display_env} Intrusion Detection System - Alert"
    content = "Ops Playbook: ${local.playbook_link}"
  }
  combiner = "OR"
  conditions {
    display_name = "Whalesync Vanta - Intrusion Detection System Logs"
    condition_threshold {
      filter     = "resource.type = \"ids.googleapis.com/Endpoint\" AND metric.type = \"logging.googleapis.com/user/${google_logging_metric.intrusion_detection_system_notifications[0].name}\""
      duration   = "60s"
      comparison = "COMPARISON_GT"

      threshold_value = 1
      trigger {
        count = 1
      }
    }
  }

  alert_strategy {
    notification_channel_strategy {
      renotify_interval = local.renotify_interval
    }
  }

  notification_channels = local.notification_channels
  severity              = "ERROR"

  depends_on = [google_project_service.services]
}

resource "google_cloud_ids_endpoint" "intrusion_detection_system_endpoint" {
  count      = var.enable_intrusion_detection ? 1 : 0
  name       = "ids-endpoint"
  location   = var.gcp_zone
  network    = module.vpc.network_id
  severity   = "LOW"
  depends_on = [module.vpc.private_service_connection]
}

resource "google_compute_packet_mirroring" "intrusion_detection_system_packet_mirroring" {
  count       = var.enable_intrusion_detection ? 1 : 0
  name        = "ids-packet-mirroring"
  description = "Packet mirroring for Cloud IDS"
  region      = var.gcp_region
  network {
    url = module.vpc.network_id
  }
  collector_ilb {
    url = google_cloud_ids_endpoint.intrusion_detection_system_endpoint[0].endpoint_forwarding_rule
  }
  mirrored_resources {
    subnetworks {
      url = module.vpc.subnets_id[0]
    }
  }
  filter {
    ip_protocols = ["tcp"]
    cidr_ranges  = ["0.0.0.0/0"]
    direction    = "BOTH"
  }
  depends_on = [google_project_service.services, module.vpc]
}
