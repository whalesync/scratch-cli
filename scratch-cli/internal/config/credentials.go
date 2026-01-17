// Package config handles configuration file management for scratchmd.
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// GlobalCredentialsFileName is the name of the global credentials file
const GlobalCredentialsFileName = "credentials.yaml"

// GlobalCredentialsDir is the subdirectory in the user's home where credentials are stored
const GlobalCredentialsDir = ".scratchmd"

// EnvironmentCredentials stores credentials for a single environment/server
type EnvironmentCredentials struct {
	APIToken  string `yaml:"apiToken,omitempty"`
	Email     string `yaml:"email,omitempty"`
	ExpiresAt string `yaml:"expiresAt,omitempty"` // ISO 8601 timestamp when the token expires
}

// GlobalCredentialsFile stores credentials for multiple environments keyed by server URL
type GlobalCredentialsFile struct {
	Version      string                             `yaml:"version"`
	Environments map[string]*EnvironmentCredentials `yaml:"environments,omitempty"`
}

// GlobalCredentials is kept for backwards compatibility and convenience
// It represents credentials for a single environment
type GlobalCredentials struct {
	Version   string `yaml:"version"`
	APIToken  string `yaml:"apiToken,omitempty"`
	Email     string `yaml:"email,omitempty"`
	ExpiresAt string `yaml:"expiresAt,omitempty"` // ISO 8601 timestamp when the token expires
}

// GlobalCredentialsVersion is the current version of the credentials file format
const GlobalCredentialsVersion = "2.0.0"

// GetGlobalCredentialsPath returns the path to the global credentials file
func GetGlobalCredentialsPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	return filepath.Join(homeDir, GlobalCredentialsDir, GlobalCredentialsFileName), nil
}

// normalizeServerURL extracts just the hostname from a URL for use as a credentials key.
//
// Examples: "https://api.scratch.md:443/v1" -> "api.scratch.md"
// This ensures credentials work regardless of protocol, port, or path differences.
func normalizeServerURL(serverURL string) string {
	parsed, err := url.Parse(serverURL)
	if err != nil {
		// If parsing fails, fall back to the original string
		return serverURL
	}
	// Return just the hostname without port
	if parsed.Hostname() != "" {
		return parsed.Hostname()
	}
	// If no host found, return the original string
	return serverURL
}

// loadCredentialsFile loads and migrates the credentials file from ~/.scratchmd/.
//
// Handles format migration: if the file uses the old single-environment format
// (apiToken at root level), it's automatically converted to the new multi-environment
// format with credentials stored under the "default" key.
func loadCredentialsFile() (*GlobalCredentialsFile, error) {
	path, err := GetGlobalCredentialsPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &GlobalCredentialsFile{
				Version:      GlobalCredentialsVersion,
				Environments: make(map[string]*EnvironmentCredentials),
			}, nil
		}
		return nil, fmt.Errorf("failed to read credentials file: %w", err)
	}

	// First, try to parse as the new multi-environment format
	var credsFile GlobalCredentialsFile
	if err := yaml.Unmarshal(data, &credsFile); err != nil {
		return nil, fmt.Errorf("failed to parse credentials file: %w", err)
	}

	// Check if this is the old format (has apiToken at root level)
	// by trying to parse as the old format
	var oldCreds GlobalCredentials
	if err := yaml.Unmarshal(data, &oldCreds); err == nil && oldCreds.APIToken != "" {
		// This is an old format file, migrate it
		// We'll use a placeholder URL for the migrated credentials
		credsFile = GlobalCredentialsFile{
			Version:      GlobalCredentialsVersion,
			Environments: make(map[string]*EnvironmentCredentials),
		}
		// Store under "default" key for migrated credentials
		credsFile.Environments["default"] = &EnvironmentCredentials{
			APIToken:  oldCreds.APIToken,
			Email:     oldCreds.Email,
			ExpiresAt: oldCreds.ExpiresAt,
		}
	}

	if credsFile.Version == "" {
		credsFile.Version = GlobalCredentialsVersion
	}
	if credsFile.Environments == nil {
		credsFile.Environments = make(map[string]*EnvironmentCredentials)
	}

	return &credsFile, nil
}

// saveCredentialsFile saves the credentials file to disk
func saveCredentialsFile(credsFile *GlobalCredentialsFile) error {
	path, err := GetGlobalCredentialsPath()
	if err != nil {
		return err
	}

	// Ensure the directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create credentials directory: %w", err)
	}

	if credsFile.Version == "" {
		credsFile.Version = GlobalCredentialsVersion
	}

	data, err := yaml.Marshal(credsFile)
	if err != nil {
		return fmt.Errorf("failed to serialize credentials: %w", err)
	}

	header := "# scratchmd user credentials\n# This file contains your API tokens for authenticated CLI operations\n# Credentials are stored per server environment\n\n"
	content := []byte(header + string(data))

	// Use restrictive permissions for credentials
	if err := os.WriteFile(path, content, 0600); err != nil {
		return fmt.Errorf("failed to write credentials file: %w", err)
	}

	return nil
}

// LoadGlobalCredentials loads credentials for a specific server URL.
// If serverURL is empty, it returns credentials for the "default" environment (for backwards compatibility).
func LoadGlobalCredentials(serverURL string) (*GlobalCredentials, error) {
	credsFile, err := loadCredentialsFile()
	if err != nil {
		return nil, err
	}

	key := "default"
	if serverURL != "" {
		key = normalizeServerURL(serverURL)
	}

	envCreds, exists := credsFile.Environments[key]
	if !exists || envCreds == nil {
		return &GlobalCredentials{
			Version: GlobalCredentialsVersion,
		}, nil
	}

	return &GlobalCredentials{
		Version:   GlobalCredentialsVersion,
		APIToken:  envCreds.APIToken,
		Email:     envCreds.Email,
		ExpiresAt: envCreds.ExpiresAt,
	}, nil
}

// SaveGlobalCredentials saves credentials for a specific server URL.
// If serverURL is empty, it saves to the "default" environment (for backwards compatibility).
func SaveGlobalCredentials(serverURL string, creds *GlobalCredentials) error {
	credsFile, err := loadCredentialsFile()
	if err != nil {
		return err
	}

	key := "default"
	if serverURL != "" {
		key = normalizeServerURL(serverURL)
	}

	credsFile.Environments[key] = &EnvironmentCredentials{
		APIToken:  creds.APIToken,
		Email:     creds.Email,
		ExpiresAt: creds.ExpiresAt,
	}

	return saveCredentialsFile(credsFile)
}

// ClearGlobalCredentials removes credentials for a specific server URL.
// If serverURL is empty, it clears the "default" environment (for backwards compatibility).
func ClearGlobalCredentials(serverURL string) error {
	credsFile, err := loadCredentialsFile()
	if err != nil {
		return err
	}

	key := "default"
	if serverURL != "" {
		key = normalizeServerURL(serverURL)
	}

	delete(credsFile.Environments, key)

	return saveCredentialsFile(credsFile)
}

// IsLoggedIn returns true if the user has stored credentials for a specific server URL.
// If serverURL is empty, it checks the "default" environment (for backwards compatibility).
func IsLoggedIn(serverURL string) bool {
	creds, err := LoadGlobalCredentials(serverURL)
	if err != nil {
		return false
	}
	return creds.APIToken != ""
}
