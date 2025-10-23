# Cloud SQL Module Variables

# Required variables
variable "database_version" {
  type        = string
  description = "The MySQL, PostgreSQL or SQL Server version to use."
}

variable "name" {
  type        = string
  description = "The name of the Cloud SQL instance. The module will add a random element to the end of the name, as after a name is used it cannot be reused for a week."
}

variable "password" {
  type        = string
  description = "The root password for the Cloud SQL database"
  sensitive   = true
}

variable "private_network_id" {
  type        = string
  description = "The VPC network from which the Cloud SQL instance is accessible for private IP. Your Cloud SQL module likely will depend_on a VPC resource."
}

variable "region" {
  type        = string
  description = "Region where Cloud SQL Database is to be created"
}

variable "tier" {
  type        = string
  description = "The machine type to use. See Cloud SQL tiers for more details and supported versions."
}

# Optional variables
variable "high_availability" {
  type        = bool
  description = "Whether to enable high availability for the Cloud SQL instance. If enabled, a failover replica is automatically created."
  default     = true
}

variable "primary_zone" {
  type        = string
  description = "The zone to deploy the primary instance of the database."
  default     = null
}

variable "secondary_zone" {
  type        = string
  description = "The zone to deploy the replica instance of the database if HA is desired."
  default     = null
}

variable "maintenance_day" {
  description = "The day of the week for maintenance"
  type        = number
  default     = 7 # 7: Sunday
}

variable "maintenance_hour" {
  description = "The hour of the day for maintenance in UTC (24-hour format)"
  type        = number
  default     = 2 # 2: 2 AM UTC
}

variable "backup_enabled" {
  type        = bool
  description = "A boolean that specifies whether automated backups are enabled or not. Setting this to true enables automated backups."
  default     = true
}

variable "backup_start_time" {
  type        = string
  description = "A string in the format of HH:MM, representing the time in UTC when the backup window starts. Google Cloud SQL begins the backup process within this window."
  default     = "03:00"
}

variable "backup_location" {
  description = "A string specifying the GCP region where the backup will be stored. This should be a valid region where Google Cloud SQL operates"
  type        = string
  default     = "us-central1"
}

variable "disk_size" {
  description = "The initial size of the disk in GB"
  type        = number
  default     = 10
}

variable "labels" {
  type        = map(string)
  description = "Labels to apply to the Cloud SQL instance."
  default     = {}
}
