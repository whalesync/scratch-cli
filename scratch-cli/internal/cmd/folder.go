package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
)

// folderCmd represents the folder command
var folderCmd = &cobra.Command{
	Use:   "folder",
	Short: "Manage local folders linked to CMS",
	Long:  `Manage local folders that are linked to remote CMS tables/collections.`,
}

// folderLinkCmd represents the folder link command
var folderLinkCmd = &cobra.Command{
	Use:   "link [folder-name]",
	Short: "[NON-INTERACTIVE] Link a remote table to a local folder",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Create a local folder linked to a remote CMS table/collection.

This creates the folder structure and configuration files needed to sync content.
If folder-name is not provided, the table's slug will be used.

Requires --account.name and --table-id flags.

After linking, use 'content download <folder>' to fetch records.

Examples:
  scratchmd folder link --account.name=webflow --table-id=6789abc
  scratchmd folder link blog-posts --account.name=webflow --table-id=6789abc`,
	Args: cobra.MaximumNArgs(1),
	RunE: runFolderLink,
}

func init() {
	rootCmd.AddCommand(folderCmd)
	folderCmd.AddCommand(folderLinkCmd)

	folderLinkCmd.Flags().String("account.name", "", "Account name to link (required)")
	folderLinkCmd.Flags().String("table-id", "", "Table ID to link (required)")
	folderLinkCmd.MarkFlagRequired("account.name")
	folderLinkCmd.MarkFlagRequired("table-id")
}

func runFolderLink(cmd *cobra.Command, args []string) error {
	accountName, _ := cmd.Flags().GetString("account.name")
	tableID, _ := cmd.Flags().GetString("table-id")

	var folderName string
	if len(args) > 0 {
		folderName = args[0]
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

	// Find the table by ID
	var targetTable *providers.TableInfo
	for i := range resp.Tables {
		if resp.Tables[i].ID == tableID {
			targetTable = &resp.Tables[i]
			break
		}
	}
	if targetTable == nil {
		return fmt.Errorf("table with ID '%s' not found. Run 'scratchmd account list-folders %s' to see available tables", tableID, accountName)
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

	// Create schema from table fields with metadata
	schema := make(config.TableSchema)
	for _, field := range targetTable.Fields {
		schema[field.Slug] = fieldInfoToSchema(field)
	}
	for _, field := range targetTable.SystemFields {
		schema[field.Slug] = fieldInfoToSchema(field)
	}

	if err := config.SaveTableSchema(folderName, schema); err != nil {
		return fmt.Errorf("failed to save table schema: %w", err)
	}

	fmt.Printf("Linked table '%s' to folder '%s'.\n", targetTable.Name, folderName)
	fmt.Printf("Created .scratchmd/%s/ for tracking changes.\n", folderName)
	fmt.Printf("Run 'scratchmd content download %s' to download records.\n", folderName)
	return nil
}
