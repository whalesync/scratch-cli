// Package config handles folder-specific configuration for scratchmd data folders.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// FolderConfigFileName is the name of the folder config file in the .scratchmd directory
const FolderConfigFileName = "scratchmd.folder.yaml"

// GetBaseDir returns the directory where the CLI executable is located.
// All folder operations are relative to this directory.
func GetBaseDir() string {
	execPath, err := os.Executable()
	if err != nil {
		// Fall back to current directory if we can't determine executable path
		return "."
	}
	return filepath.Dir(execPath)
}

// FolderConfig represents the configuration for a synced data folder from scratch.md
type FolderConfig struct {
	FolderID             string                 `yaml:"folderId"`                       // Server-side folder ID (dfd_...)
	WorkbookID           string                 `yaml:"workbookId"`                     // Server-side workbook ID (wkb_...)
	FolderName           string                 `yaml:"folderName"`                     // Display name of the folder
	ConnectorService     string                 `yaml:"connectorService,omitempty"`     // e.g., "AIRTABLE", "WEBFLOW"
	ConnectorDisplayName string                 `yaml:"connectorDisplayName,omitempty"` // Human-readable connector name
	TableID              []string               `yaml:"tableId,omitempty"`              // Remote table ID(s)
	Path                 string                 `yaml:"path,omitempty"`                 // Path in the workbook hierarchy
	Schema               map[string]interface{} `yaml:"schema,omitempty"`               // JSON schema from the connector
	LastDownload         string                 `yaml:"lastDownload,omitempty"`         // Timestamp of last download (RFC3339)
	LastSyncTime         string                 `yaml:"lastSyncTime,omitempty"`         // Server's last sync timestamp
}

// GetFolderMetadataDir returns the path to the .scratchmd/<folderName> directory
// relative to the CLI executable's location
func GetFolderMetadataDir(folderName string) string {
	return filepath.Join(GetBaseDir(), ".scratchmd", folderName)
}

// GetFolderOriginalDir returns the path to the .scratchmd/<folderName>/original directory
// relative to the CLI executable's location
func GetFolderOriginalDir(folderName string) string {
	return filepath.Join(GetBaseDir(), ".scratchmd", folderName, "original")
}

// GetFolderContentDir returns the path to the <folderName> content directory
// relative to the CLI executable's location
func GetFolderContentDir(folderName string) string {
	return filepath.Join(GetBaseDir(), folderName)
}

// LoadFolderConfig loads a folder configuration from the .scratchmd directory
func LoadFolderConfig(folderName string) (*FolderConfig, error) {
	metadataDir := GetFolderMetadataDir(folderName)
	path := filepath.Join(metadataDir, FolderConfigFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No config exists
		}
		return nil, fmt.Errorf("failed to read folder config: %w", err)
	}

	var config FolderConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse folder config: %w", err)
	}

	return &config, nil
}

// SaveFolderConfig saves a folder configuration to the .scratchmd directory
func SaveFolderConfig(folderName string, config *FolderConfig) error {
	metadataDir := GetFolderMetadataDir(folderName)

	// Ensure metadata directory exists
	if err := os.MkdirAll(metadataDir, 0755); err != nil {
		return fmt.Errorf("failed to create metadata directory: %w", err)
	}

	path := filepath.Join(metadataDir, FolderConfigFileName)

	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize folder config: %w", err)
	}

	header := "# scratchmd folder configuration\n# This file can be committed to git\n\n"
	content := []byte(header + string(data))

	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("failed to write folder config: %w", err)
	}

	return nil
}

// LoadFolderConfigByID searches for a folder config by folder ID
func LoadFolderConfigByID(folderId string) (*FolderConfig, string, error) {
	// Check if .scratchmd directory exists
	scratchmdDir := filepath.Join(GetBaseDir(), ".scratchmd")
	if _, err := os.Stat(scratchmdDir); os.IsNotExist(err) {
		return nil, "", nil
	}

	// Iterate through all subdirectories
	entries, err := os.ReadDir(scratchmdDir)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read .scratchmd directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		folderName := entry.Name()
		config, err := LoadFolderConfig(folderName)
		if err != nil {
			continue // Skip folders with invalid configs
		}
		if config != nil && config.FolderID == folderId {
			return config, folderName, nil
		}
	}

	return nil, "", nil
}

// ListConfiguredFolders finds all folders with folder configurations in .scratchmd
func ListConfiguredFolders() ([]string, error) {
	var folders []string

	scratchmdDir := filepath.Join(GetBaseDir(), ".scratchmd")
	if _, err := os.Stat(scratchmdDir); os.IsNotExist(err) {
		return folders, nil // No .scratchmd directory
	}

	entries, err := os.ReadDir(scratchmdDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read .scratchmd directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Check if folder contains a folder config
		configPath := filepath.Join(scratchmdDir, entry.Name(), FolderConfigFileName)
		if _, err := os.Stat(configPath); err == nil {
			folders = append(folders, entry.Name())
		}
	}

	return folders, nil
}
