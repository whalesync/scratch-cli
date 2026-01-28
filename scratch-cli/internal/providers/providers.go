// Package providers contains CMS provider implementations for testing connections.
package providers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	ID        string            `json:"id,omitempty"`        // Field ID
	Name      string            `json:"name,omitempty"`      // Display name
	Slug      string            `json:"slug,omitempty"`      // URL-friendly slug (used as key in records)
	Type      string            `json:"type,omitempty"`      // Field type (text, richtext, image, etc.)
	Required  bool              `json:"required,omitempty"`  // Whether field is required
	HelpText  string            `json:"helpText,omitempty"`  // Description/help text
	ExtraInfo map[string]string `json:"extraInfo,omitempty"` // Provider-specific info
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
	// SupportsAttachments returns whether the provider supports downloading attachments
	SupportsAttachments() bool
	// MaxAttachmentUploadSize returns the maximum attachment upload size in bytes.
	// Returns 0 if the provider does not support attachment uploads.
	MaxAttachmentUploadSize() int64
	// ValidateAttachmentFile checks a file for potential issues before upload.
	// Returns a slice of warning messages, or an empty slice if no issues found.
	ValidateAttachmentFile(filePath string) []string
}

// SupportedProviders returns the list of supported provider names
func SupportedProviders() []string {
	return []string{"airtable", "audienceful", "moco", "notion", "webflow", "wordpress"}
}

// GetProvider returns a provider by name
func GetProvider(name string) (Provider, error) {
	switch name {
	case "airtable":
		return &AirtableProvider{}, nil
	case "audienceful":
		return &AudiencefulProvider{}, nil
	case "moco":
		return &MocoProvider{}, nil
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

// ErrAttachmentsNotSupported is returned when a provider does not support attachment extraction
var ErrAttachmentsNotSupported = errors.New("provider does not support attachments")

// ErrUploadNotSupported is returned when a provider does not support attachment uploads
var ErrUploadNotSupported = errors.New("provider does not support attachment uploads")

// Attachment represents a file attachment from a CMS record
type Attachment struct {
	ID   string // Provider-specific ID for the attachment
	Name string // File name
	URL  string // URL to download the attachment
	Type string // Optional: MIME type of the attachment
	Size int64  // Optional: Size of the file in bytes (0 if unknown)
}

// AttachmentExtractor is implemented by providers that support extracting attachments from record data
type AttachmentExtractor interface {
	// ExtractAttachments extracts a list of attachments from a data field value.
	// The fieldValue is the raw value from a YAML record's field.
	// Returns ErrAttachmentsNotSupported if the provider doesn't support attachments.
	ExtractAttachments(fieldValue interface{}) ([]Attachment, error)
}

// UploadFile contains the file data to upload
type UploadFile struct {
	ContentType string // MIME type of the file
	Filename    string // Name of the file
	Content     string // File content
	Size        int64  // Size of the file in bytes
}

// FileAttachment represents an uploaded attachment
type FileAttachment struct {
	ID       string // The new ID for the attachment
	Filename string // Name of the file
	URL      string // URL of the uploaded file
}

// ConnectorCredentials represents the credentials for a connector.
type ConnectorCredentials struct {
	Service string            `json:"service"`
	Params  map[string]string `json:"params,omitempty"`
}

// AttachmentUploader is implemented by providers that support uploading attachments
type AttachmentUploader interface {
	// UploadAttachment uploads a file attachment to the provider.
	// For Airtable: siteID=baseID, tableID=tableID, recordID=recordID, fieldID=attachmentFieldID
	// Returns ErrUploadNotSupported if the provider doesn't support uploads.
	UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error)
}

// DownloadAttachments downloads attachments to destDir with collision-safe filenames.
//
// Files are saved as "<index>-<name>-<id>.<ext>" where index is a two-digit number (01, 02, etc.)
// preserving the order from the source. If overwrite is false, existing files are
// skipped (useful for immutable sources like Airtable where re-downloading is wasteful).
func DownloadAttachments(destDir string, attachments []Attachment, overwrite bool, progress ProgressCallback) (int, error) {
	if destDir == "" {
		return 0, errors.New("destination directory is required")
	}

	downloaded := 0
	for idx, att := range attachments {
		if att.URL == "" {
			continue
		}

		if att.Name == "" || att.ID == "" {
			continue // Skip if missing name or ID
		}

		// Build filename as {index}-{name}-{id}.{ext} with two-digit index
		ext := filepath.Ext(att.Name)
		nameWithoutExt := strings.TrimSuffix(att.Name, ext)
		filename := fmt.Sprintf("%02d-%s-%s%s", idx+1, nameWithoutExt, att.ID, ext)

		destPath := filepath.Join(destDir, filename)

		// Skip if file exists and overwrite is false
		if !overwrite {
			if _, err := os.Stat(destPath); err == nil {
				progress(fmt.Sprintf("Skipping %s (already exists)", filename))
				continue
			}
		}

		progress(fmt.Sprintf("Downloading %s...", filename))

		if err := downloadFile(att.URL, destPath); err != nil {
			return downloaded, fmt.Errorf("failed to download %s: %w", filename, err)
		}

		downloaded++
	}

	progress(fmt.Sprintf("Downloaded %d attachment(s)", downloaded))
	return downloaded, nil
}

// downloadFile downloads a file from a URL to a local path
func downloadFile(url, destPath string) error {
	resp, err := HTTPClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// FormatFileSize formats a file size in bytes to a human-readable string (KB, MB, GB)
func FormatFileSize(bytes int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d bytes", bytes)
	}
}
