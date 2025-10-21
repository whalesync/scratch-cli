/**
  * VPC Module Variables
*/

## ---------------------------------------------------------------------------------------------------------------------
## Required Variables
## ---------------------------------------------------------------------------------------------------------------------

variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID where resources are to be deployed"
}

variable "network_name" {
  description = "The name of the VPC to create"
  type        = string
}

variable "custom_subnetworks" {
  description = "List of objects, each one for a subnet, each containing a region and ip range."
  type = list(object({
    region        = string
    ip_cidr_range = string
  }))
}

## ---------------------------------------------------------------------------------------------------------------------
## Optional Variables
## ---------------------------------------------------------------------------------------------------------------------

variable "enable_iap" {
  description = "Enable IAP traffic within the VPC. Required to SSH into VMs with Identity Aware Proxy. This is a secure option."
  type        = bool
  default     = true
}

variable "enable_private_service_connect" {
  description = "When set to true, the network will allow communication between Google Managed Services and the private VPC network via Private Service Connect."
  type        = bool
  default     = true
}

variable "enable_ssh" {
  description = "Enable SSH traffic within the VPC. Required to SSH into VMs without Identity Aware Proxy. Enabling SSH traffic in this manner is not recommended and should only be used for debugging purposes in non-production environments."
  type        = bool
  default     = false
}

variable "flow_sampling" {
  description = "The sample rate for VPC flow logs on all subnets."
  type        = number
  default     = 1.0
}

variable "flow_aggregation_interval" {
  description = "The aggregation interval for VPC flow logs on all subnets."
  type        = string
  default     = "INTERVAL_10_MIN"
}
