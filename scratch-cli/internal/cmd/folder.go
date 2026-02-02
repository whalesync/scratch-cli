package cmd

import (
	"crypto/sha256"
	"encoding/hex"
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
	"github.com/whalesync/scratch-cli/internal/merge"
	"golang.org/x/text/unicode/norm"
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

// computeSHA256 computes the SHA256 hash of content and returns it as a hex string.
func computeSHA256(content []byte) string {
	hash := sha256.Sum256(content)
	return hex.EncodeToString(hash[:])
}

// normalizeFileName normalizes a filename to NFC (Composed) Unicode form.
// This ensures consistent filename handling across operating systems:
// - macOS uses NFD (Decomposed) form for filenames
// - Windows and Linux use NFC (Composed) form
// By normalizing to NFC, we ensure files created on macOS can be synced
// correctly with Windows/Linux systems.
func normalizeFileName(name string) string {
	return norm.NFC.String(name)
}

// syncResult holds the result of a sync operation.
type syncResult struct {
	FilesWritten      int
	FilesDeleted      int
	ConflictsResolved int
}

// readLocalFolderState reads all JSON files from a folder and computes their hashes.
// Returns the local files ready for sync, or an empty slice if the folder doesn't exist.
// Also detects files deleted locally (exist in original but not in content).
func readLocalFolderState(folderName string) ([]api.LocalFile, error) {
	contentDir := config.GetFolderContentDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)

	var files []api.LocalFile

	// Track files we've seen in content dir
	contentFiles := make(map[string]bool)
	contentDirExists := true

	// Read all JSON files in content directory
	entries, err := os.ReadDir(contentDir)
	if err != nil {
		if os.IsNotExist(err) {
			contentDirExists = false
			// Don't return early - check original dir for deleted files
		} else {
			return nil, err
		}
	}

	if contentDirExists {
		for _, entry := range entries {
			// Skip directories
			if entry.IsDir() {
				continue
			}

			// Skip non-JSON files
			if !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}

			// Skip symlinks to prevent potential issues (infinite loops, sandbox escape)
			// Use entry.Type() instead of entry.Info().Mode() because Info() follows symlinks
			// This is cross-platform safe - on Windows, symlinks/junctions are also detected
			if entry.Type()&os.ModeSymlink != 0 {
				continue
			}

			// Normalize filename to NFC for cross-platform consistency
			// (macOS uses NFD, Windows/Linux use NFC)
			fileName := normalizeFileName(entry.Name())
			contentFiles[fileName] = true

			// Read current content
			content, err := os.ReadFile(filepath.Join(contentDir, entry.Name()))
			if err != nil {
				continue
			}

			// Read original for hash and content (for three-way merge)
			originalHash := ""
			originalContent := ""
			if original, err := os.ReadFile(filepath.Join(originalDir, entry.Name())); err == nil {
				originalHash = computeSHA256(original)
				originalContent = string(original)
			}

			files = append(files, api.LocalFile{
				Name:            fileName,
				Content:         string(content),
				OriginalHash:    originalHash,
				OriginalContent: originalContent,
			})
		}
	}

	// Check for files in original that aren't in content (deleted locally)
	if origEntries, err := os.ReadDir(originalDir); err == nil {
		for _, entry := range origEntries {
			// Skip directories
			if entry.IsDir() {
				continue
			}

			// Skip non-JSON files
			if !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}

			// Skip symlinks - use entry.Type() instead of Info().Mode() because Info() follows symlinks
			if entry.Type()&os.ModeSymlink != 0 {
				continue
			}

			// Normalize filename for consistent cross-platform matching
			fileName := normalizeFileName(entry.Name())

			// Check if file exists in content
			if !contentFiles[fileName] {
				// File was deleted locally
				original, err := os.ReadFile(filepath.Join(originalDir, entry.Name()))
				if err != nil {
					continue
				}
				files = append(files, api.LocalFile{
					Name:         fileName,
					Content:      "",
					OriginalHash: computeSHA256(original),
					Deleted:      true,
				})
			}
		}
	}

	// If neither content nor original have any files, return nil (first download scenario)
	if len(files) == 0 && !contentDirExists {
		return nil, nil
	}

	return files, nil
}

// applySyncResult writes the merged files from a sync response to disk.
// Both content and original directories are updated to match (local = original = server).
func applySyncResult(folderName string, resp *api.SyncFolderResponse) (*syncResult, error) {
	contentDir := config.GetFolderContentDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)

	// Ensure directories exist
	if err := os.MkdirAll(contentDir, 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return nil, err
	}

	result := &syncResult{}

	// Write all files from response
	for _, file := range resp.Files {
		contentPath := filepath.Join(contentDir, file.Name)
		originalPath := filepath.Join(originalDir, file.Name)

		// Write to both content and original (they should match after sync)
		if err := os.WriteFile(contentPath, []byte(file.Content), 0644); err != nil {
			return nil, fmt.Errorf("failed to write %s: %w", file.Name, err)
		}
		if err := os.WriteFile(originalPath, []byte(file.Content), 0644); err != nil {
			return nil, fmt.Errorf("failed to write original %s: %w", file.Name, err)
		}
		result.FilesWritten++
	}

	// Remove files that were deleted
	for _, deleted := range resp.DeletedFiles {
		os.Remove(filepath.Join(contentDir, deleted.Name))
		os.Remove(filepath.Join(originalDir, deleted.Name))
		result.FilesDeleted++
	}

	result.ConflictsResolved = len(resp.Conflicts)

	return result, nil
}

// logSyncInfo outputs information about conflicts and deletions from a sync.
func logSyncInfo(resp *api.SyncFolderResponse, jsonOutput bool) {
	if jsonOutput {
		return
	}

	// Log conflicts
	if len(resp.Conflicts) > 0 {
		fmt.Printf("  Auto-resolved %d conflict(s) (local changes kept):\n", len(resp.Conflicts))
		for _, c := range resp.Conflicts {
			if c.Field != "" {
				fmt.Printf("    - %s: field '%s'\n", c.File, c.Field)
			} else {
				fmt.Printf("    - %s\n", c.File)
			}
		}
	}

	// Log deletions with warnings
	for _, d := range resp.DeletedFiles {
		if d.DeletedBy == "server" && d.HadLocalChanges {
			fmt.Printf("  Warning: '%s' was deleted on server (your local changes were discarded)\n", d.Name)
		}
	}
}

// applyMergeResult writes the merged files from a local merge result to disk.
// Both content and original directories are updated to match.
func applyMergeResult(folderName string, mergeResult *merge.FolderMergeResult) (*syncResult, error) {
	contentDir := config.GetFolderContentDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)

	// Ensure directories exist
	if err := os.MkdirAll(contentDir, 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return nil, err
	}

	result := &syncResult{}

	// Write all files from merge result
	for _, file := range mergeResult.Files {
		contentPath := filepath.Join(contentDir, file.Name)
		originalPath := filepath.Join(originalDir, file.Name)

		// Content is already properly formatted from the merge logic
		content := file.Content

		// Write to both content and original (they should match after sync)
		if err := os.WriteFile(contentPath, []byte(content), 0644); err != nil {
			return nil, fmt.Errorf("failed to write %s: %w", file.Name, err)
		}
		if err := os.WriteFile(originalPath, []byte(content), 0644); err != nil {
			return nil, fmt.Errorf("failed to write original %s: %w", file.Name, err)
		}
		result.FilesWritten++
	}

	// Remove files that were deleted
	for _, deleted := range mergeResult.DeletedFiles {
		os.Remove(filepath.Join(contentDir, deleted.Name))
		os.Remove(filepath.Join(originalDir, deleted.Name))
		result.FilesDeleted++
	}

	result.ConflictsResolved = len(mergeResult.Conflicts)

	return result, nil
}

// logMergeInfo outputs information about conflicts and deletions from a local merge.
func logMergeInfo(mergeResult *merge.FolderMergeResult, jsonOutput bool) {
	if jsonOutput {
		return
	}

	// Log conflicts
	if len(mergeResult.Conflicts) > 0 {
		fmt.Printf("  Auto-resolved %d conflict(s) (local changes kept):\n", len(mergeResult.Conflicts))
		for _, c := range mergeResult.Conflicts {
			if c.Field != "" {
				fmt.Printf("    - %s: field '%s'\n", c.File, c.Field)
			} else {
				fmt.Printf("    - %s\n", c.File)
			}
		}
	}

	// Log deletions with warnings
	for _, d := range mergeResult.DeletedFiles {
		if d.DeletedBy == "server" && d.HadLocalChanges {
			fmt.Printf("  Warning: '%s' was deleted on server (your local changes were discarded)\n", d.Name)
		}
	}
}

// convertToMergeLocalFiles converts api.LocalFile to merge.LocalFile
func convertToMergeLocalFiles(apiFiles []api.LocalFile) []merge.LocalFile {
	result := make([]merge.LocalFile, len(apiFiles))
	for i, f := range apiFiles {
		result[i] = merge.LocalFile{
			Name:            f.Name,
			Content:         f.Content,
			OriginalHash:    f.OriginalHash,
			OriginalContent: f.OriginalContent,
			Deleted:         f.Deleted,
		}
	}
	return result
}

// convertToDirtyFiles converts api.ServerFile to merge.DirtyFile.
// Content is passed through as-is to preserve the original JSON format.
// Filenames are normalized to NFC for cross-platform consistency.
func convertToDirtyFiles(serverFiles []api.ServerFile) []merge.DirtyFile {
	result := make([]merge.DirtyFile, len(serverFiles))
	for i, f := range serverFiles {
		// Normalize filename to NFC for cross-platform consistency
		fileName := normalizeFileName(f.Name)

		// Pass through content as-is - no JSON re-encoding to preserve original format
		result[i] = merge.DirtyFile{
			Name:    fileName,
			Content: f.Content,
		}
	}
	return result
}

// convertToFilesToWrite converts merge.SyncedFile to api.FileToWrite
func convertToFilesToWrite(files []merge.SyncedFile) []api.FileToWrite {
	result := make([]api.FileToWrite, len(files))
	for i, f := range files {
		result[i] = api.FileToWrite{
			Name:    f.Name,
			Content: f.Content,
		}
	}
	return result
}

// convertToAPIConflicts converts merge.ConflictInfo to api.ConflictInfo
func convertToAPIConflicts(conflicts []merge.ConflictInfo) []api.ConflictInfo {
	result := make([]api.ConflictInfo, len(conflicts))
	for i, c := range conflicts {
		result[i] = api.ConflictInfo{
			File:        c.File,
			Field:       c.Field,
			Resolution:  c.Resolution,
			LocalValue:  c.LocalValue,
			ServerValue: c.ServerValue,
		}
	}
	return result
}

// extractDeletedFileNames extracts file names from deleted files (local deletions only)
func extractDeletedFileNames(deleted []merge.DeletedFileInfo) []string {
	var result []string
	for _, d := range deleted {
		if d.DeletedBy == "local" {
			result = append(result, d.Name)
		}
	}
	return result
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

// folderUploadCmd represents the folder upload command
var folderUploadCmd = &cobra.Command{
	Use:   "upload <folder-name>",
	Short: "[NON-INTERACTIVE] Upload local changes to the server",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Upload local changes in a folder to the server's dirty branch.

This command:
  1. Reads your local files and detects changes since last sync
  2. Merges your changes with any server-side changes (if any)
  3. Commits the merged result to the dirty branch
  4. Updates your local files to match the merged result

Conflict resolution:
  - If both local and server modified the same file, LOCAL WINS
  - Conflicts are resolved at the JSON field level when possible
  - A log message shows which conflicts were auto-resolved

After upload, your local files will exactly match the server's dirty branch.

You can safely run upload at any time, regardless of how stale your local copy is.
The command will automatically merge with any server changes.

Requires authentication. Run 'scratchmd auth login' first.
Requires a previous download (folder must exist with .scratchmd config).

Examples:
  scratchmd folder upload blog-posts
  scratchmd folder upload blog-posts --json`,
	Args: cobra.ExactArgs(1),
	RunE: runFolderUpload,
}

func init() {
	rootCmd.AddCommand(folderCmd)
	folderCmd.AddCommand(folderLinkCmd)
	folderCmd.AddCommand(folderRemoveCmd)
	folderCmd.AddCommand(folderListCmd)
	folderCmd.AddCommand(folderDownloadCmd)
	folderCmd.AddCommand(folderResetCmd)
	folderCmd.AddCommand(folderUploadCmd)

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

	// Flags for folder upload
	folderUploadCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	folderUploadCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")
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

	contentDir := config.GetFolderContentDir(folderName)
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

	// Try to find existing folder config to get the folder name
	existingConfig, folderName, _ := config.LoadFolderConfigByID(folderId)

	// Read local folder state (empty if first-time download)
	var localFiles []api.LocalFile
	if existingConfig != nil && !clobber {
		localFiles, err = readLocalFolderState(folderName)
		if err != nil {
			return outputError(fmt.Sprintf("Failed to read local files: %s", err.Error()))
		}
	}

	// If clobber, clear local files to get fresh state
	if clobber {
		localFiles = nil
	}

	// Fetch server files (simple storage layer - no merge on server)
	serverResp, err := client.GetFolderFiles(folderId)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to fetch folder files: %s", err.Error()))
	}

	if !serverResp.Success {
		return outputError(fmt.Sprintf("Server error: %s", serverResp.Error))
	}

	if serverResp.Folder == nil {
		return outputError("No folder data returned from server")
	}

	// Determine local folder name from server response and sanitize it
	rawFolderName := serverResp.Folder.Name
	folderName, err = sanitizeFolderName(rawFolderName)
	if err != nil {
		return outputError(fmt.Sprintf("Invalid folder name from server '%s': %s", rawFolderName, err.Error()))
	}

	// If clobber, remove existing files first
	contentDir := config.GetFolderContentDir(folderName)
	originalDir := config.GetFolderOriginalDir(folderName)
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

	// Perform merge LOCALLY
	mergeLocalFiles := convertToMergeLocalFiles(localFiles)
	mergeDirtyFiles := convertToDirtyFiles(serverResp.Files)
	mergeResult := merge.MergeFolder(mergeLocalFiles, mergeDirtyFiles)

	// Apply merge result to disk
	result, err := applyMergeResult(folderName, mergeResult)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to apply merge result: %s", err.Error()))
	}

	// Save folder config
	metadataDir := config.GetFolderMetadataDir(folderName)
	folderConfig := &config.FolderConfig{
		FolderID:             serverResp.Folder.ID,
		WorkbookID:           serverResp.Folder.WorkbookID,
		FolderName:           serverResp.Folder.Name,
		ConnectorService:     serverResp.Folder.ConnectorService,
		ConnectorDisplayName: serverResp.Folder.ConnectorDisplayName,
		TableID:              serverResp.Folder.TableID,
		Path:                 serverResp.Folder.Path,
		Schema:               serverResp.Folder.Schema,
		LastDownload:         time.Now().Format(time.RFC3339),
		LastSyncTime:         serverResp.Folder.LastSyncTime,
	}
	if err := config.SaveFolderConfig(folderName, folderConfig); err != nil {
		return outputError(fmt.Sprintf("Failed to save folder config: %s", err.Error()))
	}

	// Log conflicts and info
	logMergeInfo(mergeResult, jsonOutput)

	// Compute sync hash for output
	var allHashes []string
	for _, f := range mergeResult.Files {
		allHashes = append(allHashes, f.Hash)
	}
	syncHash := merge.Hash(strings.Join(allHashes, ":"))

	// Output results
	if jsonOutput {
		output := map[string]interface{}{
			"success":           true,
			"operation":         "download",
			"folderId":          serverResp.Folder.ID,
			"folderName":        serverResp.Folder.Name,
			"workbookId":        serverResp.Folder.WorkbookID,
			"filesDownloaded":   result.FilesWritten,
			"filesDeleted":      result.FilesDeleted,
			"conflictsResolved": result.ConflictsResolved,
			"contentDir":        contentDir,
			"metadataDir":       metadataDir,
			"syncHash":          syncHash,
		}
		if len(mergeResult.Conflicts) > 0 {
			output["conflicts"] = mergeResult.Conflicts
		}
		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	fmt.Println()
	fmt.Printf("Downloaded %d file(s) to '%s/'\n", result.FilesWritten, folderName)
	if result.ConflictsResolved > 0 {
		fmt.Printf("  %d conflict(s) auto-resolved (local changes kept)\n", result.ConflictsResolved)
	}
	if result.FilesDeleted > 0 {
		fmt.Printf("  %d file(s) deleted\n", result.FilesDeleted)
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

	// Try to find existing folder config to get folder name for the warning
	_, folderName, _ := config.LoadFolderConfigByID(folderId)
	if folderName == "" {
		folderName = folderId // Use ID as placeholder if no local config
	}

	// Create directory structure paths for warning display
	contentDir := config.GetFolderContentDir(folderName)
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

	// Call sync endpoint with empty localFiles to get fresh server state
	resp, err := client.SyncFolder(folderId, &api.SyncFolderRequest{
		Operation:  api.SyncOperationDownload,
		LocalFiles: nil, // Empty = fresh download
	})
	if err != nil {
		return outputError(fmt.Sprintf("Failed to reset folder: %s", err.Error()))
	}

	if !resp.Success {
		return outputError(fmt.Sprintf("Server error: %s", resp.Error))
	}

	if resp.Folder == nil {
		return outputError("No folder data returned from server")
	}

	// Get actual folder name from server
	rawFolderName := resp.Folder.Name
	folderName, err = sanitizeFolderName(rawFolderName)
	if err != nil {
		return outputError(fmt.Sprintf("Invalid folder name from server '%s': %s", rawFolderName, err.Error()))
	}

	// Update paths with actual folder name
	contentDir = folderName
	originalDir = config.GetFolderOriginalDir(folderName)
	metadataDir := config.GetFolderMetadataDir(folderName)

	// DESTRUCTIVE: Remove all existing files
	if !jsonOutput {
		fmt.Printf("Destroying local changes in '%s/'...\n", folderName)
	}

	// Remove all files from content directory
	if entries, err := os.ReadDir(contentDir); err == nil {
		for _, entry := range entries {
			entryPath := filepath.Join(contentDir, entry.Name())
			os.RemoveAll(entryPath)
		}
	}

	// Remove original directory entirely
	os.RemoveAll(originalDir)

	// Apply sync result (writes fresh files)
	result, err := applySyncResult(folderName, resp)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to apply sync result: %s", err.Error()))
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

	// Output results
	if jsonOutput {
		output := map[string]interface{}{
			"success":         true,
			"operation":       "reset",
			"destructive":     true,
			"folderId":        resp.Folder.ID,
			"folderName":      resp.Folder.Name,
			"workbookId":      resp.Folder.WorkbookID,
			"filesDownloaded": result.FilesWritten,
			"contentDir":      contentDir,
			"metadataDir":     metadataDir,
			"syncHash":        resp.SyncHash,
			"message":         "All local changes have been destroyed. Folder reset to server state.",
		}
		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	fmt.Println()
	fmt.Println("Reset complete. All local changes have been destroyed.")
	fmt.Printf("Downloaded %d file(s) fresh from server to '%s/'\n", result.FilesWritten, folderName)
	if result.FilesDeleted > 0 {
		fmt.Printf("Removed %d file(s) deleted from server\n", result.FilesDeleted)
	}
	fmt.Printf("Folder config saved to '%s/%s'\n", metadataDir, config.FolderConfigFileName)
	fmt.Println()

	return nil
}

func runFolderUpload(cmd *cobra.Command, args []string) error {
	folderArg := args[0]
	jsonOutput, _ := cmd.Flags().GetBool("json")
	serverURL, _ := cmd.Flags().GetString("server")

	outputError := createOutputErrorFunc(jsonOutput)

	var folderName string
	var folderConfig *config.FolderConfig
	var err error

	// Check if arg is a folder ID (dfd_...) or a folder name
	if strings.HasPrefix(folderArg, "dfd_") {
		// Look up folder config by ID
		folderConfig, folderName, err = config.LoadFolderConfigByID(folderArg)
		if err != nil {
			return outputError(fmt.Sprintf("Failed to load folder config: %s", err.Error()))
		}
		if folderConfig == nil {
			return outputError(fmt.Sprintf("No local folder found for ID '%s'. Run 'folder download %s' first.", folderArg, folderArg))
		}
	} else {
		// Sanitize folder name
		folderName, err = sanitizeFolderName(folderArg)
		if err != nil {
			return outputError(fmt.Sprintf("Invalid folder name: %s", err.Error()))
		}

		// Load folder config to get folder ID
		folderConfig, err = config.LoadFolderConfig(folderName)
		if err != nil {
			return outputError(fmt.Sprintf("Failed to load folder config: %s. Run 'folder download' first.", err.Error()))
		}

		if folderConfig == nil {
			return outputError(fmt.Sprintf("No folder config found for '%s'. Run 'folder download' first.", folderName))
		}
	}

	if folderConfig.FolderID == "" {
		return outputError("Folder config missing folder ID. Run 'folder download' first.")
	}

	// Get authenticated client
	client, _, err := getAuthenticatedFolderClient(serverURL, outputError)
	if err != nil {
		return err
	}

	// Read local folder state
	localFiles, err := readLocalFolderState(folderName)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to read local files: %s", err.Error()))
	}

	if len(localFiles) == 0 {
		return outputError("No files to upload. The folder has no files or pending deletions to sync.")
	}

	// Fetch server files (simple storage layer - no merge on server)
	serverResp, err := client.GetFolderFiles(folderConfig.FolderID)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to fetch server files: %s", err.Error()))
	}

	if !serverResp.Success {
		return outputError(fmt.Sprintf("Server error: %s", serverResp.Error))
	}

	// Perform merge LOCALLY
	mergeLocalFiles := convertToMergeLocalFiles(localFiles)
	mergeDirtyFiles := convertToDirtyFiles(serverResp.Files)
	mergeResult := merge.MergeFolder(mergeLocalFiles, mergeDirtyFiles)

	// Push merged files to server (conflicts are auto-resolved locally, not sent to server)
	putResp, err := client.PutFolderFiles(folderConfig.FolderID, &api.PutFolderFilesRequest{
		Files:        convertToFilesToWrite(mergeResult.Files),
		DeletedFiles: extractDeletedFileNames(mergeResult.DeletedFiles),
	})
	if err != nil {
		return outputError(fmt.Sprintf("Upload failed: %s", err.Error()))
	}

	if !putResp.Success {
		return outputError(fmt.Sprintf("Upload failed: %s", putResp.Error))
	}

	// Apply merge result to disk
	result, err := applyMergeResult(folderName, mergeResult)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to apply merge result: %s", err.Error()))
	}

	// Update folder config with new sync time
	folderConfig.LastDownload = time.Now().Format(time.RFC3339)
	if err := config.SaveFolderConfig(folderName, folderConfig); err != nil {
		if !jsonOutput {
			fmt.Printf("Warning: Failed to update folder config: %s\n", err.Error())
		}
	}

	// Log conflicts and info
	logMergeInfo(mergeResult, jsonOutput)

	// Compute sync hash for output
	var allHashes []string
	for _, f := range mergeResult.Files {
		allHashes = append(allHashes, f.Hash)
	}
	syncHash := merge.Hash(strings.Join(allHashes, ":"))

	// Output results
	if jsonOutput {
		output := map[string]interface{}{
			"success":           true,
			"operation":         "upload",
			"folderId":          folderConfig.FolderID,
			"folderName":        folderName,
			"filesUploaded":     result.FilesWritten,
			"filesDeleted":      result.FilesDeleted,
			"conflictsResolved": result.ConflictsResolved,
			"syncHash":          syncHash,
		}
		if len(mergeResult.Conflicts) > 0 {
			output["conflicts"] = mergeResult.Conflicts
		}
		data, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	fmt.Println()
	fmt.Printf("Uploaded %d file(s) from '%s/'\n", result.FilesWritten, folderName)
	if result.ConflictsResolved > 0 {
		fmt.Printf("  %d conflict(s) auto-resolved (local changes kept)\n", result.ConflictsResolved)
	}
	if result.FilesDeleted > 0 {
		fmt.Printf("  %d file(s) deleted\n", result.FilesDeleted)
	}
	fmt.Println()

	return nil
}
