// Package config handles configuration file management for scratchmd.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// File names
const (
	ConfigFileName  = "scratchmd.config.yaml"
	SecretsFileName = ".scratchmd.secrets.yaml"
)

// Account represents a CMS account configuration (stored in config file)
type Account struct {
	ID       string `yaml:"id"`       // UUID to link with secrets
	Name     string `yaml:"name"`     // User-friendly name
	Provider string `yaml:"provider"` // webflow, wordpress, etc.
	Tested   bool   `yaml:"tested"`   // Whether credentials were verified
}

// AccountSecret represents the secret part of an account (stored in secrets file)
type AccountSecret struct {
	ID     string `yaml:"id"`     // UUID matching the account
	APIKey string `yaml:"apiKey"` // The actual API key
}

// Config holds the main configuration (committable to git)
type Config struct {
	Accounts []Account `yaml:"accounts"`
}

// SecretsConfig holds the secrets configuration (gitignored)
type SecretsConfig struct {
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
			return &Config{Accounts: []Account{}}, nil
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// SaveConfig saves the main configuration to the current directory
func SaveConfig(config *Config) error {
	return SaveConfigTo(".", config)
}

// SaveConfigTo saves config to a specific directory
func SaveConfigTo(dir string, config *Config) error {
	path := filepath.Join(dir, ConfigFileName)

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
			return &SecretsConfig{Secrets: []AccountSecret{}}, nil
		}
		return nil, fmt.Errorf("failed to read secrets file: %w", err)
	}

	var config SecretsConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse secrets file: %w", err)
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

// SetSecret adds or updates a secret by account ID
func (s *SecretsConfig) SetSecret(id, apiKey string) {
	for i, secret := range s.Secrets {
		if secret.ID == id {
			s.Secrets[i].APIKey = apiKey
			return
		}
	}
	s.Secrets = append(s.Secrets, AccountSecret{ID: id, APIKey: apiKey})
}

// GetSecret retrieves an API key by account ID
func (s *SecretsConfig) GetSecret(id string) string {
	for _, secret := range s.Secrets {
		if secret.ID == id {
			return secret.APIKey
		}
	}
	return ""
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
