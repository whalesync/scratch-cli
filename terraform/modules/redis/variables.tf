# Memorystore Module (Redis) Variables

# Required Variables
variable "name" {
  type        = string
  description = "The ID of the instance or a fully qualified identifier for the instance."
}

variable "memory_size_gb" {
  type        = number
  description = " Redis memory size in GiB."
}

# Optional Variables
variable "disable_snapshots" {
  type        = bool
  description = "Disable RDB snapshots. Default is snapshots enabled once a day."
  default     = false
}

variable "display_name" {
  type        = string
  description = "An arbitrary and optional user-provided name for the instance."
  default     = null
}

variable "enable_ha" {
  type        = bool
  description = "value"
  default     = false
}

variable "enable_read_replicas" {
  type        = bool
  description = "Enable read replica mode. Can only be specified when trying to create the instance."
  default     = false
}

variable "region" {
  type        = string
  description = "The region where the instance will be provisioned."
  default     = null
}

variable "primary_zone" {
  type        = string
  description = "The zone where the instance will be provisioned. If not provided, the service will choose a zone for the instance."
  default     = null
}

variable "private_network_id" {
  type        = string
  description = "The full name of the Google Compute Engine network to which the instance is connected. If left unspecified, the default network will be used."
  default     = null
}

variable "replica_count" {
  type        = number
  description = "For use when read replicas are enabled. The number of replica nodes. The valid range for the Standard Tier with read replicas enabled is [1-5]."
  default     = null
}

variable "redis_version" {
  type        = string
  description = "The version of Redis software. If not provided, latest supported version will be used."
  default     = null
  // values accepted today: REDIS_3_2, REDIS_4_0, REDIS_5_0, REDIS_6_X
  // see redisVersion here: https://cloud.google.com/memorystore/docs/redis/reference/rest/v1/projects.locations.instances
}

variable "secondary_zone" {
  type        = string
  description = "Only applicable to STANDARD_HA tier which protects the instance against zonal failures by provisioning it across two zones. If provided, it must be a different zone from the one provided in primary_zone."
  default     = null
}

// CloudWerx recommends using Private Service Connect for peering with a Redis instance. Direct peering is also avaialable.
// CloudWerx's VPC module will create a Private Service Connect connection for you.
// See here for more information: https://cloud.google.com/memorystore/docs/redis/networking
variable "use_direct_peering" {
  type        = bool
  description = "value"
  default     = false
}

variable "labels" {
  type        = map(string)
  description = "Labels to apply to the Redis instance."
  default     = {}
}
