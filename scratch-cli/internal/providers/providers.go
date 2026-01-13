// Package providers contains CMS provider implementations for testing connections.
package providers

import (
	"fmt"
	"net/http"
	"time"
)

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

// Provider represents a CMS provider that can be tested
type Provider interface {
	// Name returns the provider name (e.g., "webflow", "wordpress")
	Name() string
	// DisplayName returns a human-readable name
	DisplayName() string
	// TestConnection tests the API key and returns nil if successful
	TestConnection(apiKey string) error
}

// TableLister is implemented by providers that can list available tables
type TableLister interface {
	Provider
	// ListTables returns all available tables/collections
	// The progress callback is called with status updates during the operation
	ListTables(apiKey string, progress ProgressCallback) ([]TableInfo, error)
}

// Record represents a single record from a CMS table
type Record struct {
	ID      string                 // Record ID
	Slug    string                 // URL-friendly slug (used as filename)
	RawData map[string]interface{} // Raw data from the API
}

// RecordDownloader is implemented by providers that can download records
type RecordDownloader interface {
	Provider
	// DownloadRecords fetches all records from a table/collection
	// Calls the callback with batches of records as they are fetched
	DownloadRecords(apiKey string, collectionID string, progress ProgressCallback, callback func(records []Record) error) error
}

// SupportedProviders returns the list of supported provider names
func SupportedProviders() []string {
	return []string{"webflow", "wordpress"}
}

// GetProvider returns a provider by name
func GetProvider(name string) (Provider, error) {
	switch name {
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
