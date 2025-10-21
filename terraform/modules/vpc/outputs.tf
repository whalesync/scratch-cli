/**
  * VPC Module Outputs
*/

output "network" {
  value       = google_compute_network.private_network.self_link
  description = "The network created by the VPC module."
}

output "network_id" {
  value       = google_compute_network.private_network.id
  description = "Network ID in the format projects/{{project}}/global/networks/{{name}}"
}

output "network_name" {
  value       = google_compute_network.private_network.name
  description = "Network name as passed in via the network_name variable."
}

output "subnets" {
  value       = length(var.custom_subnetworks) > 0 ? google_compute_subnetwork.private_subnetwork[*].self_link : []
  description = "The subnetwork created by the VPC module. Only available when custom_subnetworks are provided."
}

output "subnets_id" {
  value       = length(var.custom_subnetworks) > 0 ? google_compute_subnetwork.private_subnetwork[*].id : []
  description = "The subnetwork ids abs path."
}

output "private_service_connection" {
  value       = google_service_networking_connection.vpc_connection
  description = "The private service connection created by the VPC module. Only available when enable_private_service_connect is true."
}
