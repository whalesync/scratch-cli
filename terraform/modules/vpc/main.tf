/**
  * Virtual Private Cloud (VPC) module
  *
  * Creates a VPC network and a list of subnets within a specified GCP region.
*/

## ---------------------------------------------------------------------------------------------------------------------
## VPC Network
## ---------------------------------------------------------------------------------------------------------------------

# Main VPC
resource "google_compute_network" "private_network" {
  name                    = var.network_name
  project                 = var.gcp_project_id
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"

  # Default MTU for a VPC
  mtu = 1460
}

# Subnet
resource "google_compute_subnetwork" "private_subnetwork" {
  count                    = length(var.custom_subnetworks)
  name                     = "${var.network_name}-${var.custom_subnetworks[count.index].region}-subnet-${count.index + 1}"
  project                  = var.gcp_project_id
  region                   = var.custom_subnetworks[count.index].region
  ip_cidr_range            = var.custom_subnetworks[count.index].ip_cidr_range
  private_ip_google_access = true

  log_config {
    aggregation_interval = var.flow_aggregation_interval
    flow_sampling        = var.flow_sampling
    metadata             = "INCLUDE_ALL_METADATA"
  }

  network = google_compute_network.private_network.id
}


## ---------------------------------------------------------------------------------------------------------------------
## Private Service Connection
## ---------------------------------------------------------------------------------------------------------------------
// Allow communication between Google Managed Services and the private VPC network
// Required to connect to a service like Cloud SQL

resource "google_compute_global_address" "private_ip_alloc" {
  count         = var.enable_private_service_connect ? 1 : 0
  name          = "${var.network_name}-private-ip-alloc"
  project       = var.gcp_project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.private_network.id
}

resource "google_service_networking_connection" "vpc_connection" {
  count                   = var.enable_private_service_connect ? 1 : 0
  network                 = google_compute_network.private_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc[0].name]

  depends_on = [
    google_compute_global_address.private_ip_alloc
  ]
}

## ---------------------------------------------------------------------------------------------------------------------
## Firewall Rules
## ---------------------------------------------------------------------------------------------------------------------

// Allow IAP
resource "google_compute_firewall" "enable_iap" {
  count   = var.enable_iap ? 1 : 0
  name    = "${var.network_name}-allow-ingress-from-iap"
  project = var.gcp_project_id
  network = google_compute_network.private_network.self_link

  allow {
    protocol = "tcp"
    ports    = ["22", "3389"]
  }

  source_ranges = ["35.235.240.0/20"]
}


// Allow SSH
resource "google_compute_firewall" "enable_ssh" {
  count   = var.enable_ssh ? 1 : 0
  name    = "${var.network_name}-allow-ssh"
  project = var.gcp_project_id
  network = google_compute_network.private_network.self_link

  allow {
    protocol = "tcp"
    ports    = ["22", ]
  }

  source_ranges = ["0.0.0.0/0"]
}

