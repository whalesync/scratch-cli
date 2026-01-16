package providers

// NotionProvider implements the Provider interface for Notion
type NotionProvider struct{}

// Name returns the provider name
func (p *NotionProvider) Name() string {
	return "notion"
}

// DisplayName returns the human-readable name
func (p *NotionProvider) DisplayName() string {
	return "Notion"
}

// AuthProperties returns the authentication properties needed for Notion
func (p *NotionProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Notion integration API key",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (p *NotionProvider) SupportsAttachments() bool {
	return false
}
