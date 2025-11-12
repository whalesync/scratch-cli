/**
  * Memorystore Module (Redis)
  *
*/

locals {
  // Validate values
  validate_secondary_zone            = (var.secondary_zone != null && !var.enable_ha) ? tobool("Secondary zone is only applicable to HA instances. Set enable_ha to true to or remove secondary_zone value.") : true
  validate_secondary_zone_uniqueness = (var.secondary_zone != null && var.primary_zone == var.secondary_zone) ? tobool("Secondary zone must be different from primary zone.") : true

  // Derived values
  tier               = var.enable_ha ? "STANDARD_HA" : "BASIC"
  connect_mode       = var.use_direct_peering ? "DIRECT_PEERING" : "PRIVATE_SERVICE_ACCESS"
  read_replicas_mode = var.enable_read_replicas ? "READ_REPLICAS_ENABLED" : "READ_REPLICAS_DISABLED"
}

// Create Redis instance
resource "google_redis_instance" "cache" {
  name           = var.name
  display_name   = var.display_name
  memory_size_gb = var.memory_size_gb
  tier           = local.tier
  redis_version  = var.redis_version
  auth_enabled   = true

  region                  = var.region
  location_id             = var.primary_zone
  alternative_location_id = var.secondary_zone

  authorized_network = var.private_network_id
  connect_mode       = local.connect_mode

  read_replicas_mode = local.read_replicas_mode
  replica_count      = var.replica_count

  labels = var.labels

  redis_configs = {
    "maxmemory-policy" = var.eviction_policy
  }

  // Set config of RDB snapshots (ie cache backups). Adds no extra cost to instance billing.
  // More information here https://cloud.google.com/memorystore/docs/redis/about-rdb-snapshots
  dynamic "persistence_config" {
    for_each = var.disable_snapshots ? [] : [1]
    content {
      persistence_mode    = "RDB"
      rdb_snapshot_period = "TWENTY_FOUR_HOURS"
    }
  }
}
