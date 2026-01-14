// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"gopkg.in/yaml.v3"
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:   "content",
	Short: "Manage CMS content",
	Long: `Manage CMS content synchronization.

NON-INTERACTIVE (LLM-friendly):
  content download [folder]    Download content from CMS
  content diff <folder>        Show which files have changed
  content field-diff <folder>  Show which fields changed in a file

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

By default, preserves locally edited files (only updates unmodified files).
Use --clobber to delete everything and re-download fresh.

Examples:
  scratchmd content download              # download all linked tables
  scratchmd content download blog-posts   # download one table
  scratchmd content download --clobber    # reset and re-download everything`,
	RunE: runContentDownload,
}

// contentDiffCmd represents the content diff command
var contentDiffCmd = &cobra.Command{
	Use:   "diff <folder>",
	Short: "[NON-INTERACTIVE] Show which files have changed",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Compare files in a table folder against the original downloaded versions.

Without --file flag, reports:
  - Modified files (content differs from original)
  - Added files (exist in folder but not in original)
  - Deleted files (exist in original but not in folder)

With --file flag, shows the actual diff for a specific file using git or diff.

Examples:
  scratchmd content diff blog-posts
  scratchmd content diff blog-posts --file post-1.md`,
	Args: cobra.ExactArgs(1),
	RunE: runContentDiff,
}

// contentFieldDiffCmd represents the content field-diff command
var contentFieldDiffCmd = &cobra.Command{
	Use:   "field-diff <folder> [--file <filename>]",
	Short: "[NON-INTERACTIVE] Show which fields changed in files",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Compare files' fields against the original downloaded versions.

Without --file flag, compares all files and shows:
  - Deleted files (in red)
  - Created files (in green)
  - Modified files with list of changed fields (in orange)

With --file flag, shows field changes for a specific file only.

Examples:
  scratchmd content field-diff blog-posts
  scratchmd content field-diff blog-posts --file post-1.md`,
	Args: cobra.ExactArgs(1),
	RunE: runContentFieldDiff,
}

// contentUploadCmd represents the content upload command
var contentUploadCmd = &cobra.Command{
	Use:   "upload [folder[/file.md]]",
	Short: "[NON-INTERACTIVE] Upload local changes to CMS",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Upload local content changes to the configured CMS.

Without arguments, uploads all changes across all linked tables.
With folder argument, uploads changes for that collection only.
With folder/file.md argument, uploads a single record.

By default, shows a preview of changes and asks for confirmation.
Use --no-review to skip the confirmation prompt.
Use --sync-deletes to delete remote records that are missing locally.

Examples:
  scratchmd content upload                      # upload all changes (with review)
  scratchmd content upload blog-posts           # upload one collection
  scratchmd content upload blog-posts/post.md   # upload one record
  scratchmd content upload --no-review          # skip confirmation
  scratchmd content upload --sync-deletes       # delete remote records missing locally`,
	RunE: runContentUpload,
}

func init() {
	rootCmd.AddCommand(contentCmd)
	contentCmd.AddCommand(contentDownloadCmd)
	contentCmd.AddCommand(contentDiffCmd)
	contentCmd.AddCommand(contentFieldDiffCmd)
	contentCmd.AddCommand(contentUploadCmd)

	// Flags for content download
	contentDownloadCmd.Flags().Bool("clobber", false, "Delete existing files and re-download fresh")

	// Flags for content diff
	contentDiffCmd.Flags().String("file", "", "Show diff for a specific file")

	// Flags for content field-diff
	contentFieldDiffCmd.Flags().String("file", "", "File to compare (optional, compares all if not specified)")
	contentFieldDiffCmd.Flags().Bool("show-values", false, "Show old and new values for changed fields (only with --file)")

	// Flags for content upload
	contentUploadCmd.Flags().Bool("no-review", false, "Skip confirmation prompt")
	contentUploadCmd.Flags().Bool("sync-deletes", false, "Delete remote records that are missing locally")
}

// ANSI color codes
const (
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorOrange = "\033[33m"
	colorReset  = "\033[0m"
)

func runContentDownload(cmd *cobra.Command, args []string) error {
	clobber, _ := cmd.Flags().GetBool("clobber")

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
		if err := downloadTable(cfg, secrets, tableName, clobber); err != nil {
			fmt.Printf("❌ Error downloading '%s': %v\n", tableName, err)
			continue
		}
	}

	return nil
}

func downloadTable(cfg *config.Config, secrets *config.SecretsConfig, tableName string, clobber bool) error {
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

	// Get the authentication properties
	authProps := secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return fmt.Errorf("no credentials found for account '%s'", account.Name)
	}

	originalDir := filepath.Join(".scratchmd", tableName, "original")

	// If --clobber, delete both folders first
	if clobber {
		fmt.Printf("🗑️  Clobbering existing files for '%s'...\n", tableName)
		// Remove main folder contents (but not the folder itself, as it may have config)
		if entries, err := os.ReadDir(tableName); err == nil {
			for _, entry := range entries {
				if strings.HasSuffix(entry.Name(), ".md") {
					os.Remove(filepath.Join(tableName, entry.Name()))
				}
			}
		}
		// Remove original folder entirely
		os.RemoveAll(originalDir)
	}

	fmt.Printf("📥 Downloading '%s' from %s...\n", tableConfig.TableName, account.Name)

	// Create API client with base URL from config
	client := api.NewClient(api.WithBaseURL(cfg.Settings.ScratchServerURL))

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
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return fmt.Errorf("failed to create original directory: %w", err)
	}

	// Ensure main folder exists
	if err := os.MkdirAll(tableName, 0755); err != nil {
		return fmt.Errorf("failed to create table directory: %w", err)
	}

	// Save each file
	totalSaved := 0
	totalSkipped := 0
	for _, file := range resp.Files {
		// Use the slug directly as the filename (already sanitized by server)
		filename := file.Slug
		if filename == "" {
			filename = file.ID
		}

		fileContent := []byte(file.Content)
		mdFilename := filename + ".md"

		mainPath := filepath.Join(tableName, mdFilename)
		originalPath := filepath.Join(originalDir, mdFilename)

		// Check if main file should be updated
		// Only update main file if it matches the current original (unedited) or doesn't exist
		shouldUpdateMain := true
		if !clobber {
			// Read current original file (if exists)
			oldOriginal, errOldOrig := os.ReadFile(originalPath)
			// Read current main file (if exists)
			currentMain, errMain := os.ReadFile(mainPath)

			if errOldOrig == nil && errMain == nil {
				// Both files exist - only update main if it matches the old original
				if !bytes.Equal(currentMain, oldOriginal) {
					// Main file has been edited, don't overwrite it
					shouldUpdateMain = false
					totalSkipped++
					fmt.Printf("   ⏭️  Skipping '%s' (locally modified)\n", mdFilename)
				}
			}
			// If original doesn't exist or main doesn't exist, we'll write both
		}

		// Always update the original file
		if err := os.WriteFile(originalPath, fileContent, 0644); err != nil {
			fmt.Printf("   ⚠️  Failed to save original '%s': %v\n", originalPath, err)
			continue
		}

		// Update main file only if appropriate
		if shouldUpdateMain {
			if err := os.WriteFile(mainPath, fileContent, 0644); err != nil {
				fmt.Printf("   ⚠️  Failed to save '%s': %v\n", mainPath, err)
				continue
			}
		}

		totalSaved++
	}

	if totalSkipped > 0 {
		fmt.Printf("✅ Downloaded %d record(s) to '%s/' (%d locally modified files preserved)\n", totalSaved, tableName, totalSkipped)
	} else {
		fmt.Printf("✅ Downloaded %d record(s) to '%s/'\n", totalSaved, tableName)
	}
	return nil
}

func runContentDiff(cmd *cobra.Command, args []string) error {
	tableName := args[0]
	fileName, _ := cmd.Flags().GetString("file")

	// Check that the table folder exists
	if _, err := os.Stat(tableName); os.IsNotExist(err) {
		return fmt.Errorf("folder '%s' does not exist", tableName)
	}

	// Check that the original folder exists
	originalDir := filepath.Join(".scratchmd", tableName, "original")
	if _, err := os.Stat(originalDir); os.IsNotExist(err) {
		return fmt.Errorf("original folder '%s' does not exist. Run 'content download %s' first", originalDir, tableName)
	}

	// If --file flag is provided, show diff for that specific file
	if fileName != "" {
		return runFileDiff(tableName, originalDir, fileName)
	}

	// Get list of .md files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	// Read current folder
	entries, err := os.ReadDir(tableName)
	if err != nil {
		return fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			currentFiles[entry.Name()] = true
		}
	}

	// Read original folder
	entries, err = os.ReadDir(originalDir)
	if err != nil {
		return fmt.Errorf("failed to read original folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			originalFiles[entry.Name()] = true
		}
	}

	var modified, added, deleted []string

	// Check for modified and deleted files
	for filename := range originalFiles {
		if currentFiles[filename] {
			// File exists in both - check if content differs
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)

			currentContent, err := os.ReadFile(currentPath)
			if err != nil {
				continue
			}
			originalContent, err := os.ReadFile(originalPath)
			if err != nil {
				continue
			}

			if !bytes.Equal(currentContent, originalContent) {
				modified = append(modified, filename)
			}
		} else {
			// File only in original - deleted
			deleted = append(deleted, filename)
		}
	}

	// Check for added files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			added = append(added, filename)
		}
	}

	// Sort for consistent output
	sort.Strings(modified)
	sort.Strings(added)
	sort.Strings(deleted)

	// Output results
	if len(modified) == 0 && len(added) == 0 && len(deleted) == 0 {
		fmt.Println("No changes detected.")
		return nil
	}

	// Show deleted first (red)
	for _, f := range deleted {
		fmt.Printf("%s%s (deleted)%s\n", colorRed, f, colorReset)
	}

	// Show created (green)
	for _, f := range added {
		fmt.Printf("%s%s (created)%s\n", colorGreen, f, colorReset)
	}

	// Show modified (orange)
	for _, f := range modified {
		fmt.Printf("%s%s (modified)%s\n", colorOrange, f, colorReset)
	}

	return nil
}

func runFileDiff(tableName, originalDir, fileName string) error {
	currentPath := filepath.Join(tableName, fileName)
	originalPath := filepath.Join(originalDir, fileName)

	// Check if the current file exists
	currentExists := true
	if _, err := os.Stat(currentPath); os.IsNotExist(err) {
		currentExists = false
	}

	// Check if the original file exists
	originalExists := true
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		originalExists = false
	}

	if !currentExists && !originalExists {
		return fmt.Errorf("file '%s' not found in either location", fileName)
	}

	if !originalExists {
		fmt.Printf("File '%s' is new (no original to compare against)\n", fileName)
		return nil
	}

	if !currentExists {
		fmt.Printf("File '%s' was deleted (exists only in original)\n", fileName)
		return nil
	}

	// Find diff tool: prefer git, fall back to diff
	var diffCmd *exec.Cmd

	if _, err := exec.LookPath("git"); err == nil {
		// Use git diff --no-index (works outside git repos)
		// --no-pager prevents interactive pager (less) from being used
		diffCmd = exec.Command("git", "--no-pager", "diff", "--no-index", originalPath, currentPath)
	} else if _, err := exec.LookPath("diff"); err == nil {
		// Fall back to diff
		diffCmd = exec.Command("diff", originalPath, currentPath)
	} else {
		return fmt.Errorf("neither 'git' nor 'diff' found in PATH")
	}

	// Run the diff command and print output
	diffCmd.Stdout = os.Stdout
	diffCmd.Stderr = os.Stderr

	// Run the command - diff returns exit code 1 if files differ, which is not an error for us
	err := diffCmd.Run()
	if err != nil {
		// Exit code 1 from diff/git means files differ - that's expected
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 1 {
				return nil // Files differ, but that's not an error
			}
		}
		return fmt.Errorf("diff command failed: %w", err)
	}

	// If we get here with no output, files are identical
	fmt.Println("No differences found.")
	return nil
}

func runContentFieldDiff(cmd *cobra.Command, args []string) error {
	tableName := args[0]
	fileName, _ := cmd.Flags().GetString("file")
	showValues, _ := cmd.Flags().GetBool("show-values")

	// Check that the table folder exists
	if _, err := os.Stat(tableName); os.IsNotExist(err) {
		return fmt.Errorf("folder '%s' does not exist", tableName)
	}

	// Check that the original folder exists
	originalDir := filepath.Join(".scratchmd", tableName, "original")
	if _, err := os.Stat(originalDir); os.IsNotExist(err) {
		return fmt.Errorf("original folder '%s' does not exist. Run 'content download %s' first", originalDir, tableName)
	}

	// Load table config to get content field name
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil {
		return fmt.Errorf("failed to load table config: %w", err)
	}
	contentFieldName := ""
	if tableConfig != nil {
		contentFieldName = tableConfig.ContentField
	}

	// If --file flag is provided, show field diff for that specific file
	if fileName != "" {
		return runSingleFileFieldDiff(tableName, originalDir, fileName, contentFieldName, showValues)
	}

	// Otherwise, compare all files in the folder
	return runFolderFieldDiff(tableName, originalDir, contentFieldName)
}

func runSingleFileFieldDiff(tableName, originalDir, fileName, contentFieldName string, showValues bool) error {
	currentPath := filepath.Join(tableName, fileName)
	originalPath := filepath.Join(originalDir, fileName)

	// Check if files exist
	_, currentErr := os.Stat(currentPath)
	currentExists := currentErr == nil

	_, originalErr := os.Stat(originalPath)
	originalExists := originalErr == nil

	// Handle deleted case (in original but not in current)
	if !currentExists && originalExists {
		fmt.Printf("%s%s (deleted)%s\n", colorRed, fileName, colorReset)
		return nil
	}

	// Handle created case (in current but not in original)
	if currentExists && !originalExists {
		fmt.Printf("%s%s (created)%s\n", colorGreen, fileName, colorReset)
		return nil
	}

	// Handle case where file doesn't exist in either location
	if !currentExists && !originalExists {
		return fmt.Errorf("file '%s' not found in either location", fileName)
	}

	// Parse both files
	currentFields, err := parseMarkdownFile(currentPath, contentFieldName)
	if err != nil {
		return fmt.Errorf("failed to parse current file: %w", err)
	}

	originalFields, err := parseMarkdownFile(originalPath, contentFieldName)
	if err != nil {
		return fmt.Errorf("failed to parse original file: %w", err)
	}

	// Compare fields
	modifiedFields, addedFields, removedFields := getChangedFieldsDetailed(currentFields, originalFields)

	if len(modifiedFields) == 0 && len(addedFields) == 0 && len(removedFields) == 0 {
		fmt.Println("No field changes detected.")
		return nil
	}

	// Show filename header
	fmt.Printf("%s%s%s\n", colorOrange, fileName, colorReset)

	// Show each field with appropriate color
	for _, f := range removedFields {
		fmt.Printf("  %s%s (removed)%s\n", colorRed, f, colorReset)
		if showValues {
			printFieldValue(originalFields[f], colorRed)
		}
	}
	for _, f := range addedFields {
		fmt.Printf("  %s%s (added)%s\n", colorGreen, f, colorReset)
		if showValues {
			printFieldValue(currentFields[f], colorGreen)
		}
	}
	for _, f := range modifiedFields {
		fmt.Printf("  %s%s%s\n", colorOrange, f, colorReset)
		if showValues {
			printFieldValueChange(originalFields[f], currentFields[f])
		}
	}

	return nil
}

// printFieldValue prints a single value (for added/removed fields)
func printFieldValue(value, color string) {
	fmt.Printf("    %s%s%s\n", color, value, colorReset)
}

// printFieldValueChange prints old -> new values, inline if short enough, otherwise on separate lines
func printFieldValueChange(oldVal, newVal string) {
	combinedLen := len(oldVal) + len(newVal)
	if combinedLen < 50 {
		// Short enough: show inline
		fmt.Printf("    %s%s%s -> %s%s%s\n", colorRed, oldVal, colorReset, colorGreen, newVal, colorReset)
	} else {
		// Too long: show on separate lines
		fmt.Printf("    %s%s%s\n", colorRed, oldVal, colorReset)
		fmt.Printf("    %s%s%s\n", colorGreen, newVal, colorReset)
	}
}

func runFolderFieldDiff(tableName, originalDir, contentFieldName string) error {
	// Get list of .md files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	// Read current folder
	entries, err := os.ReadDir(tableName)
	if err != nil {
		return fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			currentFiles[entry.Name()] = true
		}
	}

	// Read original folder
	entries, err = os.ReadDir(originalDir)
	if err != nil {
		return fmt.Errorf("failed to read original folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			originalFiles[entry.Name()] = true
		}
	}

	var deleted, created []string
	modifiedWithFields := make(map[string][]string) // filename -> changed fields

	// Check for modified and deleted files
	for filename := range originalFiles {
		if currentFiles[filename] {
			// File exists in both - check field-level changes
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)

			currentFieldsMap, err := parseMarkdownFile(currentPath, contentFieldName)
			if err != nil {
				continue
			}
			originalFieldsMap, err := parseMarkdownFile(originalPath, contentFieldName)
			if err != nil {
				continue
			}

			changedFields := getChangedFields(currentFieldsMap, originalFieldsMap)
			if len(changedFields) > 0 {
				modifiedWithFields[filename] = changedFields
			}
		} else {
			// File only in original - deleted
			deleted = append(deleted, filename)
		}
	}

	// Check for created files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			created = append(created, filename)
		}
	}

	// Sort for consistent output
	sort.Strings(deleted)
	sort.Strings(created)

	// Get sorted list of modified files
	var modifiedFiles []string
	for filename := range modifiedWithFields {
		modifiedFiles = append(modifiedFiles, filename)
	}
	sort.Strings(modifiedFiles)

	// Output results
	if len(deleted) == 0 && len(created) == 0 && len(modifiedWithFields) == 0 {
		fmt.Println("No changes detected.")
		return nil
	}

	// Show deleted first (red)
	for _, f := range deleted {
		fmt.Printf("%s%s (deleted)%s\n", colorRed, f, colorReset)
	}

	// Show created (green)
	for _, f := range created {
		fmt.Printf("%s%s (created)%s\n", colorGreen, f, colorReset)
	}

	// Show modified with field list (orange filename, then fields)
	for _, f := range modifiedFiles {
		fields := modifiedWithFields[f]
		fmt.Printf("%s%s%s - %s\n", colorOrange, f, colorReset, strings.Join(fields, ", "))
	}

	return nil
}

// UploadChange represents a single change to upload
type UploadChange struct {
	Operation     string            // "delete", "create", "update"
	Filename      string            // The filename
	ChangedFields []string          // List of changed fields (for create/update)
	FieldValues   map[string]string // Field name -> new value (for create/update)
}

func runContentUpload(cmd *cobra.Command, args []string) error {
	noReview, _ := cmd.Flags().GetBool("no-review")
	syncDeletes, _ := cmd.Flags().GetBool("sync-deletes")

	// Parse the argument to determine scope
	var tableName, fileName string
	if len(args) > 0 {
		arg := args[0]
		// Check if it's a folder/file.md pattern
		if strings.Contains(arg, "/") && strings.HasSuffix(arg, ".md") {
			parts := strings.SplitN(arg, "/", 2)
			tableName = parts[0]
			fileName = parts[1]
		} else {
			tableName = arg
		}
	}

	// Get list of tables to process
	var tablesToProcess []string
	if tableName != "" {
		tablesToProcess = []string{tableName}
	} else {
		// Process all configured tables
		tables, err := config.ListConfiguredTables(".")
		if err != nil {
			return fmt.Errorf("failed to list tables: %w", err)
		}
		if len(tables) == 0 {
			fmt.Println("No tables configured.")
			return nil
		}
		tablesToProcess = tables
	}

	// Collect all changes across tables
	var allChanges []UploadChange

	for _, table := range tablesToProcess {
		// Check that the table folder exists
		if _, err := os.Stat(table); os.IsNotExist(err) {
			return fmt.Errorf("folder '%s' does not exist", table)
		}

		// Check that the original folder exists
		originalDir := filepath.Join(".scratchmd", table, "original")
		if _, err := os.Stat(originalDir); os.IsNotExist(err) {
			return fmt.Errorf("original folder '%s' does not exist. Run 'content download %s' first", originalDir, table)
		}

		// Load table config to get content field name
		tableConfig, err := config.LoadTableConfig(table)
		if err != nil {
			return fmt.Errorf("failed to load table config for '%s': %w", table, err)
		}
		contentFieldName := ""
		if tableConfig != nil {
			contentFieldName = tableConfig.ContentField
		}

		// Get changes for this table
		if fileName != "" {
			// Single file mode
			change, err := getSingleFileChange(table, originalDir, fileName, contentFieldName)
			if err != nil {
				return err
			}
			if change != nil {
				allChanges = append(allChanges, *change)
			}
		} else {
			// Folder mode
			changes, err := getFolderChanges(table, originalDir, contentFieldName, syncDeletes)
			if err != nil {
				return err
			}
			allChanges = append(allChanges, changes...)
		}
	}

	if len(allChanges) == 0 {
		fmt.Println("No changes to upload.")
		return nil
	}

	// Show preview unless --no-review
	if !noReview {
		fmt.Println("Changes to upload:")
		fmt.Println()
		for _, change := range allChanges {
			switch change.Operation {
			case "delete":
				fmt.Printf("%s%s -> %s (delete)%s\n", colorRed, change.Filename, change.Filename, colorReset)
			case "create":
				fmt.Printf("%s%s -> %s (create)%s\n", colorGreen, change.Filename, change.Filename, colorReset)
				for _, field := range change.ChangedFields {
					fmt.Printf("  %s\n", field)
				}
			case "update":
				fmt.Printf("%s%s -> %s (update)%s\n", colorOrange, change.Filename, change.Filename, colorReset)
				for _, field := range change.ChangedFields {
					fmt.Printf("  %s\n", field)
				}
			}
		}
		fmt.Println()

		// Ask for confirmation
		fmt.Print("Proceed with upload? [y/N] ")
		var response string
		fmt.Scanln(&response)
		if strings.ToLower(response) != "y" {
			fmt.Println("Upload cancelled.")
			return nil
		}
	}

	// Write operations to a text file (placeholder for actual upload)
	outputFile := "upload_operations.txt"
	var sb strings.Builder

	for _, change := range allChanges {
		switch change.Operation {
		case "delete":
			sb.WriteString(fmt.Sprintf("delete -> %s\n", change.Filename))
		case "create":
			sb.WriteString(fmt.Sprintf("create -> %s\n", change.Filename))
			for _, field := range change.ChangedFields {
				sb.WriteString(fmt.Sprintf("  %s\n", field))
			}
		case "update":
			sb.WriteString(fmt.Sprintf("update -> %s\n", change.Filename))
			for _, field := range change.ChangedFields {
				sb.WriteString(fmt.Sprintf("  %s\n", field))
			}
		}
	}

	if err := os.WriteFile(outputFile, []byte(sb.String()), 0644); err != nil {
		return fmt.Errorf("failed to write operations file: %w", err)
	}

	fmt.Printf("Operations written to %s\n", outputFile)
	return nil
}

// getSingleFileChange gets the change for a single file
func getSingleFileChange(tableName, originalDir, fileName, contentFieldName string) (*UploadChange, error) {
	currentPath := filepath.Join(tableName, fileName)
	originalPath := filepath.Join(originalDir, fileName)

	_, currentErr := os.Stat(currentPath)
	currentExists := currentErr == nil

	_, originalErr := os.Stat(originalPath)
	originalExists := originalErr == nil

	fullFileName := filepath.Join(tableName, fileName)

	// Deleted file
	if !currentExists && originalExists {
		return &UploadChange{
			Operation: "delete",
			Filename:  fullFileName,
		}, nil
	}

	// Created file
	if currentExists && !originalExists {
		currentFields, err := parseMarkdownFile(currentPath, contentFieldName)
		if err != nil {
			return nil, fmt.Errorf("failed to parse file: %w", err)
		}
		var fields []string
		for field := range currentFields {
			fields = append(fields, field)
		}
		sort.Strings(fields)
		return &UploadChange{
			Operation:     "create",
			Filename:      fullFileName,
			ChangedFields: fields,
			FieldValues:   currentFields,
		}, nil
	}

	// File doesn't exist in either
	if !currentExists && !originalExists {
		return nil, fmt.Errorf("file '%s' not found", fileName)
	}

	// Both exist - check for changes
	currentFields, err := parseMarkdownFile(currentPath, contentFieldName)
	if err != nil {
		return nil, fmt.Errorf("failed to parse current file: %w", err)
	}

	originalFields, err := parseMarkdownFile(originalPath, contentFieldName)
	if err != nil {
		return nil, fmt.Errorf("failed to parse original file: %w", err)
	}

	changedFields := getChangedFields(currentFields, originalFields)
	if len(changedFields) == 0 {
		return nil, nil // No changes
	}

	return &UploadChange{
		Operation:     "update",
		Filename:      fullFileName,
		ChangedFields: changedFields,
		FieldValues:   currentFields,
	}, nil
}

// getFolderChanges gets all changes for a folder
func getFolderChanges(tableName, originalDir, contentFieldName string, includeDeletes bool) ([]UploadChange, error) {
	var changes []UploadChange

	// Get list of .md files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	// Read current folder
	entries, err := os.ReadDir(tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			currentFiles[entry.Name()] = true
		}
	}

	// Read original folder
	entries, err = os.ReadDir(originalDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read original folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			originalFiles[entry.Name()] = true
		}
	}

	// Check for deleted files (only if includeDeletes is true)
	if includeDeletes {
		for filename := range originalFiles {
			if !currentFiles[filename] {
				changes = append(changes, UploadChange{
					Operation: "delete",
					Filename:  filepath.Join(tableName, filename),
				})
			}
		}
	}

	// Check for created files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			currentPath := filepath.Join(tableName, filename)
			currentFields, err := parseMarkdownFile(currentPath, contentFieldName)
			if err != nil {
				continue
			}
			var fields []string
			for field := range currentFields {
				fields = append(fields, field)
			}
			sort.Strings(fields)
			changes = append(changes, UploadChange{
				Operation:     "create",
				Filename:      filepath.Join(tableName, filename),
				ChangedFields: fields,
				FieldValues:   currentFields,
			})
		}
	}

	// Check for modified files
	for filename := range originalFiles {
		if currentFiles[filename] {
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)

			currentFields, err := parseMarkdownFile(currentPath, contentFieldName)
			if err != nil {
				continue
			}
			originalFields, err := parseMarkdownFile(originalPath, contentFieldName)
			if err != nil {
				continue
			}

			changedFields := getChangedFields(currentFields, originalFields)
			if len(changedFields) > 0 {
				changes = append(changes, UploadChange{
					Operation:     "update",
					Filename:      filepath.Join(tableName, filename),
					ChangedFields: changedFields,
					FieldValues:   currentFields,
				})
			}
		}
	}

	// Sort changes by filename for consistent output
	sort.Slice(changes, func(i, j int) bool {
		// Put deletes first, then creates, then updates
		if changes[i].Operation != changes[j].Operation {
			order := map[string]int{"delete": 0, "create": 1, "update": 2}
			return order[changes[i].Operation] < order[changes[j].Operation]
		}
		return changes[i].Filename < changes[j].Filename
	})

	return changes, nil
}

// getChangedFields compares two field maps and returns list of changed field names (for folder view)
func getChangedFields(current, original map[string]string) []string {
	var changed []string

	// Check for modified and deleted fields
	for field, originalValue := range original {
		if currentValue, exists := current[field]; exists {
			if currentValue != originalValue {
				changed = append(changed, field)
			}
		} else {
			changed = append(changed, field+" (removed)")
		}
	}

	// Check for added fields
	for field := range current {
		if _, exists := original[field]; !exists {
			changed = append(changed, field+" (added)")
		}
	}

	sort.Strings(changed)
	return changed
}

// getChangedFieldsDetailed compares two field maps and returns separate lists for modified, added, and removed fields
func getChangedFieldsDetailed(current, original map[string]string) (modified, added, removed []string) {
	// Check for modified and removed fields
	for field, originalValue := range original {
		if currentValue, exists := current[field]; exists {
			if currentValue != originalValue {
				modified = append(modified, field)
			}
		} else {
			removed = append(removed, field)
		}
	}

	// Check for added fields
	for field := range current {
		if _, exists := original[field]; !exists {
			added = append(added, field)
		}
	}

	sort.Strings(modified)
	sort.Strings(added)
	sort.Strings(removed)
	return modified, added, removed
}

// parseMarkdownFile parses a markdown file with YAML frontmatter and returns field values.
// If contentFieldName is provided, the markdown body is stored under that field name with "(content)" suffix.
// Otherwise it's stored as "_content".
func parseMarkdownFile(filePath string, contentFieldName string) (map[string]string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	fields := make(map[string]string)
	contentStr := string(content)

	// Determine the key to use for markdown content
	contentKey := "_content"
	if contentFieldName != "" {
		contentKey = contentFieldName + " (content)"
	}

	// Check for YAML frontmatter (starts with ---)
	if !strings.HasPrefix(contentStr, "---") {
		// No frontmatter, just content
		fields[contentKey] = strings.TrimSpace(contentStr)
		return fields, nil
	}

	// Find the end of frontmatter
	rest := contentStr[3:] // Skip initial ---
	endIndex := strings.Index(rest, "\n---")
	if endIndex == -1 {
		// Malformed frontmatter
		fields[contentKey] = strings.TrimSpace(contentStr)
		return fields, nil
	}

	yamlContent := rest[:endIndex]
	markdownContent := strings.TrimPrefix(rest[endIndex+4:], "\n")

	// Parse YAML into map
	var yamlData map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &yamlData); err != nil {
		return nil, fmt.Errorf("failed to parse YAML frontmatter: %w", err)
	}

	// Convert all values to strings for comparison
	for key, value := range yamlData {
		fields[key] = fmt.Sprintf("%v", value)
	}

	// Add markdown content under the appropriate key
	fields[contentKey] = strings.TrimSpace(markdownContent)

	return fields, nil
}
