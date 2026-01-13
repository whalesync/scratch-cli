package providers

// WordPressProvider implements the Provider interface for WordPress
type WordPressProvider struct{}

func (w *WordPressProvider) Name() string {
	return "wordpress"
}

func (w *WordPressProvider) DisplayName() string {
	return "WordPress"
}
