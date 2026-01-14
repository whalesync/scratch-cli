// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/AlecAivazis/survey/v2"
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
  account list-tables <account>                         List available tables
  account link-table <account> <table-id> [folder]      Link table to folder
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

Display all configured CMS accounts and their status.`,
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
	Short: "[NON-INTERACTIVE] Add an account",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Add a new CMS account connection non-interactively.

Requires --provider and --api-key flags. Name is optional and defaults to the provider name.

Examples:
  scratchmd account add --provider=webflow --api-key=abc123
  scratchmd account add my-site --provider=webflow --api-key=abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runAccountAdd,
}

// accountListTablesCmd represents the account list-tables command
var accountListTablesCmd = &cobra.Command{
	Use:   "list-tables <account-name>",
	Short: "[NON-INTERACTIVE] List available tables for an account",
	Long: `[NON-INTERACTIVE - safe for LLM use]

List all available tables/collections for a configured account.

Output format is "table-name: table-id", one per line.
Use the table-id with 'link-table' command.

Examples:
  scratchmd account list-tables webflow
  scratchmd account list-tables my-site`,
	Args: cobra.ExactArgs(1),
	RunE: runAccountListTables,
}

// accountLinkTableCmd represents the account link-table command
var accountLinkTableCmd = &cobra.Command{
	Use:   "link-table <account-name> <table-id> [folder-name]",
	Short: "[NON-INTERACTIVE] Link a table to a local folder",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Create a local folder linked to a remote CMS table/collection.

This creates the folder structure and configuration files needed to sync content.
If folder-name is not provided, the table's slug will be used.

After linking, use 'content download <folder>' to fetch records.

Examples:
  scratchmd account link-table webflow 6789abc
  scratchmd account link-table webflow 6789abc blog-posts`,
	Args: cobra.RangeArgs(2, 3),
	RunE: runAccountLinkTable,
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

func init() {
	rootCmd.AddCommand(accountCmd)
	accountCmd.AddCommand(accountSetupCmd)
	accountCmd.AddCommand(accountListCmd)
	accountCmd.AddCommand(accountRemoveCmd)
	accountCmd.AddCommand(accountAddCmd)
	accountCmd.AddCommand(accountListTablesCmd)
	accountCmd.AddCommand(accountLinkTableCmd)
	accountCmd.AddCommand(accountTestCmd)

	// Flags for account add
	accountAddCmd.Flags().String("provider", "", "CMS provider (webflow, wordpress)")
	accountAddCmd.Flags().String("api-key", "", "API key for the provider")
	accountAddCmd.MarkFlagRequired("provider")
	accountAddCmd.MarkFlagRequired("api-key")

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

	// Ask what to do
	options := []string{"Add a new account"}
	if len(cfg.Accounts) > 0 {
		options = append(options, "Update account credentials")
	}
	options = append(options, "Cancel")

	var action string
	prompt := &survey.Select{
		Message: "What would you like to do?",
		Options: options,
	}
	if err := survey.AskOne(prompt, &action); err != nil {
		return err
	}

	switch action {
	case "Cancel":
		return nil

	case "Add a new account":
		// Use the shared addAccountInteractive function
		if err := addAccountInteractive(cfg, secrets); err != nil {
			return err
		}
		// Save configs
		saveConfigs(cfg, secrets)

	case "Update account credentials":
		if err := updateAccountCredentialsInteractive(cfg, secrets); err != nil {
			return err
		}
		// Save configs
		saveConfigs(cfg, secrets)
	}

	return nil
}

func runAccountList(cmd *cobra.Command, args []string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	if len(cfg.Accounts) == 0 {
		fmt.Println("No accounts configured.")
		fmt.Println("Run 'scratchmd account setup' to add one.")
		return nil
	}

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
	if err := survey.AskOne(prompt, &confirm); err != nil {
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
	provider, _ := cmd.Flags().GetString("provider")
	apiKey, _ := cmd.Flags().GetString("api-key")

	// Validate provider
	supportedProviders := providers.SupportedProviders()
	validProvider := false
	for _, p := range supportedProviders {
		if p == provider {
			validProvider = true
			break
		}
	}
	if !validProvider {
		return fmt.Errorf("invalid provider '%s'. Supported: %v", provider, supportedProviders)
	}

	// Determine account name
	name := provider // default to provider name
	if len(args) > 0 && args[0] != "" {
		name = args[0]
	}

	// Load existing config and secrets
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
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
	client := api.NewClient(api.WithBaseURL(cfg.Settings.ScratchServerURL))
	creds := &api.ConnectorCredentials{
		Service: provider,
		Params:  map[string]string{"apiKey": apiKey},
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
		Provider: provider,
		Tested:   true,
	}

	// Save
	cfg.AddAccount(account)
	secrets.SetSecret(accountID, apiKey)

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

func runAccountListTables(cmd *cobra.Command, args []string) error {
	accountName := args[0]

	// Load config and secrets
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
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

	// Get authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", accountName)
	}

	// List tables via API
	client := api.NewClient(api.WithBaseURL(cfg.Settings.ScratchServerURL))
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	resp, err := client.ListTables(creds)
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

	// Output in name: id format
	for _, table := range resp.Tables {
		fmt.Printf("%s: %s\n", table.Name, table.ID)
	}

	return nil
}

func runAccountLinkTable(cmd *cobra.Command, args []string) error {
	accountName := args[0]
	tableID := args[1]
	var folderName string
	if len(args) > 2 {
		folderName = args[2]
	}

	// Load config and secrets
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
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

	// Get authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", accountName)
	}

	// List tables via API to find the one we want
	client := api.NewClient(api.WithBaseURL(cfg.Settings.ScratchServerURL))
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	resp, err := client.ListTables(creds)
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}
	if resp.Error != "" {
		return fmt.Errorf("failed to list tables: %s", resp.Error)
	}

	// Find the table by ID
	var targetTable *providers.TableInfo
	for i := range resp.Tables {
		if resp.Tables[i].ID == tableID {
			targetTable = &resp.Tables[i]
			break
		}
	}
	if targetTable == nil {
		return fmt.Errorf("table with ID '%s' not found. Run 'scratchmd account list-tables %s' to see available tables", tableID, accountName)
	}

	// Determine folder name
	if folderName == "" {
		folderName = targetTable.Slug
		if folderName == "" {
			folderName = tableID // fallback
		}
	}

	// Check if folder already exists with config
	existingConfig, err := config.LoadTableConfig(folderName)
	if err != nil {
		return fmt.Errorf("failed to check existing config: %w", err)
	}
	if existingConfig != nil {
		return fmt.Errorf("folder '%s' already has a table configuration. Choose a different folder name", folderName)
	}

	// Create table config
	tableConfig := &config.TableConfig{
		AccountID:     account.ID,
		Provider:      account.Provider,
		TableID:       targetTable.ID,
		SiteID:        targetTable.SiteID,
		TableName:     targetTable.Name,
		SiteName:      targetTable.SiteName,
		FilenameField: "slug", // default
		ContentField:  "",     // user can set later if needed
	}

	// Create the .scratchmd directory structure
	scratchmdDir := ".scratchmd"
	scratchmdFolderDir := filepath.Join(scratchmdDir, folderName)
	if err := os.MkdirAll(scratchmdFolderDir, 0755); err != nil {
		return fmt.Errorf("failed to create .scratchmd folder: %w", err)
	}

	// Save table config (this creates the folder too)
	if err := config.SaveTableConfig(folderName, tableConfig); err != nil {
		return fmt.Errorf("failed to save table config: %w", err)
	}

	// Create schema from table fields
	schema := make(config.TableSchema)
	for _, field := range targetTable.Fields {
		schema[field.Slug] = field.Type
	}
	for _, field := range targetTable.SystemFields {
		schema[field.Slug] = field.Type
	}

	if err := config.SaveTableSchema(folderName, schema); err != nil {
		return fmt.Errorf("failed to save table schema: %w", err)
	}

	fmt.Printf("Linked table '%s' to folder '%s'.\n", targetTable.Name, folderName)
	fmt.Printf("Created .scratchmd/%s/ for tracking changes.\n", folderName)
	fmt.Printf("Run 'scratchmd content download %s' to download records.\n", folderName)
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
	client := api.NewClient(api.WithBaseURL(serverURL))

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

// updateAccountCredentialsInteractive allows user to update credentials for an existing account
func updateAccountCredentialsInteractive(cfg *config.Config, secrets *config.SecretsConfig) error {
	fmt.Println()

	// Build account options
	if len(cfg.Accounts) == 0 {
		return fmt.Errorf("no accounts configured")
	}

	var selectedAccount *config.Account

	if len(cfg.Accounts) == 1 {
		// Auto-select if only one account
		selectedAccount = &cfg.Accounts[0]
		fmt.Printf("Updating credentials for: %s (%s)\n", selectedAccount.Name, selectedAccount.Provider)
	} else {
		// Let user choose
		accountOptions := make([]string, len(cfg.Accounts))
		for i, acc := range cfg.Accounts {
			accountOptions[i] = fmt.Sprintf("%s (%s)", acc.Name, acc.Provider)
		}

		var selected string
		prompt := &survey.Select{
			Message: "Select an account to update:",
			Options: accountOptions,
		}
		if err := survey.AskOne(prompt, &selected); err != nil {
			return err
		}

		// Find selected account
		for i := range cfg.Accounts {
			option := fmt.Sprintf("%s (%s)", cfg.Accounts[i].Name, cfg.Accounts[i].Provider)
			if option == selected {
				selectedAccount = &cfg.Accounts[i]
				break
			}
		}
	}

	if selectedAccount == nil {
		return fmt.Errorf("failed to select account")
	}

	// Get provider to access auth properties
	provider, err := providers.GetProvider(selectedAccount.Provider)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Get existing credentials to use as defaults
	existingProps := secrets.GetSecretProperties(selectedAccount.ID)

	fmt.Println()
	fmt.Printf("📝 Re-enter credentials for '%s' (%s)\n", selectedAccount.Name, provider.DisplayName())
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
			if err := survey.AskOne(prompt, &value); err != nil {
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
			if err := survey.AskOne(prompt, &value); err != nil {
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

	client := api.NewClient(api.WithBaseURL(cfg.Settings.ScratchServerURL))
	creds := &api.ConnectorCredentials{
		Service: selectedAccount.Provider,
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
		if err := survey.AskOne(savePrompt, &saveAnyway); err != nil {
			return err
		}
		if !saveAnyway {
			return fmt.Errorf("update cancelled - connection test failed")
		}
	}

	// Update authentication properties in secrets
	secrets.SetSecretProperties(selectedAccount.ID, authValues)

	// Update tested status in account
	selectedAccount.Tested = tested

	fmt.Println()
	fmt.Printf("✅ Updated credentials for '%s'\n", selectedAccount.Name)

	return nil
}
