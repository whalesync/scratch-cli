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

// MaxAttachmentUploadSize returns 0 as Notion does not support attachment uploads
func (p *NotionProvider) MaxAttachmentUploadSize() int64 {
	return 0
}

// ValidateAttachmentFile returns an empty slice as Notion does not support attachment uploads
func (p *NotionProvider) ValidateAttachmentFile(filePath string) []string {
	return []string{}
}

// UploadAttachment uploads a file attachment to Notion.
// Currently returns ErrUploadNotSupported as this is not yet implemented.
func (p *NotionProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	return nil, ErrUploadNotSupported
}
