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
	LastDownload  string `yaml:"lastDownload,omitempty"` // Timestamp of last download (RFC3339)
}

// CurrentSchemaVersion is the current version of the schema file format
const CurrentSchemaVersion = "1"

// FieldSchema represents the schema information for a single field
type FieldSchema struct {
	Type     string            `yaml:"type"`               // Field type (text, richtext, image, etc.)
	Metadata map[string]string `yaml:"metadata,omitempty"` // Additional field metadata (id, name, required, helpText, etc.)
}

// TableSchemaFile represents the full schema file with version
type TableSchemaFile struct {
	Version string                 `yaml:"version"`          // Schema file format version
	Fields  map[string]FieldSchema `yaml:"fields,omitempty"` // Field slug -> field schema
}

// TableSchema is an alias for the fields map for convenience
type TableSchema = map[string]FieldSchema

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

	// Apply overrides
	if Overrides.Table.AccountID != "" {
		config.AccountID = Overrides.Table.AccountID
	}
	if Overrides.Table.FilenameField != "" {
		config.FilenameField = Overrides.Table.FilenameField
	}
	if Overrides.Table.ContentField != "" {
		config.ContentField = Overrides.Table.ContentField
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

	var schemaFile TableSchemaFile
	if err := yaml.Unmarshal(data, &schemaFile); err != nil {
		return nil, fmt.Errorf("failed to parse table schema: %w", err)
	}

	return schemaFile.Fields, nil
}

// LoadTableSchemaFile loads a table schema file (with version) from a folder
func LoadTableSchemaFile(folderPath string) (*TableSchemaFile, error) {
	path := filepath.Join(folderPath, TableSchemaFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No schema exists
		}
		return nil, fmt.Errorf("failed to read table schema: %w", err)
	}

	var schemaFile TableSchemaFile
	if err := yaml.Unmarshal(data, &schemaFile); err != nil {
		return nil, fmt.Errorf("failed to parse table schema: %w", err)
	}

	return &schemaFile, nil
}

// SaveTableSchema saves a table schema to a folder
func SaveTableSchema(folderPath string, schema TableSchema) error {
	schemaFile := &TableSchemaFile{
		Version: CurrentSchemaVersion,
		Fields:  schema,
	}
	return SaveTableSchemaFile(folderPath, schemaFile)
}

// SaveTableSchemaFile saves a table schema file (with version) to a folder
func SaveTableSchemaFile(folderPath string, schemaFile *TableSchemaFile) error {
	// Ensure folder exists
	if err := os.MkdirAll(folderPath, 0755); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	path := filepath.Join(folderPath, TableSchemaFileName)

	data, err := yaml.Marshal(schemaFile)
	if err != nil {
		return fmt.Errorf("failed to serialize table schema: %w", err)
	}

	header := "# scratchmd table schema (auto-generated)\n\n"
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
