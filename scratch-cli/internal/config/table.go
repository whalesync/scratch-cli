// Package config handles table-specific configuration for scratchmd.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// TableConfigFileName is the name of the table config file in each folder
const TableConfigFileName = "scratchmd.config.yaml"

// TableSchemaFileName is the name of the schema file in each folder
const TableSchemaFileName = "scratchmd.schema.yaml"

// TableConfig represents the configuration for a synced table/collection
type TableConfig struct {
	AccountID     string `yaml:"accountId"`              // UUID of the account this table belongs to
	Provider      string `yaml:"provider"`               // Provider name (webflow, wordpress)
	TableID       string `yaml:"tableId"`                // Remote table/collection ID
	SiteID        string `yaml:"siteId,omitempty"`       // Remote site ID (if applicable)
	TableName     string `yaml:"tableName"`              // Display name
	SiteName      string `yaml:"siteName,omitempty"`     // Site display name
	FilenameField string `yaml:"filenameField"`          // Field to use for filenames (default: slug)
	ContentField  string `yaml:"contentField,omitempty"` // Field to use as main content body
}

// TableSchema represents the schema of a synced table (simplified: field -> type)
type TableSchema map[string]string

// LoadTableConfig loads a table configuration from a folder
func LoadTableConfig(folderPath string) (*TableConfig, error) {
	path := filepath.Join(folderPath, TableConfigFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No config exists
		}
		return nil, fmt.Errorf("failed to read table config: %w", err)
	}

	var config TableConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse table config: %w", err)
	}

	return &config, nil
}

// SaveTableConfig saves a table configuration to a folder
func SaveTableConfig(folderPath string, config *TableConfig) error {
	// Ensure folder exists
	if err := os.MkdirAll(folderPath, 0755); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	path := filepath.Join(folderPath, TableConfigFileName)

	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize table config: %w", err)
	}

	header := "# scratchmd table configuration\n# This file can be committed to git\n\n"
	content := []byte(header + string(data))

	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("failed to write table config: %w", err)
	}

	return nil
}

// LoadTableSchema loads a table schema from a folder
func LoadTableSchema(folderPath string) (TableSchema, error) {
	path := filepath.Join(folderPath, TableSchemaFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No schema exists
		}
		return nil, fmt.Errorf("failed to read table schema: %w", err)
	}

	var schema TableSchema
	if err := yaml.Unmarshal(data, &schema); err != nil {
		return nil, fmt.Errorf("failed to parse table schema: %w", err)
	}

	return schema, nil
}

// SaveTableSchema saves a table schema to a folder
func SaveTableSchema(folderPath string, schema TableSchema) error {
	// Ensure folder exists
	if err := os.MkdirAll(folderPath, 0755); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	path := filepath.Join(folderPath, TableSchemaFileName)

	data, err := yaml.Marshal(schema)
	if err != nil {
		return fmt.Errorf("failed to serialize table schema: %w", err)
	}

	header := "# scratchmd table schema (auto-generated)\n# Field name -> field type mapping\n\n"
	content := []byte(header + string(data))

	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("failed to write table schema: %w", err)
	}

	return nil
}

// ListConfiguredTables finds all folders with table configurations
func ListConfiguredTables(rootDir string) ([]string, error) {
	var tables []string

	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Check if folder contains a table config
		configPath := filepath.Join(rootDir, entry.Name(), TableConfigFileName)
		if _, err := os.Stat(configPath); err == nil {
			tables = append(tables, entry.Name())
		}
	}

	return tables, nil
}
