// Package providers contains CMS provider implementations for testing connections.
package providers

import (
	"fmt"
	"net/http"
	"time"
)

// TODO: move this to the api package once all provider implementations are removed
// TableInfo represents a table/collection from a CMS
type TableInfo struct {
	ID           string            `json:"id,omitempty"`           // Unique identifier (e.g., collection ID)
	Name         string            `json:"name,omitempty"`         // Display name
	Slug         string            `json:"slug,omitempty"`         // URL-friendly slug (used for folder name)
	SiteID       string            `json:"siteId,omitempty"`       // Parent site ID (for providers with sites)
	SiteName     string            `json:"siteName,omitempty"`     // Parent site name
	Fields       []FieldInfo       `json:"fields,omitempty"`       // User-defined schema fields
	SystemFields []FieldInfo       `json:"systemFields,omitempty"` // System/metadata fields (isDraft, createdOn, etc.)
	ExtraInfo    map[string]string `json:"extraInfo,omitempty"`    // Provider-specific info
}

// TODO: move this to the api package once all provider implementations are removed
// FieldInfo represents a field/column in a table
type FieldInfo struct {
	ID       string `json:"id,omitempty"`       // Field ID
	Name     string `json:"name,omitempty"`     // Display name
	Slug     string `json:"slug,omitempty"`     // URL-friendly slug (used as key in records)
	Type     string `json:"type,omitempty"`     // Field type (text, richtext, image, etc.)
	Required bool   `json:"required,omitempty"` // Whether field is required
	HelpText string `json:"helpText,omitempty"` // Description/help text
}

// ProgressCallback is called to report progress during long operations
type ProgressCallback func(message string)

// AuthProperty represents a single authentication property that needs to be collected
type AuthProperty struct {
	Key         string // The key used to identify this property (e.g., "apiKey", "email", "wordpressUrl")
	DisplayName string // Human-readable name shown to user (e.g., "API Key", "Email", "WordPress URL")
	Description string // Optional description/help text
	Required    bool   // Whether this property is required
	Sensitive   bool   // Whether this is sensitive data (password, API key) - should be masked in UI
}

// Provider represents a CMS provider that can be tested
type Provider interface {
	// Name returns the provider name (e.g., "webflow", "wordpress")
	Name() string
	// DisplayName returns a human-readable name
	DisplayName() string
	// AuthProperties returns the list of authentication properties needed for this provider
	AuthProperties() []AuthProperty
}

// SupportedProviders returns the list of supported provider names
func SupportedProviders() []string {
	return []string{"webflow", "wordpress", "airtable", "notion"}
}

// GetProvider returns a provider by name
func GetProvider(name string) (Provider, error) {
	switch name {
	case "airtable":
		return &AirtableProvider{}, nil
	case "notion":
		return &NotionProvider{}, nil
	case "webflow":
		return &WebflowProvider{}, nil
	case "wordpress":
		return &WordPressProvider{}, nil
	default:
		return nil, fmt.Errorf("unknown provider: %s", name)
	}
}

// HTTPClient is the shared HTTP client for API calls
var HTTPClient = &http.Client{
	Timeout: 30 * time.Second, // Increased for listing operations
}
