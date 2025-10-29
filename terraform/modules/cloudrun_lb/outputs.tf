output "ip_address" {
  description = "The IP address of the load balancer"
  value       = google_compute_global_address.default.address
}

output "ssl_certificate_id" {
  description = "The ID of the SSL certificate"
  value       = google_compute_managed_ssl_certificate.default.id
}

output "backend_service_id" {
  description = "The ID of the backend service"
  value       = google_compute_backend_service.default.id
}

output "domains" {
  description = "The domains configured for the load balancer"
  value       = var.domains
}
