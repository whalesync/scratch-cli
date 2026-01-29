// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/briandowns/spinner"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
)

// accountCmd represents the account command
var accountCmd = &cobra.Command{
	Use:   "account",
	Short: "Manage CMS accounts",
	Long: `Manage CMS account connections.

NON-INTERACTIVE (LLM-friendly):
  account add <name> --provider=webflow --api-key=KEY   Add account
  account list                                          List accounts
  account list-folders <account>                        List available tables (folders)
  account remove <name>                                 Remove account
  account test <account>                                Test account credentials

INTERACTIVE (requires TTY):
  account setup                                         Interactive wizard`,
}

// accountSetupCmd represents the account setup command
var accountSetupCmd = &cobra.Command{
	Use:   "setup",
	Short: "[INTERACTIVE] Account setup wizard",
	Long: `[INTERACTIVE - requires TTY, not for LLM use]

Interactively set up a new CMS account connection.

This walks you through:
  • Selecting a CMS provider (Webflow, WordPress)
  • Entering your API key
  • Testing the connection

For non-interactive/LLM use, use 'account add' instead.`,
	RunE: runAccountSetup,
}

// accountListCmd represents the account list command
var accountListCmd = &cobra.Command{
	Use:   "list",
	Short: "[NON-INTERACTIVE] List configured accounts",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Display all configured CMS accounts and their status.

Use --json for machine-readable output.`,
	RunE: runAccountList,
}

// accountRemoveCmd represents the account remove command
var accountRemoveCmd = &cobra.Command{
	Use:   "remove <name>",
	Short: "[NON-INTERACTIVE] Remove an account",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Remove a configured CMS account by name.

Example:
  scratchmd account remove my-site`,
	Args: cobra.ExactArgs(1),
	RunE: runAccountRemove,
}

// accountAddCmd represents the non-interactive account add command
var accountAddCmd = &cobra.Command{
	Use:   "add [name]",
	Short: "[NON-INTERACTIVE] Add a new CMS account",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Add a new account configuration.

Required flags:
  --account.provider string   CMS provider (webflow, wordpress, moco, etc.)
  --account.api-key string    API key (for providers that use apiKey)

Provider-specific flags:
  --account.domain string        Domain/subdomain (for Moco: e.g., 'yourcompany')
  --account.endpoint string      WordPress site URL (for WordPress)
  --account.username string      Username/Email (for WordPress)
  --account.password string      Password (for WordPress application password)

Examples:
  # Webflow (uses api-key)
  scratchmd account add --account.provider=webflow --account.api-key=<key>

  # Moco (uses domain + api-key)
  scratchmd account add --account.provider=moco --account.domain=yourcompany --account.api-key=<key>

  # WordPress (uses endpoint + username + password)
  scratchmd account add --account.provider=wordpress --account.endpoint=https://example.com --account.username=user@example.com --account.password=<app-password>`,
	// Args is optional (name)
	Args: cobra.MaximumNArgs(1),
	RunE: runAccountAdd,
}

// accountFetchSourcesCmd represents the account fetch-sources command
var accountFetchSourcesCmd = &cobra.Command{
	Use:   "fetch-sources [account-name]",
	Short: "[NON-INTERACTIVE] List available remote sources (tables) and their link status",
	Long: `[NON-INTERACTIVE - safe for LLM use]

List available tables/collections from the CMS and show if they are linked to local folders.

Arguments:
  account-name: Optional if configured via 'config set account.name'

Use --json for machine-readable output.

Examples:
  scratchmd account fetch-sources
  scratchmd account fetch-sources webflow
  scratchmd account fetch-sources webflow --json`,
	Aliases: []string{"list-tables", "list-folders"},
	Args:    cobra.MaximumNArgs(1),
	RunE:    runAccountFetchSources,
}

// accountTestCmd represents the account test command
var accountTestCmd = &cobra.Command{
	Use:   "test <account-name>",
	Short: "[NON-INTERACTIVE] Test account credentials",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Test account credentials with a test call to the data service.

This command sends the account credentials to the data service to verify the connection is working.

Examples:
  scratchmd account test webflow
  scratchmd account test my-site --server=http://localhost:3010`,
	Args: cobra.ExactArgs(1),
	RunE: runAccountTest,
}

// accountFetchJsonSchemasCmd represents the account fetch-json-schemas command
var accountFetchJsonSchemasCmd = &cobra.Command{
	Use:   "fetch-json-schemas [account-name]",
	Short: "[NON-INTERACTIVE] List available tables with their JSON Schema specs",
	Long: `[NON-INTERACTIVE - safe for LLM use]

List available tables/collections from the CMS with their JSON Schema specs.
This is useful for AI/LLM consumption to understand the structure of each table.

Arguments:
  account-name: Optional if configured via 'config set account.name'

Examples:
  scratchmd account fetch-json-schemas
  scratchmd account fetch-json-schemas webflow`,
	Aliases: []string{"list-json-tables"},
	Args:    cobra.MaximumNArgs(1),
	RunE:    runAccountFetchJsonSchemas,
}

func init() {
	rootCmd.AddCommand(accountCmd)
	accountCmd.AddCommand(accountSetupCmd)
	// removed extra interactive commands from root account cmd to avoid confusion
	// or keep them as advanced aliases? Keeping them is fine.
	accountCmd.AddCommand(accountListCmd)
	accountListCmd.Flags().Bool("json", false, "Output as JSON (machine-readable)")

	accountCmd.AddCommand(accountRemoveCmd)
	accountCmd.AddCommand(accountAddCmd)
	accountCmd.AddCommand(accountFetchSourcesCmd)
	accountFetchSourcesCmd.Flags().Bool("json", false, "Output as JSON (machine-readable)")

	accountCmd.AddCommand(accountTestCmd)
	accountCmd.AddCommand(accountFetchJsonSchemasCmd)

	// Flags for account add
	accountAddCmd.Flags().String("account.provider", "", "CMS provider (webflow, wordpress, moco, etc.)")
	accountAddCmd.Flags().String("account.api-key", "", "API key for the provider")
	accountAddCmd.Flags().String("account.domain", "", "Domain/subdomain (for Moco)")
	accountAddCmd.Flags().String("account.endpoint", "", "WordPress site URL")
	accountAddCmd.Flags().String("account.username", "", "Username/Email (for WordPress)")
	accountAddCmd.Flags().String("account.password", "", "Password (for WordPress)")
	// Not required anymore, can come from defaults
	// accountAddCmd.MarkFlagRequired("account.provider")
	// accountAddCmd.MarkFlagRequired("account.api-key")

	// Flags for account test
	accountTestCmd.Flags().String("server", "", "Scratch.md api server URL (defaults to config setting)")
}

func runAccountSetup(cmd *cobra.Command, args []string) error {
	fmt.Println()
	fmt.Println("🔧 Account Setup")
	fmt.Println()

	// Load existing config and secrets
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Show existing accounts
	if len(cfg.Accounts) > 0 {
		fmt.Println("📋 Existing accounts:")
		for _, acc := range cfg.Accounts {
			tested := "❌"
			if acc.Tested {
				tested = "✅"
			}
			fmt.Printf("   • %s (%s) %s\n", acc.Name, acc.Provider, tested)
		}
		fmt.Println()
	}

	// If not adding a new account, we are managing existing ones
	// Let user pick an account first
	if len(cfg.Accounts) > 0 {
		var selected *config.Account

		// Only ask if there's more than one account
		if len(cfg.Accounts) > 1 {
			// Build list including "Add new..." option
			options := []string{}
			for _, acc := range cfg.Accounts {
				options = append(options, fmt.Sprintf("%s (%s)", acc.Name, acc.Provider))
			}
			options = append(options, "+ Create a new account")
			options = append(options, "Cancel")

			var selection string
			prompt := &survey.Select{
				Message: "Select an account to manage:",
				Options: options,
			}
			if err := askOne(prompt, &selection); err != nil {
				if shouldGoBack(err) {
					return nil // Escape exits cleanly
				}
				return err
			}

			if selection == "Cancel" {
				return nil
			}

			if selection == "+ Create a new account" {
				return createNewAccountFlow(cfg, secrets)
			}

			// Find selected account
			for i := range cfg.Accounts {
				opt := fmt.Sprintf("%s (%s)", cfg.Accounts[i].Name, cfg.Accounts[i].Provider)
				if opt == selection {
					selected = &cfg.Accounts[i]
					break
				}
			}
		} else {
			// If only one, present it as the first option "Manage 'Name'", plus "Create new"
			acc := cfg.Accounts[0]
			manageLabel := fmt.Sprintf("Manage '%s'", acc.Name)
			createLabel := "Create a new account"
			cancelLabel := "Cancel"

			var selection string
			prompt := &survey.Select{
				Message: "What would you like to do?",
				Options: []string{manageLabel, createLabel, cancelLabel},
			}
			if err := askOne(prompt, &selection); err != nil {
				if shouldGoBack(err) {
					return nil // Escape exits cleanly
				}
				return err
			}

			if selection == cancelLabel {
				return nil
			}
			if selection == createLabel {
				return createNewAccountFlow(cfg, secrets)
			}
			selected = &acc
		}

		// Now present actions for the selected account
		return manageAccountFlow(cfg, secrets, selected)

	} else {
		// No accounts exist, straight to create flow
		fmt.Println("No accounts configured. Let's add one!")
		return createNewAccountFlow(cfg, secrets)
	}
}

func createNewAccountFlow(cfg *config.Config, secrets *config.SecretsConfig) error {
	if err := addAccountInteractive(cfg, secrets); err != nil {
		return err
	}
	saveConfigs(cfg, secrets)
	return nil
}

func manageAccountFlow(cfg *config.Config, secrets *config.SecretsConfig, account *config.Account) error {
	actionOptions := []string{
		"Link a table",
		"Test connection",
		"Update credentials",
		"Delete account",
		"Cancel",
	}

	var action string
	prompt := &survey.Select{
		Message: fmt.Sprintf("Action for '%s':", account.Name),
		Options: actionOptions,
	}
	if err := askOne(prompt, &action); err != nil {
		return err
	}

	switch action {
	case "Link a table":
		// We need to pass just this account to setupTablesInteractive
		// Since setupTablesInteractive currently selects from all accounts,
		// we'll call a specialized version or just pre-select it loop.
		// For now, let's call a modified setupTablesInteractive that takes an account.
		return setupTablesForAccountInteractive(cfg, secrets, account)

	case "Test connection":
		return performAccountTest(cfg, secrets, account)

	case "Update credentials":
		if err := updateCredentialsForAccount(cfg, secrets, account); err != nil {
			return err
		}
		saveConfigs(cfg, secrets)

	case "Delete account":
		// Confirm removal
		var confirm bool
		prompt := &survey.Confirm{
			Message: fmt.Sprintf("Are you sure you want to delete account '%s'?", account.Name),
			Default: false,
		}
		if err := askOne(prompt, &confirm); err != nil {
			return err
		}
		if confirm {
			cfg.RemoveAccount(account.Name)
			secrets.RemoveSecret(account.ID)
			saveConfigs(cfg, secrets)
			fmt.Printf("✅ Account '%s' removed.\n", account.Name)
		}

	case "Cancel":
		return nil
	}
	return nil

}

func runAccountList(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	if len(cfg.Accounts) == 0 {
		if jsonOutput {
			fmt.Println("[]")
			return nil
		}
		fmt.Println("No accounts configured.")
		fmt.Println("Run 'scratchmd account setup' to add one.")
		return nil
	}

	// JSON output mode
	if jsonOutput {
		type accountJSON struct {
			Name     string `json:"name"`
			ID       string `json:"id"`
			Provider string `json:"provider"`
			Tested   bool   `json:"tested"`
		}
		var accounts []accountJSON
		for _, acc := range cfg.Accounts {
			accounts = append(accounts, accountJSON{
				Name:     acc.Name,
				ID:       acc.ID,
				Provider: acc.Provider,
				Tested:   acc.Tested,
			})
		}
		output, _ := json.MarshalIndent(accounts, "", "  ")
		fmt.Println(string(output))
		return nil
	}

	// Human-readable output
	fmt.Println()
	fmt.Println("📋 Configured accounts:")
	fmt.Println()

	for _, acc := range cfg.Accounts {
		tested := "❌ not tested"
		if acc.Tested {
			tested = "✅ connected"
		}

		// Get provider display name
		provider, _ := providers.GetProvider(acc.Provider)
		providerName := acc.Provider
		if provider != nil {
			providerName = provider.DisplayName()
		}

		fmt.Printf("  %s\n", acc.Name)
		fmt.Printf("    Provider: %s\n", providerName)
		fmt.Printf("    Status:   %s\n", tested)
		fmt.Printf("    ID:       %s\n", acc.ID)
		fmt.Println()
	}

	return nil
}

func runAccountRemove(cmd *cobra.Command, args []string) error {
	accountName := args[0]

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Find the account
	account := cfg.GetAccount(accountName)
	if account == nil {
		return fmt.Errorf("account '%s' not found", accountName)
	}

	// Confirm removal
	var confirm bool
	prompt := &survey.Confirm{
		Message: fmt.Sprintf("Remove account '%s' (%s)?", account.Name, account.Provider),
		Default: false,
	}
	if err := askOne(prompt, &confirm); err != nil {
		return err
	}

	if !confirm {
		fmt.Println("Cancelled.")
		return nil
	}

	// Remove from config and secrets
	accountID := account.ID
	cfg.RemoveAccount(accountName)
	secrets.RemoveSecret(accountID)

	// Save
	if err := config.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	if err := config.SaveSecrets(secrets); err != nil {
		return fmt.Errorf("failed to save secrets: %w", err)
	}

	fmt.Printf("✅ Account '%s' removed.\n", accountName)
	return nil
}

func runAccountAdd(cmd *cobra.Command, args []string) error {
	providerName, _ := cmd.Flags().GetString("account.provider")

	// Load existing config and secrets early to check defaults
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Apply defaults if missing
	if providerName == "" && cfg.Defaults != nil {
		providerName = cfg.Defaults.AccountProvider
	}

	// Validation
	if providerName == "" {
		return fmt.Errorf("provider required (via --account.provider or default)")
	}

	// Validate provider
	supportedProviders := providers.SupportedProviders()
	validProvider := false
	for _, p := range supportedProviders {
		if p == providerName {
			validProvider = true
			break
		}
	}
	if !validProvider {
		return fmt.Errorf("invalid provider '%s'. Supported: %v", providerName, supportedProviders)
	}

	// Get the provider to access its auth properties
	provider, err := providers.GetProvider(providerName)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Build credentials from provider's auth properties
	// Map provider auth property keys to CLI flags
	flagMapping := map[string]string{
		"apiKey":   "account.api-key",
		"domain":   "account.domain",
		"endpoint": "account.endpoint",
		"username": "account.username",
		"password": "account.password",
	}

	authProps := provider.AuthProperties()
	authValues := make(map[string]string)
	var missingRequired []string

	for _, prop := range authProps {
		flagName, ok := flagMapping[prop.Key]
		if !ok {
			// No flag mapping for this property - skip for now
			continue
		}

		value, _ := cmd.Flags().GetString(flagName)

		// Apply default for apiKey if available
		if prop.Key == "apiKey" && value == "" && cfg.Defaults != nil {
			value = cfg.Defaults.AccountAPIKey
		}

		value = strings.TrimSpace(value)

		if prop.Required && value == "" {
			missingRequired = append(missingRequired, fmt.Sprintf("--%s (%s)", flagName, prop.DisplayName))
		}

		if value != "" {
			authValues[prop.Key] = value
		}
	}

	if len(missingRequired) > 0 {
		return fmt.Errorf("missing required flags for %s: %s", providerName, strings.Join(missingRequired, ", "))
	}

	// Determine account name
	name := providerName // default to provider name
	if len(args) > 0 && args[0] != "" {
		name = args[0]
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Check if account name already exists
	if existing := cfg.GetAccount(name); existing != nil {
		return fmt.Errorf("account '%s' already exists. Use 'account remove' first or choose a different name", name)
	}

	// Test connection via API
	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: providerName,
		Params:  authValues,
	}

	result, err := client.TestConnection(creds)
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}
	if !result.Success {
		return fmt.Errorf("connection test failed: %s", result.Error)
	}

	// Create account
	accountID := config.GenerateAccountID()
	account := config.Account{
		ID:       accountID,
		Name:     name,
		Provider: providerName,
		Tested:   true,
	}

	// Save
	cfg.AddAccount(account)
	secrets.SetSecretProperties(accountID, authValues)

	if err := config.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	if err := config.SaveSecrets(secrets); err != nil {
		return fmt.Errorf("failed to save secrets: %w", err)
	}
	if err := config.EnsureGitignore("."); err != nil {
		return fmt.Errorf("failed to update .gitignore: %w", err)
	}

	fmt.Printf("Account '%s' added successfully.\n", name)
	return nil
}

func runAccountFetchSources(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	// Load config and secrets first
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	var accountName string
	if len(args) > 0 {
		accountName = args[0]
	} else if config.Overrides.Account.Name != "" {
		accountName = config.Overrides.Account.Name
	} else {
		return fmt.Errorf("account name required (either as argument or --account.name flag)")
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Find account
	account := cfg.GetAccount(accountName)
	if account == nil {
		return fmt.Errorf("account '%s' not found. Run 'scratchmd account list' to see available accounts", accountName)
	}

	// Get auth props
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", accountName)
	}

	// 1. Scan local folders to find links
	linkedFolders := make(map[string][]string) // TableID -> []FolderName
	folders, err := config.ListConfiguredTables(".")
	if err != nil && !jsonOutput {
		// Just warn, don't fail
		fmt.Fprintf(os.Stderr, "Warning: failed to scan local folders: %v\n", err)
	}
	for _, folder := range folders {
		tCfg, err := config.LoadTableConfig(folder)
		if err != nil {
			continue
		}
		// Match by AccountID (UUID)
		if tCfg.AccountID == account.ID {
			linkedFolders[tCfg.TableID] = append(linkedFolders[tCfg.TableID], folder)
		}
	}

	// 2. Fetch remote tables
	var s *spinner.Spinner
	if !jsonOutput {
		s = spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Suffix = " Fetching tables from server..."
		s.Start()
	}

	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	resp, err := client.ListTables(creds)
	if s != nil {
		s.Stop()
	}
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}
	if resp.Error != "" {
		return fmt.Errorf("failed to list tables: %s", resp.Error)
	}

	if len(resp.Tables) == 0 {
		if jsonOutput {
			fmt.Println("[]")
			return nil
		}
		fmt.Println("No tables found.")
		return nil
	}

	// 3. Sort: Linked first, then Alphabetical
	sort.Slice(resp.Tables, func(i, j int) bool {
		t1 := resp.Tables[i]
		t2 := resp.Tables[j]
		isLinked1 := len(linkedFolders[t1.ID]) > 0
		isLinked2 := len(linkedFolders[t2.ID]) > 0

		if isLinked1 != isLinked2 {
			return isLinked1 // Linked comes first (true > false)
		}
		return strings.ToLower(t1.Name) < strings.ToLower(t2.Name)
	})

	// 4. Output
	if jsonOutput {
		type tableJSON struct {
			ID            string   `json:"id"`
			Name          string   `json:"name"`
			LinkedFolders []string `json:"linkedFolders,omitempty"`
		}
		var tables []tableJSON
		for _, table := range resp.Tables {
			t := tableJSON{
				ID:   table.ID,
				Name: table.Name,
			}
			if links := linkedFolders[table.ID]; len(links) > 0 {
				t.LinkedFolders = links
			}
			tables = append(tables, t)
		}
		output, _ := json.MarshalIndent(tables, "", "  ")
		fmt.Println(string(output))
		return nil
	}

	// Human-readable output
	fmt.Printf("Sources for account '%s':\n", accountName)
	for _, table := range resp.Tables {
		links := linkedFolders[table.ID]
		linkStr := ""
		if len(links) > 0 {
			linkStr = fmt.Sprintf(" [linked to: %s]", strings.Join(links, ", "))
		}
		fmt.Printf("- %s (ID: %s)%s\n", table.Name, table.ID, linkStr)
	}

	return nil
}

func runAccountFetchJsonSchemas(cmd *cobra.Command, args []string) error {
	// Load config and secrets first
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	var accountName string
	if len(args) > 0 {
		accountName = args[0]
	} else if config.Overrides.Account.Name != "" {
		accountName = config.Overrides.Account.Name
	} else {
		return fmt.Errorf("account name required (either as argument or --account.name flag)")
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Find account
	account := cfg.GetAccount(accountName)
	if account == nil {
		return fmt.Errorf("account '%s' not found. Run 'scratchmd account list' to see available accounts", accountName)
	}

	// Get auth props
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", accountName)
	}

	// Fetch JSON schemas from server
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " Fetching tables from server..."
	s.Start()

	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	resp, err := client.ListTables(creds)
	s.Stop()
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}
	if resp.Error != "" {
		return fmt.Errorf("failed to list tables: %s", resp.Error)
	}

	if len(resp.Tables) == 0 {
		fmt.Println("No tables found.")
		return nil
	}

	// Output JSON schemas
	fmt.Printf("JSON Schemas for account '%s':\n\n", accountName)
	for _, table := range resp.Tables {
		fmt.Printf("Table: %s (ID: %s)\n", table.Name, table.ID)
		if table.SiteID != "" {
			fmt.Printf("  Site ID: %s\n", table.SiteID)
		}
		if table.Schema != nil {
			// Pretty print the schema as JSON
			schemaJSON, err := json.MarshalIndent(table.Schema, "  ", "  ")
			if err != nil {
				fmt.Printf("  Schema: (error marshaling: %v)\n", err)
			} else {
				fmt.Printf("  Schema:\n  %s\n", string(schemaJSON))
			}
		}
		fmt.Println()
	}

	return nil
}

func runAccountTest(cmd *cobra.Command, args []string) error {
	accountName := args[0]
	serverURL, _ := cmd.Flags().GetString("server")

	// Load config and secrets
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Use config URL if server flag not provided
	if serverURL == "" {
		serverURL = cfg.Settings.ScratchServerURL
	}

	// Find account
	account := cfg.GetAccount(accountName)
	if account == nil {
		return fmt.Errorf("account '%s' not found. Run 'scratchmd account list' to see available accounts", accountName)
	}

	// Get authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", accountName)
	}

	// Create API client
	client := newAPIClient(serverURL)

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	fmt.Printf("Testing account credentials for '%s'...\n", accountName)

	// Call test-credentials endpoint
	result, err := client.TestConnection(creds)
	if err != nil {
		return fmt.Errorf("failed to call server API: %w", err)
	}

	if result.Success {
		fmt.Printf("✅ Credentials valid for %s\n", result.Service)

		// Update account tested status
		account.Tested = true
		if err := config.SaveConfig(cfg); err != nil {
			fmt.Printf("⚠️  Warning: Could not update config: %s\n", err)
		}
	} else {
		fmt.Printf("❌ Credentials invalid: %s\n", result.Error)

		// Update account tested status
		account.Tested = false
		if err := config.SaveConfig(cfg); err != nil {
			fmt.Printf("⚠️  Warning: Could not update config: %s\n", err)
		}
		return fmt.Errorf("credential test failed")
	}

	return nil
}

// updateCredentialsForAccount updates a specific account directly
func updateCredentialsForAccount(cfg *config.Config, secrets *config.SecretsConfig, account *config.Account) error {
	// Get provider to access auth properties
	provider, err := providers.GetProvider(account.Provider)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	existingProps := secrets.GetSecretProperties(account.ID)

	fmt.Println()
	fmt.Printf("📝 Re-enter credentials for '%s' (%s)\n", account.Name, provider.DisplayName())
	fmt.Println("   (Press Enter to keep current value)")
	fmt.Println()

	// Collect authentication properties from user
	authProps := provider.AuthProperties()
	authValues := make(map[string]string)

	for _, prop := range authProps {
		var value string
		existingValue := existingProps[prop.Key]

		if prop.Sensitive {
			// For sensitive fields, show a masked version if value exists
			defaultHint := ""
			if existingValue != "" {
				defaultHint = " (current: ********)"
			}

			// Use password prompt for sensitive fields
			prompt := &survey.Password{
				Message: fmt.Sprintf("Enter %s%s:", prop.DisplayName, defaultHint),
				Help:    prop.Description,
			}
			if err := askOne(prompt, &value); err != nil {
				return err
			}

			// If empty, keep existing value
			if value == "" && existingValue != "" {
				value = existingValue
			}
		} else {
			// Use input prompt for non-sensitive fields with existing value as default
			prompt := &survey.Input{
				Message: fmt.Sprintf("Enter %s:", prop.DisplayName),
				Help:    prop.Description,
				Default: existingValue,
			}
			if err := askOne(prompt, &value); err != nil {
				return err
			}
		}

		value = strings.TrimSpace(value)
		if prop.Required && value == "" {
			return fmt.Errorf("%s cannot be empty", prop.DisplayName)
		}

		authValues[prop.Key] = value
	}

	// Test connection via API
	fmt.Print("\n⏳ Testing connection...")

	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authValues,
	}

	tested := false
	result, err := client.TestConnection(creds)
	if err != nil {
		fmt.Printf(" ❌ Failed\n")
		fmt.Printf("   Error: %s\n", err)
	} else if !result.Success {
		fmt.Printf(" ❌ Failed\n")
		fmt.Printf("   Error: %s\n", result.Error)
	} else {
		fmt.Printf(" ✅ Success!\n")
		tested = true
	}

	if !tested {
		// Ask if they want to save anyway
		saveAnyway := false
		savePrompt := &survey.Confirm{
			Message: "Save credentials anyway? (You can test again later)",
			Default: false,
		}
		if err := askOne(savePrompt, &saveAnyway); err != nil {
			return err
		}
		if !saveAnyway {
			return fmt.Errorf("update cancelled - connection test failed")
		}
	}

	// Update authentication properties in secrets
	secrets.SetSecretProperties(account.ID, authValues)

	// Update tested status in account
	account.Tested = tested

	fmt.Println()
	return nil
}

func performAccountTest(cfg *config.Config, secrets *config.SecretsConfig, account *config.Account) error {
	// Get authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", account.Name)
	}

	// Create API client
	client := newAPIClient(cfg.Settings.ScratchServerURL)

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	fmt.Printf("Testing account credentials for '%s'...\n", account.Name)

	// Call test-credentials endpoint
	result, err := client.TestConnection(creds)
	if err != nil {
		return fmt.Errorf("failed to call server API: %w", err)
	}

	if result.Success {
		fmt.Printf("✅ Credentials valid for %s\n", result.Service)
		// Update account tested status if it wasn't
		if !account.Tested {
			account.Tested = true
			if err := config.SaveConfig(cfg); err != nil {
				fmt.Printf("⚠️  Warning: Could not update config: %s\n", err)
			}
		}
	} else {
		fmt.Printf("❌ Credentials invalid: %s\n", result.Error)
		// Update account tested status
		account.Tested = false
		if err := config.SaveConfig(cfg); err != nil {
			fmt.Printf("⚠️  Warning: Could not update config: %s\n", err)
		}
		return fmt.Errorf("credential test failed")
	}
	return nil
}
