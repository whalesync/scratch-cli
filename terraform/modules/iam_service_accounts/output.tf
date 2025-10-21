output "service_accounts" {
  description = "Serviceaccount's Metadata"
  value = { for sa in keys(google_service_account.service_accounts) : google_service_account.service_accounts[sa].account_id => {
    id         = google_service_account.service_accounts[sa].id
    email      = google_service_account.service_accounts[sa].email
    iam-string = google_service_account.service_accounts[sa].member
    }
  }
}
