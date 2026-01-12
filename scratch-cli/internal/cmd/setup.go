// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
	"golang.org/x/term"
	"gopkg.in/yaml.v3"
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

	// Get the API key for this account
	apiKey := secrets.GetSecret(selectedAccount.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", selectedAccount.Name)
	}

	// Get the provider
	provider, err := providers.GetProvider(selectedAccount.Provider)
	if err != nil {
		return err
	}

	// Check if provider supports listing tables
	tableLister, ok := provider.(providers.TableLister)
	if !ok {
		return fmt.Errorf("provider '%s' does not support listing tables yet", selectedAccount.Provider)
	}

	// List available tables with progress
	fmt.Println()
	var tables []providers.TableInfo
	tables, err = tableLister.ListTables(apiKey, func(message string) {
		fmt.Printf("   %s\n", message)
	})
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

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

		if err := config.SaveTableConfig(folderName, tableConfig); err != nil {
			fmt.Printf("   ❌ Failed to save config: %s\n", err)
			continue
		}
		fmt.Printf("   ✅ Created %s/%s\n", folderName, config.TableConfigFileName)

		// Create simplified schema (field slug -> type)
		schema := make(config.TableSchema)

		// Add system fields first
		for _, f := range table.SystemFields {
			if f.Slug != "" {
				schema[f.Slug] = f.Type
			}
		}

		// Add user-defined fields (from fieldData)
		for _, f := range table.Fields {
			if f.Slug != "" {
				schema[f.Slug] = f.Type
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

	// Get API key
	apiKey := ""
	keyPrompt := &survey.Password{
		Message: "Enter your API key:",
		Help:    getAPIKeyHelp(providerName),
	}
	if err := survey.AskOne(keyPrompt, &apiKey); err != nil {
		return err
	}

	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	// Test connection
	fmt.Print("\n⏳ Testing connection...")

	provider, err := providers.GetProvider(providerName)
	if err != nil {
		return err
	}

	tested := false
	if err := provider.TestConnection(apiKey); err != nil {
		fmt.Printf(" ❌ Failed\n")
		fmt.Printf("   Error: %s\n", err)

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
	} else {
		fmt.Printf(" ✅ Success!\n")
		tested = true
	}

	// Generate UUID for new account, or reuse existing
	var accountID string
	if existingAccount != nil {
		accountID = existingAccount.ID
	} else {
		accountID = config.GenerateAccountID()
	}

	// Save account to config (without API key)
	account := config.Account{
		ID:       accountID,
		Name:     accountName,
		Provider: providerName,
		Tested:   tested,
	}
	cfg.AddAccount(account)

	// Save API key to secrets (linked by UUID)
	secrets.SetSecret(accountID, apiKey)

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
	// Get the API key
	apiKey := secrets.GetSecret(account.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", account.Name)
	}

	// Get the provider
	provider, err := providers.GetProvider(account.Provider)
	if err != nil {
		return err
	}

	// Check if provider supports downloading records
	downloader, ok := provider.(providers.RecordDownloader)
	if !ok {
		return fmt.Errorf("provider '%s' does not support downloading records yet", account.Provider)
	}

	fmt.Printf("\n📥 Downloading records from '%s'...\n\n", tableConfig.TableName)

	// Track stats
	totalSaved := 0

	// Download records
	err = downloader.DownloadRecords(apiKey, tableConfig.TableID, func(message string) {
		fmt.Printf("   %s\n", message)
	}, func(records []providers.Record) error {
		// Save each record as a Markdown file with frontmatter
		for _, record := range records {
			// Get filename from configured field
			filename := getFieldValue(record.RawData, tableConfig.FilenameField)
			if filename == "" {
				filename = record.Slug
			}
			if filename == "" {
				filename = record.ID
			}

			// Sanitize filename
			filename = sanitizeFilename(filename)
			if filename == "" {
				filename = record.ID
			}

			// Build frontmatter and content
			frontmatter := make(map[string]interface{})
			var contentBody string

			// Process all fields from the record
			for key, value := range record.RawData {
				if key == "fieldData" {
					// Handle user-defined fields
					if fieldData, ok := value.(map[string]interface{}); ok {
						for fieldKey, fieldValue := range fieldData {
							if tableConfig.ContentField != "" && fieldKey == tableConfig.ContentField {
								// This is the content body field
								if strVal, ok := fieldValue.(string); ok {
									contentBody = strVal
								} else {
									// Convert to string if possible
									contentBody = fmt.Sprintf("%v", fieldValue)
								}
							} else {
								// Add to frontmatter
								frontmatter[fieldKey] = fieldValue
							}
						}
					}
				} else {
					// System field - add to frontmatter
					frontmatter[key] = value
				}
			}

			// Build the Markdown file content
			var mdContent strings.Builder

			// Write YAML frontmatter
			mdContent.WriteString("---\n")
			frontmatterYAML, err := yaml.Marshal(frontmatter)
			if err != nil {
				fmt.Printf("   ⚠️  Failed to serialize frontmatter for '%s': %v\n", filename, err)
				continue
			}
			mdContent.Write(frontmatterYAML)
			mdContent.WriteString("---\n\n")

			// Write content body
			if contentBody != "" {
				mdContent.WriteString(contentBody)
				mdContent.WriteString("\n")
			}

			// Save the file
			filePath := filepath.Join(selectedTable, filename+".md")
			if err := os.WriteFile(filePath, []byte(mdContent.String()), 0644); err != nil {
				fmt.Printf("   ⚠️  Failed to save '%s': %v\n", filePath, err)
				continue
			}

			totalSaved++
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	fmt.Printf("\n✅ Downloaded %d record(s) to '%s/'\n", totalSaved, selectedTable)
	return nil
}

// getFieldValue extracts a field value from record data, checking both top-level and fieldData
func getFieldValue(data map[string]interface{}, fieldName string) string {
	// Check top-level first
	if val, ok := data[fieldName]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}

	// Check in fieldData
	if fieldData, ok := data["fieldData"].(map[string]interface{}); ok {
		if val, ok := fieldData[fieldName]; ok {
			if strVal, ok := val.(string); ok {
				return strVal
			}
		}
	}

	return ""
}

// sanitizeFilename removes or replaces characters that are invalid in filenames
func sanitizeFilename(name string) string {
	// Replace problematic characters
	replacer := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "-",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "-",
	)
	return replacer.Replace(name)
}
