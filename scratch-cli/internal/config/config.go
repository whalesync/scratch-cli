// Package config handles configuration file management for scratchmd.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/whalesync/scratch-cli/internal/api"
	"gopkg.in/yaml.v3"
)

// File names
const (
	ConfigFileName = "scratchmd.config.yaml"
)

// Version constants
const (
	ConfigFileVersion = "1" // Current config file format version
)

// Settings represents global settings for the CLI (stored in config file)
type Settings struct {
	ScratchServerURL string `yaml:"scratchServerUrl"` // Base URL for the scratch API
}

// Config holds the main configuration (committable to git)
type Config struct {
	Version  string    `yaml:"version"`  // Format version
	Settings *Settings `yaml:"settings"` // Global settings
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
	if Overrides.Settings.ScratchServerURL != "" {
		config.Settings.ScratchServerURL = Overrides.Settings.ScratchServerURL
	}

	return &config, nil
}
