resource "google_compute_router" "router" {
  project = var.gcp_project_id
  name    = "nat-router"
  network = var.vpc_network_name
  region  = var.gcp_region
}

resource "google_compute_address" "nat_egress" {
  name         = "nat-egress-ip"
  region       = var.gcp_region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"
  project      = var.gcp_project_id

  description = "Static IP for Cloud NAT egress - customers can whitelist this IP"
}

resource "google_compute_router_nat" "nat" {
  name                               = "my-router-nat"
  router                             = google_compute_router.router.name
  region                             = var.gcp_region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.nat_egress.self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}