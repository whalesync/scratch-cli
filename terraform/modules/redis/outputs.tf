/**
  * Memorystore (Redis) Module Outputs
*/

output "host" {
  value       = google_redis_instance.cache.host
  description = "Hostname or IP address of the Redis instance."
}

output "instance_name" {
  value       = google_redis_instance.cache.name
  description = "The Redis instance name / ID."
}

output "password" {
  value       = google_redis_instance.cache.auth_string
  description = "Internally generated password of the Redis instance."
}

output "port" {
  value       = google_redis_instance.cache.port
  description = "Exposed port of the Redis instance."
}
