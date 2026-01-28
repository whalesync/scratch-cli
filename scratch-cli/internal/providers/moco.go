package providers

// MocoProvider implements the Provider interface for Moco
type MocoProvider struct{}

func (m *MocoProvider) Name() string {
	return "moco"
}

func (m *MocoProvider) DisplayName() string {
	return "Moco"
}

// AuthProperties returns the authentication properties needed for Moco
func (m *MocoProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "domain",
			DisplayName: "Moco Domain",
			Description: "Your Moco subdomain (e.g., 'yourcompany' for yourcompany.mocoapp.com)",
			Required:    true,
			Sensitive:   false,
		},
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Moco API key",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (m *MocoProvider) SupportsAttachments() bool {
	return false
}

// MaxAttachmentUploadSize returns 0 as Moco does not support attachment uploads
func (m *MocoProvider) MaxAttachmentUploadSize() int64 {
	return 0
}

// ValidateAttachmentFile returns an empty slice as Moco does not support attachment uploads
func (m *MocoProvider) ValidateAttachmentFile(filePath string) []string {
	return []string{}
}

// UploadAttachment returns ErrUploadNotSupported as Moco does not support attachment uploads
func (m *MocoProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	return nil, ErrUploadNotSupported
}
