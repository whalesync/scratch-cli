// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"

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
	accountTestCmd.Flags().String("server", api.DefaultBaseURL, "Scratch.md server URL")
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
	// TODO: Add "Edit existing account" option later
	options = append(options, "Cancel")

	var action string
	prompt := &survey.Select{
		Message: "What would you like to do?",
		Options: options,
	}
	if err := survey.AskOne(prompt, &action); err != nil {
		return err
	}

	if action == "Cancel" {
		return nil
	}

	// Use the shared addAccountInteractive function
	if err := addAccountInteractive(cfg, secrets); err != nil {
		return err
	}

	// Save configs
	saveConfigs(cfg, secrets)

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

	// Test connection
	providerImpl, err := providers.GetProvider(provider)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	if err := providerImpl.TestConnection(apiKey); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
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

	// Get API key
	apiKey := secrets.GetSecret(account.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", accountName)
	}

	// Get provider
	provider, err := providers.GetProvider(account.Provider)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Check if provider supports listing tables
	tableLister, ok := provider.(providers.TableLister)
	if !ok {
		return fmt.Errorf("provider '%s' does not support listing tables", account.Provider)
	}

	// List tables (suppress progress output for clean machine-readable output)
	tables, err := tableLister.ListTables(apiKey, func(msg string) {
		// Silent progress for non-interactive use
	})
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	if len(tables) == 0 {
		fmt.Println("No tables found.")
		return nil
	}

	// Output in name: id format
	for _, table := range tables {
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

	// Get API key
	apiKey := secrets.GetSecret(account.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", accountName)
	}

	// Get provider
	provider, err := providers.GetProvider(account.Provider)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Check if provider supports listing tables (needed to get table info)
	tableLister, ok := provider.(providers.TableLister)
	if !ok {
		return fmt.Errorf("provider '%s' does not support listing tables", account.Provider)
	}

	// List tables to find the one we want
	tables, err := tableLister.ListTables(apiKey, func(msg string) {
		// Silent progress
	})
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	// Find the table by ID
	var targetTable *providers.TableInfo
	for i := range tables {
		if tables[i].ID == tableID {
			targetTable = &tables[i]
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

	// Find account
	account := cfg.GetAccount(accountName)
	if account == nil {
		return fmt.Errorf("account '%s' not found. Run 'scratchmd account list' to see available accounts", accountName)
	}

	// Get API key
	apiKey := secrets.GetSecret(account.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", accountName)
	}

	// Create API client
	client := api.NewClient(api.WithBaseURL(serverURL))

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params: map[string]string{
			"apiKey": apiKey,
		},
	}

	fmt.Printf("Testing account credentials for '%s'...\n", accountName)

	// Call test-credentials endpoint
	result, err := client.TestCredentials(creds)
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
