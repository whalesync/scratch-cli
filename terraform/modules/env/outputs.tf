output "client_lb_ip_address" {
  description = "The IP address of the client load balancer (use this for DNS A record)"
  value       = var.enable_client_load_balancer ? module.client_lb[0].ip_address : null
}

output "client_domain" {
  description = "The configured domain for the client service"
  value       = var.enable_client_load_balancer ? var.client_domain : null
}
