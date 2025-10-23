/**
  * Cloud SQL Module Outputs
*/

output "host_ip_address" {
  value       = google_sql_database_instance.primary.private_ip_address
  description = "The private network IP address that can be used to connect to the instance."
}

output "primary_connection_name" {
  value       = google_sql_database_instance.primary.connection_name
  description = "The connection name to use when connecting to the instance."
}

output "instance_id" {
  value       = google_sql_database_instance.primary.id
  description = "The id of the instance"
}