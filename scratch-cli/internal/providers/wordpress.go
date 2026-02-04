package providers

// WordPressProvider implements the Provider interface for WordPress
type WordPressProvider struct{}

func (w *WordPressProvider) Name() string {
	return "wordpress"
}

func (w *WordPressProvider) DisplayName() string {
	return "WordPress"
}

// AuthProperties returns the authentication properties needed for WordPress
func (w *WordPressProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "endpoint",
			DisplayName: "WordPress URL",
			Description: "The URL of your WordPress site (e.g., https://example.com)",
			Required:    true,
			Sensitive:   false,
		},
		{
			Key:         "username",
			DisplayName: "Username",
			Description: "Your WordPress account username",
			Required:    true,
			Sensitive:   false,
		},
		{
			Key:         "password",
			DisplayName: "Application Password",
			Description: "Your WordPress application password (generate one in WordPress under Users → Profile)",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (w *WordPressProvider) SupportsAttachments() bool {
	return false
}

// MaxAttachmentUploadSize returns 0 as WordPress does not support attachment uploads
func (w *WordPressProvider) MaxAttachmentUploadSize() int64 {
	return 0
}

// ValidateAttachmentFile returns an empty slice as WordPress does not support attachment uploads
func (w *WordPressProvider) ValidateAttachmentFile(filePath string) []string {
	return []string{}
}

// UploadAttachment uploads a file attachment to WordPress.
// Currently returns ErrUploadNotSupported as this is not yet implemented.
func (w *WordPressProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	return nil, ErrUploadNotSupported
}
