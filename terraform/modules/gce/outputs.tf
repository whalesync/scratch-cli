output "instance_name" {
  description = "Name of the created GCE instance"
  value       = google_compute_instance.instance.name
}

/* output "instance_ip" {
  description = "External IP address of the created GCE instance"
  value       = google_compute_instance.instance.network_interface[0].access_config[0].nat_ip
} */
