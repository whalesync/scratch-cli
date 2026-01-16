package providers

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
