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
			"Advanced settings",
			"Exit setup",
		}

		// If no accounts, go straight to adding one
		if len(cfg.Accounts) == 0 {
			fmt.Println("No accounts configured. Let's add one first!")
			if err := addAccountInteractive(cfg, secrets); err != nil {
				if err.Error() == "interrupt" {
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
		if err := survey.AskOne(prompt, &action); err != nil {
			return err
		}

		switch action {
		case "Exit setup":
			fmt.Println()
			fmt.Println("👋 Setup complete! Run 'scratchmd --help' to see available commands.")
			return nil

		case "Add a new account":
			if err := addAccountInteractive(cfg, secrets); err != nil {
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}
			saveConfigs(cfg, secrets)

		case "Set up tables":
			if err := setupTablesInteractive(cfg, secrets); err != nil {
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}

		case "Download records":
			if err := downloadRecordsInteractive(cfg, secrets); err != nil {
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}

		case "Advanced settings":
			if err := advancedSettingsInteractive(cfg); err != nil {
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}
		}
	}
}

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

	// Get the authentication properties for this account
	authProps := secrets.GetSecretProperties(selectedAccount.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", selectedAccount.Name)
	}

	// List available tables via API
	fmt.Println()
	fmt.Println("   Fetching tables from server...")

	client := newAPIClient(cfg.Settings.ScratchServerURL)
	creds := &api.ConnectorCredentials{
		Service: selectedAccount.Provider,
		Params:  authProps,
	}

	resp, err := client.ListTables(creds)
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
	if err := survey.AskOne(multiPrompt, &selectedTables); err != nil {
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
			if err := survey.AskOne(filenamePrompt, &filenameField); err != nil {
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
		if err := survey.AskOne(contentPrompt, &contentField); err != nil {
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
	if err := survey.AskOne(providerPrompt, &selectedProvider); err != nil {
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
	if err := survey.AskOne(namePrompt, &accountName); err != nil {
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
		if err := survey.AskOne(confirmPrompt, &overwrite); err != nil {
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
			if err := survey.AskOne(prompt, &value); err != nil {
				return err
			}
		} else {
			// Use input prompt for non-sensitive fields
			prompt := &survey.Input{
				Message: fmt.Sprintf("Enter %s:", prop.DisplayName),
				Help:    prop.Description,
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
		if err := survey.AskOne(savePrompt, &saveAnyway); err != nil {
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
	if err := survey.AskOne(tablePrompt, &selectedTable); err != nil {
		return err
	}

	// Load table config
	tableConfig, err := config.LoadTableConfig(selectedTable)
	if err != nil {
		return fmt.Errorf("failed to load table config: %w", err)
	}
	if tableConfig == nil {
		return fmt.Errorf("table config not found for '%s'", selectedTable)
	}

	// Get the account for this table
	account := cfg.GetAccountByID(tableConfig.AccountID)
	if account == nil {
		return fmt.Errorf("account not found for table '%s'", selectedTable)
	}

	// Get the authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", account.Name)
	}

	fmt.Printf("\n📥 Downloading records from '%s'...\n\n", tableConfig.TableName)

	// Create API client
	client := newAPIClient(cfg.Settings.ScratchServerURL)

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	// Build table ID array - if SiteID exists, use [siteId, tableId], otherwise just [tableId]
	var tableID []string
	if tableConfig.SiteID != "" {
		tableID = []string{tableConfig.SiteID, tableConfig.TableID}
	} else {
		tableID = []string{tableConfig.TableID}
	}

	// Build download request
	req := &api.DownloadRequest{
		TableID:         tableID,
		FilenameFieldID: tableConfig.FilenameField,
		ContentFieldID:  tableConfig.ContentField,
	}

	// Call the download endpoint
	resp, err := client.Download(creds, req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	// Check for errors in response
	if resp.Error != "" {
		return fmt.Errorf("server error: %s", resp.Error)
	}

	// Create the .scratchmd/<folder>/original directory for tracking changes
	originalDir := filepath.Join(".scratchmd", selectedTable, "original")
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return fmt.Errorf("failed to create original directory: %w", err)
	}

	// Save each file to both locations
	totalSaved := 0
	for _, file := range resp.Files {
		// Use the slug directly as the filename (already sanitized by server)
		filename := file.Slug
		if filename == "" {
			filename = file.ID
		}

		fileContent := []byte(file.Content)
		mdFilename := filename + ".md"

		// Save to the main folder (user-editable copy)
		mainPath := filepath.Join(selectedTable, mdFilename)
		if err := os.WriteFile(mainPath, fileContent, 0644); err != nil {
			fmt.Printf("   ⚠️  Failed to save '%s': %v\n", mainPath, err)
			continue
		}

		// Save to .scratchmd/<folder>/original (for change detection)
		originalPath := filepath.Join(originalDir, mdFilename)
		if err := os.WriteFile(originalPath, fileContent, 0644); err != nil {
			fmt.Printf("   ⚠️  Failed to save original '%s': %v\n", originalPath, err)
			// Continue anyway, main file was saved
		}

		totalSaved++
	}

	fmt.Printf("\n✅ Downloaded %d record(s) to '%s/'\n", totalSaved, selectedTable)

	// Phase 2: Download attachments if the provider supports them and has attachment fields
	provider, providerErr := providers.GetProvider(tableConfig.Provider)
	if providerErr == nil && provider.SupportsAttachments() {
		schema, err := config.LoadTableSchema(selectedTable)
		if err != nil {
			fmt.Printf("   ⚠️  Failed to load schema for attachment check: %v\n", err)
		} else if schema != nil {
			attachmentFields := getAttachmentFields(schema)
			if len(attachmentFields) > 0 {
				// Create assets folder in the content folder
				assetsDir := filepath.Join(selectedTable, "assets")
				if err := os.MkdirAll(assetsDir, 0755); err != nil {
					fmt.Printf("   ⚠️  Failed to create assets directory: %v\n", err)
				}

				// Create assets folder in the original folder
				originalAssetsDir := filepath.Join(originalDir, "assets")
				if err := os.MkdirAll(originalAssetsDir, 0755); err != nil {
					fmt.Printf("   ⚠️  Failed to create original assets directory: %v\n", err)
				}

				// Check if provider implements AttachmentExtractor
				extractor, ok := provider.(providers.AttachmentExtractor)
				if ok {
					fmt.Printf("📎 Downloading attachments for fields: %v\n", attachmentFields)
					totalAttachments := 0

					// Process each downloaded file to extract and download attachments
					for _, file := range resp.Files {
						// Parse the file content to get field values
						fileAttachments, err := extractAttachmentsFromContent(file.Content, attachmentFields, extractor)
						if err != nil {
							fmt.Printf("   ⚠️  Failed to extract attachments from '%s': %v\n", file.Slug, err)
							continue
						}

						if len(fileAttachments) > 0 {
							// Download to content assets folder (overwrite=false since Airtable attachments are immutable)
							downloaded, err := providers.DownloadAttachments(assetsDir, fileAttachments, false, func(msg string) {
								fmt.Printf("   %s\n", msg)
							})
							if err != nil {
								fmt.Printf("   ⚠️  Failed to download attachments for '%s': %v\n", file.Slug, err)
							}
							totalAttachments += downloaded

							// Copy downloaded files to original assets folder
							for _, att := range fileAttachments {
								if att.Name == "" || att.ID == "" {
									continue
								}
								ext := filepath.Ext(att.Name)
								nameWithoutExt := strings.TrimSuffix(att.Name, ext)
								filename := fmt.Sprintf("%s-%s%s", nameWithoutExt, att.ID, ext)
								srcPath := filepath.Join(assetsDir, filename)
								dstPath := filepath.Join(originalAssetsDir, filename)
								if err := copyFile(srcPath, dstPath); err != nil {
									fmt.Printf("   ⚠️  Failed to copy attachment to original: %v\n", err)
								}
							}
						}
					}

					if totalAttachments > 0 {
						fmt.Printf("📎 Downloaded %d attachment(s) to assets folders\n", totalAttachments)
					}
				}
			}
		}
	}

	return nil
}

// advancedSettingsInteractive allows users to configure advanced settings
func advancedSettingsInteractive(cfg *config.Config) error {
	fmt.Println()
	fmt.Println("⚙️  Advanced Settings")
	fmt.Println()

	for {
		options := []string{
			"Update Scratch.md Server URL",
			"Back to main menu",
		}

		action := ""
		prompt := &survey.Select{
			Message: "What would you like to configure?",
			Options: options,
		}
		if err := survey.AskOne(prompt, &action); err != nil {
			return err
		}

		switch action {
		case "Back to main menu":
			return nil

		case "Update Scratch.md Server URL":
			if err := setScratchServerURLInteractive(cfg); err != nil {
				fmt.Printf("\n❌ Error: %s\n\n", err)
				continue
			}
			config.SaveConfig(cfg)
		}
	}
}

// setScratchServerURLInteractive allows users to set the Scratch server URL
func setScratchServerURLInteractive(cfg *config.Config) error {
	fmt.Println()
	fmt.Printf("Current Scratch.md server URL: %s\n", cfg.Settings.ScratchServerURL)
	fmt.Println()

	var newURL string
	prompt := &survey.Input{
		Message: "Enter new Scratch.md server URL:",
		Default: cfg.Settings.ScratchServerURL,
		Help:    "The URL for the Scratch.md API server (e.g., https://api.scratch.md)",
	}
	if err := survey.AskOne(prompt, &newURL); err != nil {
		return err
	}

	newURL = strings.TrimSpace(newURL)
	if newURL == "" {
		return fmt.Errorf("Scratch.md server URL cannot be empty")
	}

	// Remove trailing slash if present
	newURL = strings.TrimSuffix(newURL, "/")

	fmt.Print("\n⏳ Testing connection to server...")

	client := newAPIClient(newURL)
	if err := client.CheckHealth(); err != nil {
		fmt.Printf(" ❌ Failed\n")
		fmt.Printf("   Error: %s\n\n", err)

		// Ask if they want to save anyway
		saveAnyway := false
		savePrompt := &survey.Confirm{
			Message: "Save URL anyway?",
			Default: false,
		}
		if err := survey.AskOne(savePrompt, &saveAnyway); err != nil {
			return err
		}
		if !saveAnyway {
			return fmt.Errorf("URL change cancelled - health check failed")
		}
	} else {
		fmt.Printf(" ✅ Success!\n")
	}

	cfg.Settings.ScratchServerURL = newURL

	fmt.Printf("\n✅ Scratch server URL updated to: %s\n\n", newURL)
	return nil
}
