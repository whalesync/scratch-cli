// Package config handles configuration file management for scratchmd.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/whalesync/scratch-cli/internal/api"
	"gopkg.in/yaml.v3"
)

// File names
const (
	ConfigFileName  = "scratchmd.config.yaml"
	SecretsFileName = ".scratchmd.secrets.yaml"
)

// Version constants
const (
	ConfigFileVersion  = "1" // Current config file format version
	SecretsFileVersion = "1" // Current secrets file format version
)

// Settings represents global settings for the CLI (stored in config file)
type Settings struct {
	ScratchServerURL string `yaml:"scratchServerUrl"` // Base URL for the scratch API
}

// Defaults represents default configuration values (stored in config file)
type Defaults struct {
	AccountName     string `yaml:"accountName,omitempty"`     // Default account name to use if not specified
	AccountProvider string `yaml:"accountProvider,omitempty"` // Default provider to use for new accounts
	AccountAPIKey   string `yaml:"accountApiKey,omitempty"`   // Default API key to use for new accounts
}

// Account represents a CMS account configuration (stored in config file)
type Account struct {
	ID       string `yaml:"id"`       // UUID to link with secrets
	Name     string `yaml:"name"`     // User-friendly name
	Provider string `yaml:"provider"` // webflow, wordpress, etc.
	Tested   bool   `yaml:"tested"`   // Whether credentials were verified
}

// AccountSecret represents the secret part of an account (stored in secrets file)
type AccountSecret struct {
	ID         string            `yaml:"id"`         // UUID matching the account
	APIKey     string            `yaml:"apiKey"`     // DEPRECATED: The actual API key (kept for backwards compatibility)
	Properties map[string]string `yaml:"properties"` // Authentication properties (apiKey, email, password, wordpressUrl, etc.)
}

// Config holds the main configuration (committable to git)
type Config struct {
	Version  string    `yaml:"version"`  // Format version
	Settings *Settings `yaml:"settings"` // Global settings
	Defaults *Defaults `yaml:"defaults"` // Default values
	Accounts []Account `yaml:"accounts"`
}

// SecretsConfig holds the secrets configuration (gitignored)
type SecretsConfig struct {
	Version string          `yaml:"version"` // Format version
	Secrets []AccountSecret `yaml:"secrets"`
}

// GenerateAccountID creates a new UUID for an account
func GenerateAccountID() string {
	return uuid.New().String()
}

// LoadConfig loads the main configuration from the current directory
func LoadConfig() (*Config, error) {
	return LoadConfigFrom(".")
}

// LoadConfigFrom loads config from a specific directory
func LoadConfigFrom(dir string) (*Config, error) {
	path := filepath.Join(dir, ConfigFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{
				Version: ConfigFileVersion,
				Settings: &Settings{
					ScratchServerURL: api.DefaultScratchServerURL,
				},
				Accounts: []Account{},
			}, nil
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set default version if not present (for backwards compatibility)
	if config.Version == "" {
		config.Version = ConfigFileVersion
	}

	// Initialize settings with defaults if not present (for backwards compatibility)
	if config.Settings == nil {
		config.Settings = &Settings{
			ScratchServerURL: api.DefaultScratchServerURL,
		}
	}

	// Set default ScratchURL if not present
	if config.Settings.ScratchServerURL == "" {
		config.Settings.ScratchServerURL = api.DefaultScratchServerURL
	}

	// Apply overrides
	config.ApplyAccountOverrides()

	return &config, nil
}

// SaveConfig saves the main configuration to the current directory
func SaveConfig(config *Config) error {
	return SaveConfigTo(".", config)
}

// SaveConfigTo saves config to a specific directory
func SaveConfigTo(dir string, config *Config) error {
	path := filepath.Join(dir, ConfigFileName)

	// Ensure version is set before saving
	if config.Version == "" {
		config.Version = ConfigFileVersion
	}

	// Ensure settings are initialized with defaults
	if config.Settings == nil {
		config.Settings = &Settings{
			ScratchServerURL: api.DefaultScratchServerURL,
		}
	}

	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}

	header := "# scratchmd configuration\n# This file can be committed to git\n\n"
	content := []byte(header + string(data))

	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// LoadSecrets loads the secrets configuration from the current directory
func LoadSecrets() (*SecretsConfig, error) {
	return LoadSecretsFrom(".")
}

// LoadSecretsFrom loads secrets from a specific directory
func LoadSecretsFrom(dir string) (*SecretsConfig, error) {
	path := filepath.Join(dir, SecretsFileName)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &SecretsConfig{
				Version: SecretsFileVersion,
				Secrets: []AccountSecret{},
			}, nil
		}
		return nil, fmt.Errorf("failed to read secrets file: %w", err)
	}

	var config SecretsConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse secrets file: %w", err)
	}

	// Set default version if not present (for backwards compatibility)
	if config.Version == "" {
		config.Version = SecretsFileVersion
	}

	return &config, nil
}

// SaveSecrets saves the secrets configuration to the current directory
func SaveSecrets(secrets *SecretsConfig) error {
	return SaveSecretsTo(".", secrets)
}

// SaveSecretsTo saves secrets to a specific directory
func SaveSecretsTo(dir string, secrets *SecretsConfig) error {
	path := filepath.Join(dir, SecretsFileName)

	// Ensure version is set before saving
	if secrets.Version == "" {
		secrets.Version = SecretsFileVersion
	}

	data, err := yaml.Marshal(secrets)
	if err != nil {
		return fmt.Errorf("failed to serialize secrets: %w", err)
	}

	header := "# scratchmd secrets - DO NOT COMMIT THIS FILE\n# Contains API keys and credentials\n\n"
	content := []byte(header + string(data))

	// Use restrictive permissions for secrets
	if err := os.WriteFile(path, content, 0600); err != nil {
		return fmt.Errorf("failed to write secrets file: %w", err)
	}

	return nil
}

// AddAccount adds a new account to config and its secret
func (c *Config) AddAccount(account Account) {
	// Check if account with same name exists
	for i, existing := range c.Accounts {
		if existing.Name == account.Name {
			c.Accounts[i] = account
			return
		}
	}
	c.Accounts = append(c.Accounts, account)
}

// GetAccount retrieves an account by name
func (c *Config) GetAccount(name string) *Account {
	for i := range c.Accounts {
		if c.Accounts[i].Name == name {
			return &c.Accounts[i]
		}
	}
	return nil
}

// GetAccountByID retrieves an account by ID
func (c *Config) GetAccountByID(id string) *Account {
	for i := range c.Accounts {
		if c.Accounts[i].ID == id {
			return &c.Accounts[i]
		}
	}
	return nil
}

// RemoveAccount removes an account by name
func (c *Config) RemoveAccount(name string) bool {
	for i, account := range c.Accounts {
		if account.Name == name {
			c.Accounts = append(c.Accounts[:i], c.Accounts[i+1:]...)
			return true
		}
	}
	return false
}

// SetSecret adds or updates a secret by account ID (deprecated - use SetSecretProperties)
func (s *SecretsConfig) SetSecret(id, apiKey string) {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			s.Secrets[i].APIKey = apiKey
			// Also set in properties for new consumers
			if s.Secrets[i].Properties == nil {
				s.Secrets[i].Properties = make(map[string]string)
			}
			s.Secrets[i].Properties["apiKey"] = apiKey
			return
		}
	}
	s.Secrets = append(s.Secrets, AccountSecret{
		ID:         id,
		APIKey:     apiKey,
		Properties: map[string]string{"apiKey": apiKey},
	})
}

// SetSecretProperties stores authentication properties for an account by UUID.
//
// Maintains backwards compatibility: if properties contains "apiKey", also sets the
// legacy APIKey field so older code paths continue to work.
func (s *SecretsConfig) SetSecretProperties(id string, properties map[string]string) {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			s.Secrets[i].Properties = properties
			// For backwards compatibility, also set APIKey if present
			if apiKey, ok := properties["apiKey"]; ok {
				s.Secrets[i].APIKey = apiKey
			}
			return
		}
	}
	secret := AccountSecret{
		ID:         id,
		Properties: properties,
	}
	// For backwards compatibility, also set APIKey if present
	if apiKey, ok := properties["apiKey"]; ok {
		secret.APIKey = apiKey
	}
	s.Secrets = append(s.Secrets, secret)
}

// GetSecret retrieves an API key by account ID (deprecated - use GetSecretProperties)
func (s *SecretsConfig) GetSecret(id string) string {
	for _, secret := range s.Secrets {
		if secret.ID == id {
			// Try new properties first
			if secret.Properties != nil {
				if apiKey, ok := secret.Properties["apiKey"]; ok {
					return apiKey
				}
			}
			// Fall back to legacy field
			return secret.APIKey
		}
	}
	return ""
}

// GetSecretProperties retrieves all authentication properties for an account by UUID.
//
// Handles backwards compatibility: if Properties map is empty but legacy APIKey exists,
// returns a map with {"apiKey": value} to support old config files.
func (s *SecretsConfig) GetSecretProperties(id string) map[string]string {

	for _, secret := range s.Secrets {
		if secret.ID == id {

			if len(secret.Properties) > 0 {
				return secret.Properties
			}
			// For backwards compatibility, create properties from APIKey
			if secret.APIKey != "" {
				return map[string]string{"apiKey": secret.APIKey}
			}
			return make(map[string]string)
		}
	}
	return make(map[string]string)
}

// UpsertSecretProperty adds or updates a single authentication property for an account
func (s *SecretsConfig) UpsertSecretProperty(id, key, value string) {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			// Initialize properties map if needed
			if s.Secrets[i].Properties == nil {
				s.Secrets[i].Properties = make(map[string]string)
			}
			// Set the property
			s.Secrets[i].Properties[key] = value

			// For backwards compatibility, also update APIKey field if this is the apiKey property
			if key == "apiKey" {
				s.Secrets[i].APIKey = value
			}
			return
		}
	}

	// Account secret doesn't exist yet, create it
	secret := AccountSecret{
		ID:         id,
		Properties: map[string]string{key: value},
	}
	// For backwards compatibility, also set APIKey if this is the apiKey property
	if key == "apiKey" {
		secret.APIKey = value
	}
	s.Secrets = append(s.Secrets, secret)
}

// DeleteSecretProperty removes a single authentication property from an account
func (s *SecretsConfig) DeleteSecretProperty(id, key string) bool {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			if s.Secrets[i].Properties == nil {
				return false
			}

			// Check if property exists
			if _, exists := s.Secrets[i].Properties[key]; !exists {
				return false
			}

			// Delete the property
			delete(s.Secrets[i].Properties, key)

			// For backwards compatibility, also clear APIKey field if this is the apiKey property
			if key == "apiKey" {
				s.Secrets[i].APIKey = ""
			}

			return true
		}
	}
	return false
}

// RemoveSecret removes a secret by account ID
func (s *SecretsConfig) RemoveSecret(id string) bool {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			s.Secrets = append(s.Secrets[:i], s.Secrets[i+1:]...)
			return true
		}
	}
	return false
}

// EnsureGitignore ensures the secrets file is in .gitignore
func EnsureGitignore(dir string) error {
	gitignorePath := filepath.Join(dir, ".gitignore")

	// Read existing .gitignore if it exists
	content, err := os.ReadFile(gitignorePath)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to read .gitignore: %w", err)
	}

	// Check if secrets file is already ignored
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == SecretsFileName {
			return nil // Already ignored
		}
	}

	// Append to .gitignore
	var newContent string
	if len(content) > 0 && !strings.HasSuffix(string(content), "\n") {
		newContent = string(content) + "\n"
	} else {
		newContent = string(content)
	}

	if len(content) == 0 {
		newContent = "# scratchmd secrets\n"
	}
	newContent += SecretsFileName + "\n"

	if err := os.WriteFile(gitignorePath, []byte(newContent), 0644); err != nil {
		return fmt.Errorf("failed to update .gitignore: %w", err)
	}

	return nil
}

// Overrides holds global configuration overrides set via CLI flags
var Overrides = struct {
	Account struct {
		Name     string
		Provider string
		APIKey   string
	}
	Table struct {
		AccountID     string // Can be name or ID, we'll try to resolve
		FilenameField string
		ContentField  string
	}
	Settings struct {
		ScratchServerURL string
	}
}{}

// ApplyAccountOverrides merges CLI flag overrides and config defaults into the account list.
//
// Resolution order for account settings: CLI flags > config defaults > existing values.
//
// If an account name is specified (via flag or default) but doesn't exist, a transient
// account is created. This allows one-off operations without persisting account config.
// Also applies server URL override to settings if specified.
func (c *Config) ApplyAccountOverrides() {
	// Apply global settings overrides
	if Overrides.Settings.ScratchServerURL != "" {
		if c.Settings == nil {
			c.Settings = &Settings{}
		}
		c.Settings.ScratchServerURL = Overrides.Settings.ScratchServerURL
	}
	// If account name is provided via flag, and we are looking for a specific account,
	// this logic is tricky because Config holds seemingly *all* accounts.
	//
	// The user likely intends to "force use this account config" for the current operation.
	// But `LoadConfig` returns a `*Config` which contains a list of accounts.
	//
	// If the user provides `--account.name=my-override` and `--account.provider=webflow` and `--account.api-key=xyz`,
	// they essentially want to *inject* or *replace* an account in the list to be used by the command.
	//
	// For "add" or "setup", overrides might pre-fill.
	// For "download" (which uses table config -> account ID), we might want to resolve that ID to these overridden values.

	// Strategy:
	// If Overrides.Account.Name is set, we check if it exists in c.Accounts.
	// If it exists, we update it with other overrides.
	// If it doesn't exist, we add a transient account with these details.

	// If override name is present, use it.
	// If not, check defaults.
	accountName := Overrides.Account.Name
	if accountName == "" && c.Defaults != nil {
		accountName = c.Defaults.AccountName
		// If we are falling back to default, update the override so downstream consumers see it too?
		// Better to just use local variable for lookup.
		if accountName != "" {
			// Also update the global Override so commands that check it directly (like list-folders) see it.
			Overrides.Account.Name = accountName
		}
	}

	// Apply default for API Key to Override if needed
	if Overrides.Account.APIKey == "" && c.Defaults != nil && c.Defaults.AccountAPIKey != "" {
		Overrides.Account.APIKey = c.Defaults.AccountAPIKey
	}

	// Apply default for Provider to Override if needed
	if Overrides.Account.Provider == "" && c.Defaults != nil && c.Defaults.AccountProvider != "" {
		Overrides.Account.Provider = c.Defaults.AccountProvider
	}

	if accountName != "" {
		acc := c.GetAccount(accountName)
		if acc == nil {
			// Create transient
			newAcc := Account{
				ID:     GenerateAccountID(), // Transient ID
				Name:   accountName,
				Tested: true, // Assume valid if passed via flags
			}
			c.Accounts = append(c.Accounts, newAcc)
			acc = &c.Accounts[len(c.Accounts)-1]
		}

		if Overrides.Account.Provider != "" {
			acc.Provider = Overrides.Account.Provider
		} else if c.Defaults != nil && c.Defaults.AccountProvider != "" {
			acc.Provider = c.Defaults.AccountProvider
		}
	} else if len(c.Accounts) > 0 {
		// If using an existing account (implicit first one?) logic is vague,
		// but let's check provider override/default
		var provider string
		if Overrides.Account.Provider != "" {
			provider = Overrides.Account.Provider
		} else if c.Defaults != nil {
			provider = c.Defaults.AccountProvider
		}

		if provider != "" {
			// We have a provider but no account name.
			// Should we apply this to the first account?
			// Likely safer not to mutate existing accounts unless name matches.
		}
	}
}

// GetSecretPropertiesWithOverrides retrieves secrets with CLI flag overrides applied.
//
// Starts with stored secrets for the account, then overlays any values from the global
// Overrides struct. This allows passing credentials via flags without storing them.
func (s *SecretsConfig) GetSecretPropertiesWithOverrides(accountID string) map[string]string {
	// Start with stored secrets
	props := s.GetSecretProperties(accountID)

	// Check overrides first
	if Overrides.Account.APIKey != "" {
		props["apiKey"] = Overrides.Account.APIKey
	}

	// If not in overrides, we can't easily check Defaults here because we don't have access to the main Config object
	// (this method hangs off SecretsConfig).
	// However, the caller usually has Config.
	// Ideally, `ApplyAccountOverrides` should have populated `Overrides.Account.APIKey` from defaults if it was missing.

	return props
}
