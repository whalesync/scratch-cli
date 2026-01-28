package providers

// AudiencefulProvider implements the Provider interface for Audienceful
type AudiencefulProvider struct{}

func (a *AudiencefulProvider) Name() string {
	return "audienceful"
}

func (a *AudiencefulProvider) DisplayName() string {
	return "Audienceful"
}

// AuthProperties returns the authentication properties needed for Audienceful
func (a *AudiencefulProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Audienceful API key",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (a *AudiencefulProvider) SupportsAttachments() bool {
	return false
}

// MaxAttachmentUploadSize returns 0 as Audienceful does not support attachment uploads
func (a *AudiencefulProvider) MaxAttachmentUploadSize() int64 {
	return 0
}

// ValidateAttachmentFile returns an empty slice as Audienceful does not support attachment uploads
func (a *AudiencefulProvider) ValidateAttachmentFile(filePath string) []string {
	return []string{}
}

// UploadAttachment returns ErrUploadNotSupported as Audienceful does not support attachment uploads
func (a *AudiencefulProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	return nil, ErrUploadNotSupported
}
