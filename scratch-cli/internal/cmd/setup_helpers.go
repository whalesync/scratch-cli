package cmd

import (
	"time"

	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// newAPIClient creates an API client for the given server URL, automatically
// including the API token from stored credentials if available and not expired.
func newAPIClient(serverURL string) *api.Client {
	opts := []api.ClientOption{api.WithBaseURL(serverURL)}

	// Try to load credentials for this server and add the token if valid
	creds, err := config.LoadGlobalCredentials(serverURL)
	if err == nil && creds.APIToken != "" {
		// Check if token is expired
		isExpired := false
		if creds.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, creds.ExpiresAt)
			if err == nil && time.Now().After(expiresAt) {
				isExpired = true
			}
		}
		if !isExpired {
			opts = append(opts, api.WithAPIToken(creds.APIToken))
		}
	}

	return api.NewClient(opts...)
}

// jsonSchemaToTableSchema converts a JSON Schema to the local TableSchema format.
// Extracts property names, types, and metadata like required fields and descriptions.
func jsonSchemaToTableSchema(schema map[string]interface{}) config.TableSchema {
	tableSchema := make(config.TableSchema)

	if schema == nil {
		return tableSchema
	}

	// Get properties from the schema
	props, ok := schema["properties"].(map[string]interface{})
	if !ok {
		return tableSchema
	}

	// Get required fields list
	requiredFields := make(map[string]bool)
	if required, ok := schema["required"].([]interface{}); ok {
		for _, r := range required {
			if fieldName, ok := r.(string); ok {
				requiredFields[fieldName] = true
			}
		}
	}

	// Convert each property to a FieldSchema
	for key, value := range props {
		propMap, ok := value.(map[string]interface{})
		if !ok {
			continue
		}

		fieldSchema := config.FieldSchema{
			Metadata: make(map[string]string),
		}

		// Extract type
		if t, ok := propMap["type"].(string); ok {
			fieldSchema.Type = t
		}

		// Check if required
		if requiredFields[key] {
			fieldSchema.Metadata["required"] = "true"
		}

		// Extract description as helpText
		if desc, ok := propMap["description"].(string); ok {
			fieldSchema.Metadata["helpText"] = desc
		}

		tableSchema[key] = fieldSchema
	}

	return tableSchema
}
