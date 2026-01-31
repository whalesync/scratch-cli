/**
  * Scratch Git Module Outputs
*/

output "instance_name" {
  description = "Name of the created GCE instance"
  value       = google_compute_instance.scratch_git.name
}

output "lb_ip" {
  description = "Internal IP of the load balancer VIP (use this for service discovery)"
  value       = google_compute_address.internal.address
}

output "instance_internal_ip" {
  description = "Direct internal IP of the GCE instance (for SSH/debugging)"
  value       = google_compute_instance.scratch_git.network_interface[0].network_ip
}
