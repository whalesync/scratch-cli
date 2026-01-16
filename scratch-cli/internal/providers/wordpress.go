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
			Key:         "wordpressUrl",
			DisplayName: "WordPress URL",
			Description: "The URL of your WordPress site (e.g., https://example.com)",
			Required:    true,
			Sensitive:   false,
		},
		{
			Key:         "email",
			DisplayName: "Email",
			Description: "Your WordPress account email",
			Required:    true,
			Sensitive:   false,
		},
		{
			Key:         "password",
			DisplayName: "Password",
			Description: "Your WordPress application password",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (w *WordPressProvider) SupportsAttachments() bool {
	return false
}
