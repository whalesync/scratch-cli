// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/briandowns/spinner"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/download"
	"github.com/whalesync/scratch-cli/internal/providers"
	"golang.org/x/term"
)

// setupCmd represents the setup command
var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Interactive setup wizard for configuring scratchmd",
	Long: `The setup command walks you through configuring scratchmd interactively.

It helps you:
  • Add CMS account connections (Webflow, WordPress)
  • Store API keys securely
  • Test your credentials
  • Set up tables/collections to sync

This is the easiest way to get started with scratchmd.

NOTE: This command requires an interactive terminal (TTY).
AI agents and automated scripts should use the non-interactive commands instead:
  • scratchmd account list / setup / remove
  • scratchmd content download <folder>`,
	RunE: runSetup,
}

func init() {
	rootCmd.AddCommand(setupCmd)
}

// isInteractiveTerminal checks if stdin is connected to a terminal
func isInteractiveTerminal() bool {
	return term.IsTerminal(int(os.Stdin.Fd()))
}

func runSetup(cmd *cobra.Command, args []string) error {
	// Check for interactive terminal
	if !isInteractiveTerminal() {
		return fmt.Errorf(`this command requires an interactive terminal (TTY)

The 'setup' command is designed for humans to quickly get started.
AI agents and automated scripts should use non-interactive commands:

  scratchmd account list              # List configured accounts
  scratchmd account remove <name>     # Remove an account  
  scratchmd content download          # Download all content
  scratchmd content download <folder> # Download specific table

For programmatic account creation, use environment variables or
edit the config files directly:
  • scratchmd.config.yaml   (account metadata)
  • .scratchmd.secrets.yaml (API keys)`)
	}

	fmt.Println()
	fmt.Println("🚀 Welcome to scratchmd setup!")
	fmt.Println("   This wizard will help you configure your CMS connections.")
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

	// Show existing accounts if any
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

	// Show configured tables
	tables, _ := config.ListConfiguredTables(".")
	if len(tables) > 0 {
		fmt.Println("📁 Configured tables:")
		for _, t := range tables {
			fmt.Printf("   • %s/\n", t)
		}
		fmt.Println()
	}

	// Main setup loop
	for {
		options := []string{
			"Add a new account",
			"Set up tables",
			"Download records",
			"Exit setup",
		}

		// If no accounts, go straight to adding one
		if len(cfg.Accounts) == 0 {
			fmt.Println("No accounts configured. Let's add one first!")
			if err := addAccountInteractive(cfg, secrets); err != nil {
				if shouldGoBack(err) {
					fmt.Println("\nExiting setup.")
					return nil
				}
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}
			saveConfigs(cfg, secrets)
			continue
		}

		action := ""
		prompt := &survey.Select{
			Message: "What would you like to do?",
			Options: options,
		}
		if err := askOne(prompt, &action); err != nil {
			if shouldGoBack(err) {
				fmt.Println()
				fmt.Println("👋 Setup complete! Run 'scratchmd --help' to see available commands.")
				return nil
			}
			return err
		}

		switch action {
		case "Exit setup":
			fmt.Println()
			fmt.Println("👋 Setup complete! Run 'scratchmd --help' to see available commands.")
			return nil

		case "Add a new account":
			if err := addAccountInteractive(cfg, secrets); err != nil {
				if !shouldGoBack(err) {
					fmt.Printf("\n❌ Error: %s\n\n", err)
				}
				continue
			}
			saveConfigs(cfg, secrets)

		case "Set up tables":
			if err := setupTablesInteractive(cfg, secrets); err != nil {
				if !shouldGoBack(err) {
					fmt.Printf("\n❌ Error: %s\n\n", err)
				}
				continue
			}

		case "Download records":
			if err := downloadRecordsInteractive(cfg, secrets); err != nil {
				if !shouldGoBack(err) {
					fmt.Printf("\n❌ Error: %s\n\n", err)
				}
				continue
			}
		}
	}
}

// saveConfigs persists both config and secrets files, and ensures .gitignore is updated.
//
// Config (scratchmd.config.yaml) is committable. Secrets (.scratchmd.secrets.yaml) is
// gitignored and saved with restrictive permissions (0600).
func saveConfigs(cfg *config.Config, secrets *config.SecretsConfig) {
	// Save config (committable)
	if err := config.SaveConfig(cfg); err != nil {
		fmt.Printf("⚠️  Warning: Could not save configuration: %s\n", err)
	}

	// Save secrets (gitignored)
	if err := config.SaveSecrets(secrets); err != nil {
		fmt.Printf("⚠️  Warning: Could not save secrets: %s\n", err)
	}

	// Ensure gitignore
	if err := config.EnsureGitignore("."); err != nil {
		fmt.Printf("⚠️  Warning: Could not update .gitignore: %s\n", err)
	}

	fmt.Println("\n✅ Saved successfully!")
	fmt.Println()
}

// setupTablesInteractive configures local folders to sync with remote CMS tables.
//
// Flow: select account -> fetch available tables from CMS -> multi-select tables ->
// for each table: choose filename field, choose content field -> create folder structure:
//   - <table>/scratchmd.table.yaml (table config)
//   - <table>/scratchmd.schema.yaml (field definitions cached from CMS)
//   - .scratchmd/<table>/ (directory for change tracking)
func setupTablesInteractive(cfg *config.Config, secrets *config.SecretsConfig) error {
	fmt.Println()

	// Build account options
	if len(cfg.Accounts) == 0 {
		return fmt.Errorf("no accounts configured - add an account first")
	}

	var selectedAccount *config.Account

	if len(cfg.Accounts) == 1 {
		// Auto-select if only one account
		selectedAccount = &cfg.Accounts[0]
		fmt.Printf("Using account: %s (%s)\n", selectedAccount.Name, selectedAccount.Provider)
	} else {
		// Let user choose
		accountOptions := make([]string, len(cfg.Accounts))
		for i, acc := range cfg.Accounts {
			accountOptions[i] = fmt.Sprintf("%s (%s)", acc.Name, acc.Provider)
		}

		var selected string
		prompt := &survey.Select{
			Message: "Select an account:",
			Options: accountOptions,
		}
		if err := askOne(prompt, &selected); err != nil {
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

	// Get the authentication properties for this account
	authProps := secrets.GetSecretProperties(selectedAccount.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", selectedAccount.Name)
	}

	// List available tables via API
	fmt.Println()
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
	s.Suffix = " Fetching tables from server..."
	s.Start()

	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: selectedAccount.Provider,
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

	tables := resp.Tables

	if len(tables) == 0 {
		fmt.Println("\n⚠️  No tables/collections found in this account.")
		return nil
	}

	// Get already configured tables
	configuredTables, _ := config.ListConfiguredTables(".")
	configuredSet := make(map[string]bool)
	for _, t := range configuredTables {
		configuredSet[t] = true
	}

	// Sort tables alphabetically by display name
	sort.Slice(tables, func(i, j int) bool {
		nameI := tables[i].Name
		nameJ := tables[j].Name
		if tables[i].SiteName != "" {
			nameI = tables[i].SiteName + " - " + tables[i].Name
		}
		if tables[j].SiteName != "" {
			nameJ = tables[j].SiteName + " - " + tables[j].Name
		}
		return strings.ToLower(nameI) < strings.ToLower(nameJ)
	})

	// Build table options with sync status
	fmt.Println()
	tableOptions := make([]string, len(tables))
	for i, t := range tables {
		status := ""
		if configuredSet[t.Slug] {
			status = " (already configured)"
		}
		if t.SiteName != "" {
			tableOptions[i] = fmt.Sprintf("%s - %s%s", t.SiteName, t.Name, status)
		} else {
			tableOptions[i] = fmt.Sprintf("%s%s", t.Name, status)
		}
	}

	// Let user select tables
	var selectedTables []string
	multiPrompt := &survey.MultiSelect{
		Message: "Select tables to set up (space to toggle, enter to confirm):",
		Options: tableOptions,
	}
	if err := askOne(multiPrompt, &selectedTables); err != nil {
		return err
	}

	if len(selectedTables) == 0 {
		fmt.Println("No tables selected.")
		return nil
	}

	// Create folders and configs for selected tables
	for _, selectedOption := range selectedTables {
		// Find the matching table
		var table *providers.TableInfo
		for i, opt := range tableOptions {
			if opt == selectedOption {
				table = &tables[i]
				break
			}
		}
		if table == nil {
			continue
		}

		folderName := table.Slug
		fmt.Printf("\n📁 Setting up '%s' in folder '%s/'...\n", table.Name, folderName)

		// Build list of all field slugs for prompts
		allFieldSlugs := []string{}
		for _, f := range table.SystemFields {
			if f.Slug != "" {
				allFieldSlugs = append(allFieldSlugs, f.Slug)
			}
		}
		for _, f := range table.Fields {
			if f.Slug != "" {
				allFieldSlugs = append(allFieldSlugs, f.Slug)
			}
		}

		// Default filename field
		filenameField := ""
		if len(allFieldSlugs) > 0 {
			// Find a sensible default
			defaultField := allFieldSlugs[0]
			for _, s := range allFieldSlugs {
				if s == "slug" {
					defaultField = "slug"
					break
				}
			}

			filenamePrompt := &survey.Select{
				Message: "Select the field to use for filenames:",
				Options: allFieldSlugs,
				Default: defaultField,
			}
			if err := askOne(filenamePrompt, &filenameField); err != nil {
				return err
			}
		} else {
			filenameField = "id" // Fallback
		}

		// Content field (optional - for rich text body)
		contentFieldOptions := append([]string{"(none)"}, allFieldSlugs...)
		contentField := ""
		contentPrompt := &survey.Select{
			Message: "Select the field to use as content body (or none):",
			Options: contentFieldOptions,
			Default: "(none)",
		}
		if err := askOne(contentPrompt, &contentField); err != nil {
			return err
		}
		if contentField == "(none)" {
			contentField = ""
		}

		// Create table config
		tableConfig := &config.TableConfig{
			AccountID:     selectedAccount.ID,
			Provider:      selectedAccount.Provider,
			TableID:       table.ID,
			SiteID:        table.SiteID,
			TableName:     table.Name,
			SiteName:      table.SiteName,
			FilenameField: filenameField,
			ContentField:  contentField,
		}

		// Create the .scratchmd directory structure for change tracking
		scratchmdFolderDir := filepath.Join(".scratchmd", folderName)
		if err := os.MkdirAll(scratchmdFolderDir, 0755); err != nil {
			fmt.Printf("   ❌ Failed to create .scratchmd folder: %s\n", err)
			continue
		}

		if err := config.SaveTableConfig(folderName, tableConfig); err != nil {
			fmt.Printf("   ❌ Failed to save config: %s\n", err)
			continue
		}
		fmt.Printf("   ✅ Created %s/%s\n", folderName, config.TableConfigFileName)
		fmt.Printf("   ✅ Created .scratchmd/%s/ for tracking changes\n", folderName)

		// Create schema with field metadata
		schema := make(config.TableSchema)

		// Add system fields first
		for _, f := range table.SystemFields {
			if f.Slug != "" {
				schema[f.Slug] = fieldInfoToSchema(f)
			}
		}

		// Add user-defined fields (from fieldData)
		for _, f := range table.Fields {
			if f.Slug != "" {
				schema[f.Slug] = fieldInfoToSchema(f)
			}
		}

		if err := config.SaveTableSchema(folderName, schema); err != nil {
			fmt.Printf("   ❌ Failed to save schema: %s\n", err)
			continue
		}
		fmt.Printf("   ✅ Created %s/%s\n", folderName, config.TableSchemaFileName)
	}

	fmt.Printf("\n✅ Set up %d table(s) successfully!\n", len(selectedTables))
	return nil
}

// addAccountInteractive walks the user through adding a CMS account.
//
// Flow: select provider -> enter name -> collect auth credentials (provider-specific) ->
// test connection via API -> optionally save even if test fails. Existing accounts
// with the same name can be overwritten after confirmation.
func addAccountInteractive(cfg *config.Config, secrets *config.SecretsConfig) error {
	fmt.Println()

	// Select provider
	providerOptions := providers.SupportedProviders()
	displayOptions := make([]string, len(providerOptions))
	for i, p := range providerOptions {
		provider, _ := providers.GetProvider(p)
		displayOptions[i] = provider.DisplayName()
	}

	var selectedProvider string
	providerPrompt := &survey.Select{
		Message: "Select your CMS provider:",
		Options: displayOptions,
	}
	if err := askOne(providerPrompt, &selectedProvider); err != nil {
		return err
	}

	// Map display name back to provider name
	var providerName string
	for i, display := range displayOptions {
		if display == selectedProvider {
			providerName = providerOptions[i]
			break
		}
	}

	// Get account name (optional, defaults to provider name)
	accountName := ""
	namePrompt := &survey.Input{
		Message: "Account name (press Enter for default):",
		Default: providerName,
		Help:    "A friendly name to identify this account. Useful if you have multiple accounts.",
	}
	if err := askOne(namePrompt, &accountName); err != nil {
		return err
	}

	// Trim and use default if empty
	accountName = strings.TrimSpace(accountName)
	if accountName == "" {
		accountName = providerName
	}

	// Check for duplicate name
	existingAccount := cfg.GetAccount(accountName)
	if existingAccount != nil {
		overwrite := false
		confirmPrompt := &survey.Confirm{
			Message: fmt.Sprintf("Account '%s' already exists. Overwrite?", accountName),
			Default: false,
		}
		if err := askOne(confirmPrompt, &overwrite); err != nil {
			return err
		}
		if !overwrite {
			return fmt.Errorf("account creation cancelled")
		}
	}

	// Get provider to access auth properties
	provider, err := providers.GetProvider(providerName)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Collect authentication properties from user
	authProps := provider.AuthProperties()
	authValues := make(map[string]string)

	for _, prop := range authProps {
		var value string

		if prop.Sensitive {
			// Use password prompt for sensitive fields
			prompt := &survey.Password{
				Message: fmt.Sprintf("Enter %s:", prop.DisplayName),
				Help:    prop.Description,
			}
			if err := askOne(prompt, &value); err != nil {
				return err
			}
		} else {
			// Use input prompt for non-sensitive fields
			prompt := &survey.Input{
				Message: fmt.Sprintf("Enter %s:", prop.DisplayName),
				Help:    prop.Description,
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
		Service: providerName,
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
			Message: "Save account anyway? (You can test again later)",
			Default: false,
		}
		if err := askOne(savePrompt, &saveAnyway); err != nil {
			return err
		}
		if !saveAnyway {
			return fmt.Errorf("account creation cancelled - connection test failed")
		}
	}

	// Generate UUID for new account, or reuse existing
	var accountID string
	if existingAccount != nil {
		accountID = existingAccount.ID
	} else {
		accountID = config.GenerateAccountID()
	}

	// Save account to config (without secrets)
	account := config.Account{
		ID:       accountID,
		Name:     accountName,
		Provider: providerName,
		Tested:   tested,
	}
	cfg.AddAccount(account)

	// Save authentication properties to secrets (linked by UUID)
	secrets.SetSecretProperties(accountID, authValues)

	return nil
}

func getAPIKeyHelp(provider string) string {
	switch provider {
	case "webflow":
		return "Create an API token at: https://webflow.com/dashboard/account/integrations"
	case "wordpress":
		return "For WordPress.com: Create an app at https://developer.wordpress.com/apps/\nFor self-hosted: Use an Application Password from your profile"
	default:
		return "Enter your API key or access token"
	}
}

func downloadRecordsInteractive(cfg *config.Config, secrets *config.SecretsConfig) error {
	fmt.Println()

	// List configured tables
	tables, err := config.ListConfiguredTables(".")
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	if len(tables) == 0 {
		fmt.Println("⚠️  No tables configured yet. Use 'Set up tables' first.")
		return nil
	}

	// Let user select a table
	var selectedTable string
	tablePrompt := &survey.Select{
		Message: "Select a table to download:",
		Options: tables,
	}
	if err := askOne(tablePrompt, &selectedTable); err != nil {
		return err
	}

	// Use the shared download package
	downloader := download.NewTableDownloader(cfg, secrets, cfg.Settings.ScratchServerURL)
	opts := download.Options{
		Clobber:             false, // Interactive mode doesn't clobber by default
		DownloadAttachments: true,
		OnProgress:          func(msg string) { fmt.Println(msg) },
	}

	_, err = downloader.Download(selectedTable, opts)
	return err
}
