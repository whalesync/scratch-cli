package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
)

// newAPIClient creates an API client for the given server URL, automatically
// including the API token from stored credentials if available and not expired.
func newAPIClient(serverURL string) *api.Client {
	opts := []api.ClientOption{api.WithBaseURL(serverURL)}

	// Try to load credentials for this server and add the token if valid
	creds, err := config.LoadGlobalCredentials(serverURL)
	if err == nil && creds.APIToken != "" {
		// Check if token is expired
		isExpired := false
		if creds.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, creds.ExpiresAt)
			if err == nil && time.Now().After(expiresAt) {
				isExpired = true
			}
		}
		if !isExpired {
			opts = append(opts, api.WithAPIToken(creds.APIToken))
		}
	}

	return api.NewClient(opts...)
}

// setupTablesForAccountInteractive is a version of setupTablesInteractive that works on a pre-selected account
func setupTablesForAccountInteractive(cfg *config.Config, secrets *config.SecretsConfig, account *config.Account) error {
	// Get the authentication properties for this account
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", account.Name)
	}

	// List available tables via API
	fmt.Println()
	fmt.Println("   Fetching tables from server...")

	client := newAPIClient(cfg.Settings.ScratchServerURL)
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
			AccountID:     account.ID,
			Provider:      account.Provider,
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
