package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// Pre-compiled regexes for folder name validation (cross-platform compatibility)
var (
	// Windows reserved device names
	windowsReservedNames = regexp.MustCompile(`(?i)^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$`)
	// Invalid characters for cross-platform file names
	invalidFileNameChars = regexp.MustCompile(`[<>:"|?*\x00-\x1f]`)
)

// outputJSONError outputs an error message in JSON format and exits with code 1.
// Used by commands that support --json output mode.
func outputJSONError(errMsg string) {
	output := map[string]interface{}{
		"error": errMsg,
	}
	data, _ := json.MarshalIndent(output, "", "  ")
	fmt.Println(string(data))
	os.Exit(1)
}

// createOutputErrorFunc creates a helper function for consistent error output.
// In JSON mode, it outputs JSON and exits. Otherwise, it returns an error.
func createOutputErrorFunc(jsonOutput bool) func(string) error {
	return func(errMsg string) error {
		if jsonOutput {
			outputJSONError(errMsg)
		}
		return fmt.Errorf("%s", errMsg)
	}
}

// getAuthenticatedFolderClient creates an authenticated API client for folder operations.
// Returns the client and server URL, or an error if authentication fails.
func getAuthenticatedFolderClient(serverURLOverride string, outputError func(string) error) (*api.Client, string, error) {
	serverURL := serverURLOverride

	// Use default or config server URL
	if serverURL == "" {
		cfg, err := config.LoadConfig()
		if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
			serverURL = cfg.Settings.ScratchServerURL
		} else {
			serverURL = api.DefaultScratchServerURL
		}
	}

	// Check if logged in
	if !config.IsLoggedIn(serverURL) {
		return nil, "", outputError("Not logged in. Run 'scratchmd auth login' first.")
	}

	// Load credentials
	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return nil, "", outputError(fmt.Sprintf("Failed to load credentials: %s", err.Error()))
	}

	// Create API client with authentication
	client := api.NewClient(
		api.WithBaseURL(serverURL),
		api.WithAPIToken(creds.APIToken),
	)

	return client, serverURL, nil
}

// folderDownloadResult holds the result of downloading folder files.
type folderDownloadResult struct {
	TotalSaved   int
	TotalSkipped int
	TotalDeleted int
}

// downloadFolderFiles downloads files from a server response to local directories.
// If preserveLocalChanges is true, locally modified files are preserved.
// If preserveLocalChanges is false (reset mode), all files are overwritten.
func downloadFolderFiles(
	resp *api.DownloadFolderResponse,
	contentDir, originalDir string,
	preserveLocalChanges bool,
	jsonOutput bool,
) folderDownloadResult {
	result := folderDownloadResult{}

	for _, file := range resp.Files {
		// Sanitize file name to prevent path traversal attacks
		fileName := filepath.Base(file.Name)
		if fileName == "." || fileName == ".." || fileName == "" {
			if !jsonOutput {
				fmt.Printf("   Skipping invalid file name: '%s'\n", file.Name)
			}
			continue
		}

		mainPath := filepath.Join(contentDir, fileName)
		originalPath := filepath.Join(originalDir, fileName)

		// Skip deleted files
		if file.Deleted {
			result.TotalDeleted++
			continue
		}

		// Get content to write (prefer content, fall back to original)
		var fileContent []byte
		if file.Content != "" {
			fileContent = []byte(file.Content)
		} else if file.Original != "" {
			fileContent = []byte(file.Original)
		} else {
			// Skip files with no content
			continue
		}

		// Check if main file should be updated
		shouldUpdateMain := true
		if preserveLocalChanges {
			oldOriginal, errOldOrig := os.ReadFile(originalPath)
			currentMain, errMain := os.ReadFile(mainPath)

			if errOldOrig == nil && errMain == nil {
				// Both files exist - only update main if it matches old original
				if !bytes.Equal(currentMain, oldOriginal) {
					shouldUpdateMain = false
					result.TotalSkipped++
					if !jsonOutput {
						fmt.Printf("   Skipping '%s' (locally modified)\n", fileName)
					}
				}
			}
		}

		// Always update the original file
		if err := os.WriteFile(originalPath, fileContent, 0644); err != nil {
			if !jsonOutput {
				fmt.Printf("   Warning: Failed to save original '%s': %v\n", originalPath, err)
			}
			continue
		}

		// Update main file only if appropriate
		if shouldUpdateMain {
			if err := os.WriteFile(mainPath, fileContent, 0644); err != nil {
				if !jsonOutput {
					fmt.Printf("   Warning: Failed to save '%s': %v\n", mainPath, err)
				}
				continue
			}
		}

		result.TotalSaved++
	}

	return result
}

// sanitizeFolderName validates and sanitizes a folder name to prevent path traversal attacks.
// Returns an error if the folder name is invalid or potentially malicious.
func sanitizeFolderName(name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("folder name cannot be empty")
	}

	// Clean the path to normalize it
	cleaned := filepath.Clean(name)

	// Check for path traversal attempts
	if strings.Contains(cleaned, "..") {
		return "", fmt.Errorf("folder name cannot contain path traversal sequences (..)")
	}

	// Check for absolute paths
	if filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("folder name cannot be an absolute path")
	}

	// Check for path separators (folder name should be a single directory name)
	if strings.ContainsAny(cleaned, `/\`) {
		return "", fmt.Errorf("folder name cannot contain path separators")
	}

	// Check for reserved names on Windows
	if windowsReservedNames.MatchString(cleaned) {
		return "", fmt.Errorf("folder name '%s' is a reserved name on Windows", cleaned)
	}

	// Check for invalid characters (Windows restrictions apply for cross-platform compatibility)
	if invalidFileNameChars.MatchString(cleaned) {
		return "", fmt.Errorf("folder name contains invalid characters")
	}

	return cleaned, nil
}

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

// folderRemoveCmd represents the folder remove command
var folderRemoveCmd = &cobra.Command{
	Use:   "remove <folder-name>",
	Short: "[NON-INTERACTIVE] Remove a linked folder",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Remove a local folder and its associated .scratchmd metadata.

This deletes:
  - The content folder (folder-name/)
  - The metadata folder (.scratchmd/folder-name/)

By default, shows what will be deleted and asks for confirmation.
Use --no-review to skip the confirmation prompt.

Examples:
  scratchmd folder remove blog-posts
  scratchmd folder remove blog-posts --no-review`,
	Args: cobra.ExactArgs(1),
	RunE: runFolderRemove,
}

// folderListCmd represents the folder list command (for workbook data folders)
var folderListCmd = &cobra.Command{
	Use:   "list <workbook-id>",
	Short: "[NON-INTERACTIVE] List data folders in a workbook",
	Long: `[NON-INTERACTIVE - safe for LLM use]

List all data folders within a specified workbook.

Requires authentication. Run 'scratchmd auth login' first.

Examples:
  scratchmd folder list wkb_abc123
  scratchmd folder list wkb_abc123 --json`,
	Args: cobra.ExactArgs(1),
	RunE: runFolderList,
}

// folderDownloadCmd represents the folder download command
var folderDownloadCmd = &cobra.Command{
	Use:   "download <folder-id>",
	Short: "[NON-INTERACTIVE] Download a data folder and all its files",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Download a workbook data folder and all its files to the local filesystem.

Creates the following structure:
  <folder-name>/              # User-editable content (JSON files)
  .scratchmd/<folder-name>/   # Metadata and pristine copies
    scratchmd.folder.yaml     # Folder config (commit this)
    original/                 # Pristine copies (gitignore recommended)

Change detection:
  - Files are only overwritten if unchanged locally (matches original)
  - Locally modified files are preserved
  - Use --clobber to force overwrite all files

Requires authentication. Run 'scratchmd auth login' first.

Examples:
  scratchmd folder download dfd_abc123
  scratchmd folder download dfd_abc123 --json
  scratchmd folder download dfd_abc123 --clobber`,
	Args: cobra.ExactArgs(1),
	RunE: runFolderDownload,
}

// folderResetCmd represents the folder reset command
var folderResetCmd = &cobra.Command{
	Use:   "reset <folder-id>",
	Short: "[NON-INTERACTIVE] (DESTRUCTIVE) Reset folder to server state, discarding ALL local changes",
	Long: `[NON-INTERACTIVE - safe for LLM use]

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!! WARNING: DESTRUCTIVE OPERATION                                            !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

This command PERMANENTLY DESTROYS all local changes and resets the folder to
match the server state exactly.

WHAT WILL BE DELETED:
  - ALL files in the content folder (<folder-name>/)
  - ALL files in the original folder (.scratchmd/<folder-name>/original/)
  - Any local modifications, additions, or work-in-progress

WHAT WILL BE PRESERVED:
  - The folder configuration file (scratchmd.folder.yaml)

This is equivalent to deleting the folder and re-downloading it fresh.
Use this when you want to abandon all local changes and start over.

THIS ACTION CANNOT BE UNDONE. Your local changes will be permanently lost.

For a safer download that preserves local modifications, use:
  scratchmd folder download <folder-id>

Requires authentication. Run 'scratchmd auth login' first.

Examples:
  scratchmd folder reset dfd_abc123
  scratchmd folder reset dfd_abc123 --json
  scratchmd folder reset dfd_abc123 --yes    # Skip confirmation prompt`,
	Args: cobra.ExactArgs(1),
	RunE: runFolderReset,
}

func init() {
	rootCmd.AddCommand(folderCmd)
	folderCmd.AddCommand(folderLinkCmd)
	folderCmd.AddCommand(folderRemoveCmd)
	folderCmd.AddCommand(folderListCmd)
	folderCmd.AddCommand(folderDownloadCmd)
	folderCmd.AddCommand(folderResetCmd)

	folderLinkCmd.Flags().String("account.name", "", "Account name to link (required)")
	folderLinkCmd.Flags().String("table-id", "", "Table ID to link (required)")
	folderLinkCmd.MarkFlagRequired("account.name")
	folderLinkCmd.MarkFlagRequired("table-id")

	folderRemoveCmd.Flags().Bool("no-review", false, "Skip confirmation prompt")

	// Flags for folder list
	folderListCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	folderListCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")

	// Flags for folder download
	folderDownloadCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	folderDownloadCmd.Flags().Bool("clobber", false, "Delete ALL local files and re-download fresh")
	folderDownloadCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")

	// Flags for folder reset (DESTRUCTIVE)
	folderResetCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	folderResetCmd.Flags().Bool("yes", false, "Skip confirmation prompt (DANGEROUS: use with caution)")
	folderResetCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")
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
	var targetTable *api.TableInfo
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

	// Sanitize folder name to prevent path traversal and ensure cross-platform compatibility
	folderName, err = sanitizeFolderName(folderName)
	if err != nil {
		return fmt.Errorf("invalid folder name '%s': %w", folderName, err)
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
	idField := targetTable.IdField
	if idField == "" {
		idField = "id" // default
	}
	tableConfig := &config.TableConfig{
		AccountID:     account.ID,
		Provider:      account.Provider,
		TableID:       targetTable.ID,
		SiteID:        targetTable.SiteID,
		TableName:     targetTable.Name,
		SiteName:      targetTable.SiteName,
		FilenameField: "slug", // default
		ContentField:  "",     // user can set later if needed
		IdField:       idField,
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

	// Create schema from JSON schema properties
	schema := jsonSchemaToTableSchema(targetTable.Schema)

	if err := config.SaveTableSchema(folderName, schema); err != nil {
		return fmt.Errorf("failed to save table schema: %w", err)
	}

	fmt.Printf("Linked table '%s' to folder '%s'.\n", targetTable.Name, folderName)
	fmt.Printf("Created .scratchmd/%s/ for tracking changes.\n", folderName)
	fmt.Printf("Run 'scratchmd content download %s' to download records.\n", folderName)
	return nil
}

func runFolderRemove(cmd *cobra.Command, args []string) error {
	rawFolderName := args[0]
	noReview, _ := cmd.Flags().GetBool("no-review")

	// Sanitize folder name to prevent path traversal attacks
	folderName, err := sanitizeFolderName(rawFolderName)
	if err != nil {
		return fmt.Errorf("invalid folder name: %w", err)
	}

	contentDir := folderName
	metadataDir := filepath.Join(".scratchmd", folderName)

	// Check if either directory exists
	contentExists := false
	metadataExists := false

	if info, err := os.Stat(contentDir); err == nil && info.IsDir() {
		contentExists = true
	}
	if info, err := os.Stat(metadataDir); err == nil && info.IsDir() {
		metadataExists = true
	}

	if !contentExists && !metadataExists {
		return fmt.Errorf("folder '%s' not found (checked %s/ and %s/)", folderName, contentDir, metadataDir)
	}

	// Show what will be deleted
	if !noReview {
		fmt.Println("The following will be deleted:")
		if contentExists {
			fmt.Printf("  - %s/ (content folder)\n", contentDir)
		}
		if metadataExists {
			fmt.Printf("  - %s/ (metadata folder)\n", metadataDir)
		}
		fmt.Println()

		fmt.Print("Proceed with removal? [y/N] ")
		var response string
		fmt.Scanln(&response)
		if strings.ToLower(response) != "y" {
			fmt.Println("Removal cancelled.")
			return nil
		}
	}

	// Delete content folder
	if contentExists {
		if err := os.RemoveAll(contentDir); err != nil {
			return fmt.Errorf("failed to remove content folder: %w", err)
		}
		fmt.Printf("Removed %s/\n", contentDir)
	}

	// Delete metadata folder
	if metadataExists {
		if err := os.RemoveAll(metadataDir); err != nil {
			return fmt.Errorf("failed to remove metadata folder: %w", err)
		}
		fmt.Printf("Removed %s/\n", metadataDir)
	}

	fmt.Printf("Folder '%s' removed successfully.\n", folderName)
	return nil
}

func runFolderList(cmd *cobra.Command, args []string) error {
	workbookId := args[0]
	jsonOutput, _ := cmd.Flags().GetBool("json")
	serverURL, _ := cmd.Flags().GetString("server")

	outputError := createOutputErrorFunc(jsonOutput)

	// Get authenticated client
	client, _, err := getAuthenticatedFolderClient(serverURL, outputError)
	if err != nil {
		return err
	}

	// Fetch data folders
	folders, err := client.ListDataFolders(workbookId)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to list folders: %s", err.Error()))
	}

	// Output results
	if jsonOutput {
		data, err := json.MarshalIndent(folders, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal response: %w", err)
		}
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	if len(folders) == 0 {
		fmt.Println()
		fmt.Printf("No data folders found in workbook %s.\n", workbookId)
		fmt.Println()
		return nil
	}

	fmt.Println()
	fmt.Printf("Data Folders (%d total)\n", len(folders))
	fmt.Println()

	for _, f := range folders {
		connector := "Scratch"
		if f.ConnectorService != "" {
			connector = f.ConnectorService
			if f.ConnectorDisplayName != "" {
				connector = f.ConnectorDisplayName
			}
		}
		fmt.Printf("  %s  %-20s  (%s)\n", f.ID, f.Name, connector)
	}

	fmt.Println()

	return nil
}

func runFolderDownload(cmd *cobra.Command, args []string) error {
	folderId := args[0]
	jsonOutput, _ := cmd.Flags().GetBool("json")
	clobber, _ := cmd.Flags().GetBool("clobber")
	serverURL, _ := cmd.Flags().GetString("server")

	outputError := createOutputErrorFunc(jsonOutput)

	// Get authenticated client
	client, _, err := getAuthenticatedFolderClient(serverURL, outputError)
	if err != nil {
		return err
	}

	// Fetch folder and files from server
	resp, err := client.DownloadFolder(folderId)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to download folder: %s", err.Error()))
	}

	if resp.Error != "" {
		return outputError(fmt.Sprintf("Server error: %s", resp.Error))
	}

	if resp.Folder == nil {
		return outputError("No folder data returned from server")
	}

	// Determine local folder name and sanitize it to prevent path traversal
	rawFolderName := resp.Folder.Name
	folderName, err := sanitizeFolderName(rawFolderName)
	if err != nil {
		return outputError(fmt.Sprintf("Invalid folder name from server '%s': %s", rawFolderName, err.Error()))
	}

	// Create directory structure
	contentDir := folderName
	metadataDir := config.GetFolderMetadataDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)

	// If clobber, remove existing files first
	if clobber {
		if !jsonOutput {
			fmt.Printf("Clobbering existing files for '%s'...\n", folderName)
		}
		// Remove JSON files from content directory
		if entries, err := os.ReadDir(contentDir); err == nil {
			for _, entry := range entries {
				if strings.HasSuffix(entry.Name(), ".json") {
					os.Remove(filepath.Join(contentDir, entry.Name()))
				}
			}
		}
		// Remove original directory entirely
		os.RemoveAll(originalDir)
	}

	// Create directories
	if err := os.MkdirAll(contentDir, 0755); err != nil {
		return outputError(fmt.Sprintf("Failed to create content directory: %s", err.Error()))
	}
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return outputError(fmt.Sprintf("Failed to create original directory: %s", err.Error()))
	}

	// Save folder config
	folderConfig := &config.FolderConfig{
		FolderID:             resp.Folder.ID,
		WorkbookID:           resp.Folder.WorkbookID,
		FolderName:           resp.Folder.Name,
		ConnectorService:     resp.Folder.ConnectorService,
		ConnectorDisplayName: resp.Folder.ConnectorDisplayName,
		TableID:              resp.Folder.TableID,
		Path:                 resp.Folder.Path,
		Schema:               resp.Folder.Schema,
		LastDownload:         time.Now().Format(time.RFC3339),
		LastSyncTime:         resp.Folder.LastSyncTime,
	}
	if err := config.SaveFolderConfig(folderName, folderConfig); err != nil {
		return outputError(fmt.Sprintf("Failed to save folder config: %s", err.Error()))
	}

	// Process files - preserve local changes unless clobber is set
	preserveLocalChanges := !clobber
	result := downloadFolderFiles(resp, contentDir, originalDir, preserveLocalChanges, jsonOutput)

	// Output results
	if jsonOutput {
		output := map[string]interface{}{
			"success":      true,
			"folderId":     resp.Folder.ID,
			"folderName":   resp.Folder.Name,
			"workbookId":   resp.Folder.WorkbookID,
			"totalFiles":   resp.TotalCount,
			"totalSaved":   result.TotalSaved,
			"totalSkipped": result.TotalSkipped,
			"contentDir":   contentDir,
			"metadataDir":  metadataDir,
		}
		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	fmt.Println()
	if result.TotalSkipped > 0 {
		fmt.Printf("Downloaded %d file(s) to '%s/' (%d locally modified files preserved)\n", result.TotalSaved, folderName, result.TotalSkipped)
	} else {
		fmt.Printf("Downloaded %d file(s) to '%s/'\n", result.TotalSaved, folderName)
	}
	fmt.Printf("Folder config saved to '%s/%s'\n", metadataDir, config.FolderConfigFileName)
	fmt.Println()

	return nil
}

func runFolderReset(cmd *cobra.Command, args []string) error {
	folderId := args[0]
	jsonOutput, _ := cmd.Flags().GetBool("json")
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	serverURL, _ := cmd.Flags().GetString("server")

	outputError := createOutputErrorFunc(jsonOutput)

	// Get authenticated client
	client, _, err := getAuthenticatedFolderClient(serverURL, outputError)
	if err != nil {
		return err
	}

	// Fetch folder and files from server
	resp, err := client.DownloadFolder(folderId)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to download folder: %s", err.Error()))
	}

	if resp.Error != "" {
		return outputError(fmt.Sprintf("Server error: %s", resp.Error))
	}

	if resp.Folder == nil {
		return outputError("No folder data returned from server")
	}

	// Determine local folder name and sanitize it to prevent path traversal
	rawFolderName := resp.Folder.Name
	folderName, err := sanitizeFolderName(rawFolderName)
	if err != nil {
		return outputError(fmt.Sprintf("Invalid folder name from server '%s': %s", rawFolderName, err.Error()))
	}

	// Create directory structure paths
	contentDir := folderName
	metadataDir := config.GetFolderMetadataDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)

	// Show warning and get confirmation (unless --yes flag or --json mode)
	if !skipConfirm && !jsonOutput {
		fmt.Println()
		fmt.Println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
		fmt.Println("!! WARNING: DESTRUCTIVE OPERATION                                             !!")
		fmt.Println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
		fmt.Println()
		fmt.Printf("This will PERMANENTLY DELETE all local changes in '%s/'.\n", folderName)
		fmt.Println()
		fmt.Println("The following will be destroyed:")
		fmt.Printf("  - All files in %s/\n", contentDir)
		fmt.Printf("  - All files in %s/\n", originalDir)
		fmt.Println()
		fmt.Println("This action CANNOT BE UNDONE.")
		fmt.Println()
		fmt.Print("Type 'yes' to confirm destruction of local changes: ")

		var response string
		fmt.Scanln(&response)
		if response != "yes" {
			fmt.Println()
			fmt.Println("Reset cancelled. Your local changes are safe.")
			return nil
		}
		fmt.Println()
	}

	// DESTRUCTIVE: Remove all files from content directory
	if !jsonOutput {
		fmt.Printf("Destroying local changes in '%s/'...\n", folderName)
	}

	// Remove all files from content directory (but keep the directory)
	if entries, err := os.ReadDir(contentDir); err == nil {
		for _, entry := range entries {
			entryPath := filepath.Join(contentDir, entry.Name())
			if err := os.RemoveAll(entryPath); err != nil {
				if !jsonOutput {
					fmt.Printf("   Warning: Failed to remove '%s': %v\n", entryPath, err)
				}
			}
		}
	}

	// Remove original directory entirely and recreate it
	os.RemoveAll(originalDir)

	// Create directories (in case they don't exist)
	if err := os.MkdirAll(contentDir, 0755); err != nil {
		return outputError(fmt.Sprintf("Failed to create content directory: %s", err.Error()))
	}
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return outputError(fmt.Sprintf("Failed to create original directory: %s", err.Error()))
	}

	// Save folder config
	folderConfig := &config.FolderConfig{
		FolderID:             resp.Folder.ID,
		WorkbookID:           resp.Folder.WorkbookID,
		FolderName:           resp.Folder.Name,
		ConnectorService:     resp.Folder.ConnectorService,
		ConnectorDisplayName: resp.Folder.ConnectorDisplayName,
		TableID:              resp.Folder.TableID,
		Path:                 resp.Folder.Path,
		Schema:               resp.Folder.Schema,
		LastDownload:         time.Now().Format(time.RFC3339),
		LastSyncTime:         resp.Folder.LastSyncTime,
	}
	if err := config.SaveFolderConfig(folderName, folderConfig); err != nil {
		return outputError(fmt.Sprintf("Failed to save folder config: %s", err.Error()))
	}

	// Download all files fresh (no skip logic - this is a reset, preserveLocalChanges=false)
	result := downloadFolderFiles(resp, contentDir, originalDir, false, jsonOutput)

	// Output results
	if jsonOutput {
		output := map[string]interface{}{
			"success":      true,
			"operation":    "reset",
			"destructive":  true,
			"folderId":     resp.Folder.ID,
			"folderName":   resp.Folder.Name,
			"workbookId":   resp.Folder.WorkbookID,
			"totalFiles":   resp.TotalCount,
			"totalSaved":   result.TotalSaved,
			"totalDeleted": result.TotalDeleted,
			"contentDir":   contentDir,
			"metadataDir":  metadataDir,
			"message":      "All local changes have been destroyed. Folder reset to server state.",
		}
		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	fmt.Println()
	fmt.Println("Reset complete. All local changes have been destroyed.")
	fmt.Printf("Downloaded %d file(s) fresh from server to '%s/'\n", result.TotalSaved, folderName)
	if result.TotalDeleted > 0 {
		fmt.Printf("Skipped %d deleted file(s) from server\n", result.TotalDeleted)
	}
	fmt.Printf("Folder config saved to '%s/%s'\n", metadataDir, config.FolderConfigFileName)
	fmt.Println()

	return nil
}
