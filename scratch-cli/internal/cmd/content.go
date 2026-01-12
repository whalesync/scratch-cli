// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
	"gopkg.in/yaml.v3"
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

	// Get the provider
	provider, err := providers.GetProvider(account.Provider)
	if err != nil {
		return err
	}

	// Check if provider supports downloading records
	downloader, ok := provider.(providers.RecordDownloader)
	if !ok {
		return fmt.Errorf("provider '%s' does not support downloading records", account.Provider)
	}

	fmt.Printf("📥 Downloading '%s' from %s...\n", tableConfig.TableName, account.Name)

	// Track stats
	totalSaved := 0

	// Download records
	err = downloader.DownloadRecords(apiKey, tableConfig.TableID, func(message string) {
		fmt.Printf("   %s\n", message)
	}, func(records []providers.Record) error {
		// Save each record as a Markdown file with frontmatter
		for _, record := range records {
			// Get filename from configured field
			filename := getFieldValueFromRecord(record.RawData, tableConfig.FilenameField)
			if filename == "" {
				filename = record.Slug
			}
			if filename == "" {
				filename = record.ID
			}

			// Sanitize filename
			filename = sanitizeFilenameForPath(filename)
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
									contentBody = fmt.Sprintf("%v", fieldValue)
								}
							} else {
								frontmatter[fieldKey] = fieldValue
							}
						}
					}
				} else {
					// System field
					frontmatter[key] = value
				}
			}

			// Build the Markdown file content
			var mdContent strings.Builder

			mdContent.WriteString("---\n")
			frontmatterYAML, err := yaml.Marshal(frontmatter)
			if err != nil {
				fmt.Printf("   ⚠️  Failed to serialize frontmatter for '%s': %v\n", filename, err)
				continue
			}
			mdContent.Write(frontmatterYAML)
			mdContent.WriteString("---\n\n")

			if contentBody != "" {
				mdContent.WriteString(contentBody)
				mdContent.WriteString("\n")
			}

			// Save the file
			filePath := filepath.Join(tableName, filename+".md")
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

	fmt.Printf("✅ Downloaded %d record(s) to '%s/'\n", totalSaved, tableName)
	return nil
}

// getFieldValueFromRecord extracts a field value from record data
func getFieldValueFromRecord(data map[string]interface{}, fieldName string) string {
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

// sanitizeFilenameForPath removes or replaces characters that are invalid in filenames
func sanitizeFilenameForPath(name string) string {
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
