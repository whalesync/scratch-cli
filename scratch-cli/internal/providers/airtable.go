package providers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// AirtableProvider implements the Provider interface for Airtable
type AirtableProvider struct{}

// Name returns the provider name
func (p *AirtableProvider) Name() string {
	return "airtable"
}

// DisplayName returns the human-readable name
func (p *AirtableProvider) DisplayName() string {
	return "Airtable"
}

// AuthProperties returns the authentication properties needed for Airtable
func (p *AirtableProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Airtable personal access token or API key",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (p *AirtableProvider) SupportsAttachments() bool {
	return true
}

// airtableUploadRequest represents the request body for uploading an attachment
type airtableUploadRequest struct {
	ContentType string `json:"contentType"`
	File        string `json:"file"`
	Filename    string `json:"filename"`
}

// airtableUploadResponse represents the response from the upload attachment API
type airtableUploadResponse struct {
	ID     string                            `json:"id"`
	Fields map[string][]airtableAttachmentIn `json:"fields"`
}

// airtableAttachmentIn represents an attachment in the API response
type airtableAttachmentIn struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	URL      string `json:"url"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
}

// UploadAttachment uploads a file attachment to Airtable.
// siteID is the Airtable base ID, recordID is the record ID, and fieldID is the attachment field ID or name.
// Note: tableID parameter is unused for Airtable but kept for interface compatibility.
func (p *AirtableProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	apiKey := creds.Params["apiKey"]
	if apiKey == "" {
		return nil, fmt.Errorf("apiKey is required in credentials")
	}

	// Build the API URL
	// POST https://content.airtable.com/v0/{baseId}/{recordId}/{attachmentFieldIdOrName}/uploadAttachment
	url := fmt.Sprintf("https://content.airtable.com/v0/%s/%s/%s/uploadAttachment", siteID, recordID, fieldID)

	// Create request body
	reqBody := airtableUploadRequest{
		ContentType: file.ContentType,
		File:        file.Content,
		Filename:    file.Filename,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var uploadResp airtableUploadResponse
	if err := json.Unmarshal(body, &uploadResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Extract the attachment from the fields map
	// The response contains fields keyed by field ID, each containing an array of attachments
	// We need to find the attachment matching the filename we uploaded
	for _, attachments := range uploadResp.Fields {
		for _, att := range attachments {
			if att.Filename == file.Filename {
				return &FileAttachment{
					ID:       att.ID,
					Filename: att.Filename,
					URL:      att.URL,
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("no attachment with filename %q found in response", file.Filename)
}

// ExtractAttachments extracts attachments from an Airtable attachment field value.
// Airtable attachments are stored as an array of objects with id, filename, url, type, and size fields.
func (p *AirtableProvider) ExtractAttachments(fieldValue interface{}) ([]Attachment, error) {
	// Airtable attachment fields are arrays of attachment objects
	attachments, ok := fieldValue.([]interface{})
	if !ok {
		// Single attachment object (uncommon but possible)
		if single, ok := fieldValue.(map[string]interface{}); ok {
			attachments = []interface{}{single}
		} else {
			return nil, nil // Not an attachment field, return empty
		}
	}

	result := make([]Attachment, 0, len(attachments))
	for _, item := range attachments {
		att, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		attachment := Attachment{}

		if id, ok := att["id"].(string); ok {
			attachment.ID = id
		}
		if filename, ok := att["filename"].(string); ok {
			attachment.Name = filename
		}
		if url, ok := att["url"].(string); ok {
			attachment.URL = url
		}
		if mimeType, ok := att["type"].(string); ok {
			attachment.Type = mimeType
		}
		if size, ok := att["size"].(float64); ok {
			attachment.Size = int64(size)
		}

		// Only include if we have at least a URL
		if attachment.URL != "" {
			result = append(result, attachment)
		}
	}

	return result, nil
}
