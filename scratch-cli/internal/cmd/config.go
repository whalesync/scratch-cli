package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/config"
)

// configCmd represents the config command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage configuration parameters",
	Long:  `Set default configuration parameters for the CLI.`,
}

// configSetCmd represents the config set command
var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a default configuration value.

Available keys:
  account.name      Default account name
  account.provider  Default provider (webflow, wordpress)
  account.api-key   Default API key

Example:
  scratchmd config set account.name webflow`,
	Args: cobra.ExactArgs(2),
	RunE: runConfigSet,
}

// configUnsetCmd represents the config unset command
var configUnsetCmd = &cobra.Command{
	Use:   "unset <key>",
	Short: "Unset a configuration value",
	Long: `Unset/remove a default configuration value.

Example:
  scratchmd config unset account.name`,
	Args: cobra.ExactArgs(1),
	RunE: runConfigUnset,
}

// configListCmd represents the config list command
var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all configuration values",
	Long:  `List all default configuration values currently set.`,
	Args:  cobra.NoArgs,
	RunE:  runConfigList,
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configUnsetCmd)
	configCmd.AddCommand(configListCmd)
}

func runConfigSet(cmd *cobra.Command, args []string) error {
	key := args[0]
	value := args[1]

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Initialize Defaults if missing
	if cfg.Defaults == nil {
		cfg.Defaults = &config.Defaults{}
	}

	switch key {
	case "account.name":
		cfg.Defaults.AccountName = value
		fmt.Printf("✅ Set default account.name to '%s'\n", value)
	case "account.provider":
		cfg.Defaults.AccountProvider = value
		fmt.Printf("✅ Set default account.provider to '%s'\n", value)
	case "account.api-key":
		cfg.Defaults.AccountAPIKey = value
		fmt.Printf("✅ Set default account.api-key to '%s'\n", value)
	default:
		// Check for potentially misspelled keys or future keys
		validKeys := []string{"account.name", "account.provider", "account.api-key"}
		return fmt.Errorf("unknown config key '%s'. Available keys: %s", key, strings.Join(validKeys, ", "))
	}

	if err := config.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save configuration: %w", err)
	}

	return nil
}

func runConfigUnset(cmd *cobra.Command, args []string) error {
	key := args[0]

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	if cfg.Defaults == nil {
		return nil
	}

	switch key {
	case "account.name":
		cfg.Defaults.AccountName = ""
		fmt.Printf("✅ Unset default account.name\n")
	case "account.provider":
		cfg.Defaults.AccountProvider = ""
		fmt.Printf("✅ Unset default account.provider\n")
	case "account.api-key":
		cfg.Defaults.AccountAPIKey = ""
		fmt.Printf("✅ Unset default account.api-key\n")
	default:
		validKeys := []string{"account.name", "account.provider", "account.api-key"}
		return fmt.Errorf("unknown config key '%s'. Available keys: %s", key, strings.Join(validKeys, ", "))
	}

	if err := config.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save configuration: %w", err)
	}

	return nil
}

func runConfigList(cmd *cobra.Command, args []string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	fmt.Println("Configuration:")
	if cfg.Defaults != nil && cfg.Defaults.AccountName != "" {
		fmt.Printf("  account.name     = %s\n", cfg.Defaults.AccountName)
	}
	if cfg.Defaults != nil && cfg.Defaults.AccountProvider != "" {
		fmt.Printf("  account.provider = %s\n", cfg.Defaults.AccountProvider)
	}
	if cfg.Defaults != nil && cfg.Defaults.AccountAPIKey != "" {
		fmt.Printf("  account.api-key  = %s\n", cfg.Defaults.AccountAPIKey)
	}

	if cfg.Defaults == nil || (cfg.Defaults.AccountName == "" && cfg.Defaults.AccountProvider == "" && cfg.Defaults.AccountAPIKey == "") {
		fmt.Println("  (no defaults set)")
	}

	return nil
}
