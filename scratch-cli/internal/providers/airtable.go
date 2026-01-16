package providers

// AirtableProvider implements the Provider interface for Airtable
type AirtableProvider struct{}

// Name returns the provider name
func (p *AirtableProvider) Name() string {
	return "airtable"
}

// DisplayName returns the human-readable name
func (p *AirtableProvider) DisplayName() string {
	return "Airtable"
}

// AuthProperties returns the authentication properties needed for Airtable
func (p *AirtableProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Airtable personal access token or API key",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (p *AirtableProvider) SupportsAttachments() bool {
	return true
}
