output "nat_egress_ip" {
  description = "Static IP address for outbound traffic (for customer whitelisting)"
  value       = google_compute_address.nat_egress.address
}
