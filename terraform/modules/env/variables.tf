variable "env_name" {
  type        = string
  description = "Name of the environment: test | staging | production"
}

variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID where resources are to be deployed"
}

variable "gcp_project_number" {
  type        = number
  description = "The number of the GCP project"
}

variable "gcp_region" {
  type        = string
  description = "Region where cloud resources are to be created."
}

variable "gcp_zone" {
  description = "GCP zone for resources"
  type        = string
}

variable "as_gitlab" {
  type        = bool
  default     = false
  description = "Use the GitLab service account to run Terraform"
}

variable "db_version" {
  type    = string
  default = "POSTGRES_15"
}

variable "db_tier" {
  type = string
  # Format is "db-custom-<NUM VCPUS>-<MEMORY IN MB>"
  default = "db-custom-2-8192"
}

variable "db_disk_size" {
  type        = number
  default     = 10
  description = "The initial size of the disk in GB"
}

variable "db_maintenance_day" {
  type    = number
  default = 7
}

variable "db_maintenance_hour" {
  type    = number
  default = 2
}

variable "db_backup_start_time" {
  type    = string
  default = "03:00"
}

variable "db_connection_limit" {
  type        = number
  default     = 400
  description = "Maximum number of connections to the database."
}

variable "db_io_read_limit" {
  type        = number
  default     = 300
  description = "Maximum number of read IOPS allowed by the CloudSQL database."
}

variable "db_io_write_limit" {
  type        = number
  default     = 300
  description = "Maximum number of write IOPS allowed by the CloudSQL database."
}

variable "db_high_availability" {
  type        = bool
  description = "Whether to enable high availability for the Cloud SQL instance. If enabled, a failover replica is automatically created."
  default     = true
}

variable "redis_memory_size_gb" {
  type        = number
  default     = 1
  description = "Redis memory size in GiB."
}

variable "redis_enable_ha" {
  type        = bool
  default     = false
  description = "Enable Redis High Availability"
}

variable "enable_intrusion_detection" {
  type        = bool
  default     = true
  description = "Whether to enable Cloud IDS. This is expensive so it's only needed in prod environments."
}

variable "enable_alerts" {
  type        = bool
  default     = true
  description = "Whether to enable alerts for the environment."
}

variable "enable_email_notifications" {
  type        = bool
  default     = true
  description = "Whether to enable the email notification channel for alerts."
}

variable "alert_notification_email" {
  type        = string
  default     = "team@whalesync.com"
  description = "Email address to send alerts to."
}

variable "enable_pagerduty_notifications" {
  type        = bool
  default     = false
  description = "Whether to enable the Pager Duty notification channel for alerts."
}
