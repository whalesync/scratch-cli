// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:   "content",
	Short: "Manage CMS content",
	Long: `Manage CMS content synchronization.

NON-INTERACTIVE (LLM-friendly):
  content download [folder]    Download content from CMS

Use 'account link-table' first to configure which tables to sync.`,
}

// contentDownloadCmd represents the content download command
var contentDownloadCmd = &cobra.Command{
	Use:   "download [folder]",
	Short: "[NON-INTERACTIVE] Download content from CMS",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Download content from a configured CMS collection.

If folder is specified, downloads only that collection.
If no folder is specified, downloads all configured collections.

Examples:
  scratchmd content download              # download all linked tables
  scratchmd content download blog-posts   # download one table`,
	RunE: runContentDownload,
}

func init() {
	rootCmd.AddCommand(contentCmd)
	contentCmd.AddCommand(contentDownloadCmd)
}

func runContentDownload(cmd *cobra.Command, args []string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Get list of tables to download
	var tablesToDownload []string

	if len(args) > 0 {
		// Download specific folder
		tablesToDownload = []string{args[0]}
	} else {
		// Download all configured tables
		tables, err := config.ListConfiguredTables(".")
		if err != nil {
			return fmt.Errorf("failed to list tables: %w", err)
		}
		if len(tables) == 0 {
			fmt.Println("No tables configured.")
			fmt.Println("Run 'scratchmd setup' and select 'Set up tables' first.")
			return nil
		}
		tablesToDownload = tables
	}

	// Download each table
	for _, tableName := range tablesToDownload {
		if err := downloadTable(cfg, secrets, tableName); err != nil {
			fmt.Printf("❌ Error downloading '%s': %v\n", tableName, err)
			continue
		}
	}

	return nil
}

func downloadTable(cfg *config.Config, secrets *config.SecretsConfig, tableName string) error {
	// Load table config
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil {
		return fmt.Errorf("failed to load table config: %w", err)
	}
	if tableConfig == nil {
		return fmt.Errorf("table config not found for '%s'", tableName)
	}

	// Get the account for this table
	account := cfg.GetAccountByID(tableConfig.AccountID)
	if account == nil {
		return fmt.Errorf("account not found for table '%s'", tableName)
	}

	// Get the API key
	apiKey := secrets.GetSecret(account.ID)
	if apiKey == "" {
		return fmt.Errorf("no API key found for account '%s'", account.Name)
	}

	fmt.Printf("📥 Downloading '%s' from %s...\n", tableConfig.TableName, account.Name)

	// Create API client
	client := api.NewClient()

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params: map[string]string{
			"apiKey": apiKey,
		},
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

	// Save each file
	totalSaved := 0
	for _, file := range resp.Files {
		// Use the slug directly as the filename (already sanitized by server)
		filename := file.Slug
		if filename == "" {
			filename = file.ID
		}

		// Save the file - content is already in Frontmatter YAML format
		filePath := filepath.Join(tableName, filename+".md")
		if err := os.WriteFile(filePath, []byte(file.Content), 0644); err != nil {
			fmt.Printf("   ⚠️  Failed to save '%s': %v\n", filePath, err)
			continue
		}

		totalSaved++
	}

	fmt.Printf("✅ Downloaded %d record(s) to '%s/'\n", totalSaved, tableName)
	return nil
}
