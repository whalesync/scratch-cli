// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/briandowns/spinner"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/download"
	"github.com/whalesync/scratch-cli/internal/providers"
	"gopkg.in/yaml.v3"
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:   "content",
	Short: "Manage CMS content",
	Long: `Manage CMS content synchronization.

NON-INTERACTIVE (LLM-friendly):
  content download [folder]       Download content from CMS
  content dirty-fields <folder>   Check which fields changed
  content diff <folder>           Show actual file diffs
  content diff-fields <folder>    Show actual field value diffs

Use 'scratchmd status' to see which files have changed.
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

// contentDirtyFieldsCmd checks which fields changed in files
var contentDirtyFieldsCmd = &cobra.Command{
	Use:   "dirty-fields <folder>",
	Short: "[NON-INTERACTIVE] Check which fields changed in files",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Check which fields changed in files compared to original downloaded versions.

Without --file flag, compares all files and shows:
  - Deleted files (in red)
  - Created files (in green)
  - Modified files with list of changed fields (in orange)

With --file flag, shows changed fields for a specific file only.

Examples:
  scratchmd content dirty-fields blog-posts
  scratchmd content dirty-fields blog-posts --file post-1.md`,
	Args: cobra.ExactArgs(1),
	RunE: runContentDirtyFields,
}

// contentDiffCmd shows actual diffs for files
var contentDiffCmd = &cobra.Command{
	Use:   "diff <folder>",
	Short: "[NON-INTERACTIVE] Show actual file diffs",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Show the actual diff (using git diff or diff) for changed files.

Without --file flag, shows diffs for all changed files in the folder.
With --file flag, shows diff for a specific file only.

Examples:
  scratchmd content diff blog-posts
  scratchmd content diff blog-posts --file post-1.md`,
	Args: cobra.ExactArgs(1),
	RunE: runContentDiff,
}

// contentDiffFieldsCmd shows field-level diffs with values
var contentDiffFieldsCmd = &cobra.Command{
	Use:   "diff-fields <folder>",
	Short: "[NON-INTERACTIVE] Show field value diffs",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Show the actual old and new values for changed fields.

Without --file flag, shows field diffs for all changed files.
With --file flag, shows field diffs for a specific file only.

Examples:
  scratchmd content diff-fields blog-posts
  scratchmd content diff-fields blog-posts --file post-1.md`,
	Args: cobra.ExactArgs(1),
	RunE: runContentDiffFields,
}

// contentUploadCmd represents the content upload command
var contentUploadCmd = &cobra.Command{
	Use:   "upload [folder[/file.json]]",
	Short: "[NON-INTERACTIVE] Upload local changes to CMS",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Upload local content changes to the configured CMS.

Without arguments, uploads all changes across all linked tables.
With folder argument, uploads changes for that collection only.
With folder/file.json argument, uploads a single record.

By default, shows a preview of changes and asks for confirmation.
Use --no-review to skip the confirmation prompt.
Use --sync-deletes to delete remote records that are missing locally.

Examples:
  scratchmd content upload                       # upload all changes (with review)
  scratchmd content upload blog-posts            # upload one collection
  scratchmd content upload blog-posts/post.json  # upload one record
  scratchmd content upload --no-review           # skip confirmation
  scratchmd content upload --sync-deletes        # delete remote records missing locally`,
	RunE: runContentUpload,
}

// contentValidateCmd represents the content validate command
var contentValidateCmd = &cobra.Command{
	Use:   "validate [folder[/file.md]...]",
	Short: "Validate files against CMS schema",
	Long: `Validate local content files against the CMS schema before publishing.

INTERACTIVE MODE (no arguments in terminal):
  Prompts to select validation scope and allows multi-selection of folders/files.

NON-INTERACTIVE MODE (with arguments or piped input):
  Accepts multiple folders and/or files as arguments.
  Use --all to validate all files without prompting.

Examples:
  scratchmd content validate                                    # interactive: select what to validate
  scratchmd content validate --all                              # non-interactive: validate all files
  scratchmd content validate blog-posts                         # validate one collection
  scratchmd content validate blog-posts articles                # validate multiple collections
  scratchmd content validate blog-posts/post.md                 # validate one file
  scratchmd content validate blog-posts/a.md articles/b.md      # validate multiple files
  scratchmd content validate blog-posts articles/post.md        # mix folders and files`,
	RunE: runContentValidate,
}

// pullCmd is an alias for 'content download'
var pullCmd = &cobra.Command{
	Use:   "pull [folder]",
	Short: "[NON-INTERACTIVE] Alias for 'content download'",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd content download'.

Downloads content from the CMS to local JSON files.

Examples:
  scratchmd pull                  # download all linked tables
  scratchmd pull blog-posts       # download one table
  scratchmd pull --clobber        # discard local changes and re-download`,
	RunE: runContentDownload,
}

// pushCmd is an alias for 'content upload'
var pushCmd = &cobra.Command{
	Use:   "push [folder[/file.json]]",
	Short: "[NON-INTERACTIVE] Alias for 'content upload'",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd content upload'.

Uploads local changes to the CMS.

Examples:
  scratchmd push                       # upload all changes (with review)
  scratchmd push blog-posts            # upload one collection
  scratchmd push blog-posts/post.json  # upload one record
  scratchmd push --no-review           # skip confirmation`,
	RunE: runContentUpload,
}

func init() {
	rootCmd.AddCommand(contentCmd)
	rootCmd.AddCommand(pullCmd)
	rootCmd.AddCommand(pushCmd)
	contentCmd.AddCommand(contentDownloadCmd)
	contentCmd.AddCommand(contentDirtyFieldsCmd)
	contentCmd.AddCommand(contentDiffCmd)
	contentCmd.AddCommand(contentDiffFieldsCmd)
	contentCmd.AddCommand(contentUploadCmd)
	contentCmd.AddCommand(contentValidateCmd)

	// Flags for content download
	contentDownloadCmd.Flags().Bool("clobber", false, "Delete ALL local files and re-download fresh (DESTRUCTIVE - discards local changes)")
	contentDownloadCmd.Flags().Bool("no-attachments", false, "Skip downloading attachments")

	// Flags for pull (alias for content download)
	pullCmd.Flags().Bool("clobber", false, "Delete ALL local files and re-download fresh (DESTRUCTIVE - discards local changes)")
	pullCmd.Flags().Bool("no-attachments", false, "Skip downloading attachments")

	// Flags for content dirty-fields
	contentDirtyFieldsCmd.Flags().String("file", "", "Check a specific file only")

	// Flags for content diff
	contentDiffCmd.Flags().String("file", "", "Show diff for a specific file only")

	// Flags for content diff-fields
	contentDiffFieldsCmd.Flags().String("file", "", "Show field diffs for a specific file only")

	// Flags for content upload
	contentUploadCmd.Flags().Bool("no-review", false, "Skip confirmation prompt (for automation/LLM use)")
	contentUploadCmd.Flags().Bool("sync-deletes", false, "Delete remote CMS records when local file is removed (DESTRUCTIVE)")
	contentUploadCmd.Flags().Bool("simulate", false, "Show what would happen without making changes (writes to file)")
	contentUploadCmd.Flags().Bool("dry-run", false, "Alias for --simulate")
	contentUploadCmd.Flags().Bool("json", false, "Output results as JSON (for automation/LLM use)")

	// Flags for push (alias for content upload)
	pushCmd.Flags().Bool("no-review", false, "Skip confirmation prompt (for automation/LLM use)")
	pushCmd.Flags().Bool("sync-deletes", false, "Delete remote CMS records when local file is removed (DESTRUCTIVE)")
	pushCmd.Flags().Bool("simulate", false, "Show what would happen without making changes (writes to file)")
	pushCmd.Flags().Bool("dry-run", false, "Alias for --simulate")
	pushCmd.Flags().Bool("json", false, "Output results as JSON (for automation/LLM use)")

	// Flags for content validate
	contentValidateCmd.Flags().Bool("all", false, "Validate all files without prompting (non-interactive)")
}

// ANSI color codes
const (
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorOrange = "\033[33m"
	colorBlack  = "\033[30m"
	colorWhite  = "\033[97m"
	colorReset  = "\033[0m"

	// Background colors
	bgRed   = "\033[41m"
	bgGreen = "\033[42m"
)

func runContentDownload(cmd *cobra.Command, args []string) error {
	clobber, _ := cmd.Flags().GetBool("clobber")
	noAttachments, _ := cmd.Flags().GetBool("no-attachments")

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

	// Create the downloader
	downloader := download.NewTableDownloader(cfg, secrets, cfg.Settings.ScratchServerURL)

	// Download each table
	var hasErrors bool
	for _, tableName := range tablesToDownload {
		opts := download.Options{
			Clobber:             clobber,
			DownloadAttachments: !noAttachments,
			OnProgress:          func(msg string) { fmt.Println(msg) },
		}
		if _, err := downloader.Download(tableName, opts); err != nil {
			fmt.Printf("❌ Error downloading '%s': %v\n", tableName, err)
			hasErrors = true
			continue
		}
	}

	if hasErrors {
		return fmt.Errorf("one or more downloads failed")
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

	// Show diffs for all changed files
	return runAllFilesDiff(tableName, originalDir)
}

// runAllFilesDiff shows diffs for all changed files in a folder
func runAllFilesDiff(tableName, originalDir string) error {
	// Get list of .md files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	entries, err := os.ReadDir(tableName)
	if err != nil {
		return fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			currentFiles[entry.Name()] = true
		}
	}

	entries, err = os.ReadDir(originalDir)
	if err != nil {
		return fmt.Errorf("failed to read original folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			originalFiles[entry.Name()] = true
		}
	}

	// Check if provider supports attachments and get attachment fields
	var attachmentFields []string
	if providerSupportsAttachments(tableName) {
		schema, err := config.LoadTableSchema(tableName)
		if err == nil && schema != nil {
			attachmentFields = getAttachmentFieldsFromSchema(schema)
		}
	}

	// Collect all files that need diffing
	var filesToDiff []string
	filesWithAttachmentChanges := make(map[string]bool) // Track which files have attachment changes
	for filename := range originalFiles {
		if currentFiles[filename] {
			needsDiff := false
			fileSlug := strings.TrimSuffix(filename, ".md")

			// Check if markdown content is actually modified
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)
			currentContent, _ := os.ReadFile(currentPath)
			originalContent, _ := os.ReadFile(originalPath)
			if !bytes.Equal(currentContent, originalContent) {
				needsDiff = true
			}

			// Check for attachment changes if provider supports them
			if len(attachmentFields) > 0 && hasAttachmentChanges(tableName, originalDir, fileSlug, attachmentFields) {
				needsDiff = true
				filesWithAttachmentChanges[filename] = true
			}

			if needsDiff {
				filesToDiff = append(filesToDiff, filename)
			}
		}
	}

	sort.Strings(filesToDiff)

	if len(filesToDiff) == 0 {
		fmt.Println("No modified files to diff.")
		return nil
	}

	for i, filename := range filesToDiff {
		if i > 0 {
			fmt.Println() // Separator between files
		}
		fmt.Printf("=== %s ===\n", filename)
		if err := runFileDiff(tableName, originalDir, filename); err != nil {
			fmt.Printf("Error: %v\n", err)
		}

		// Show attachment changes if any
		if filesWithAttachmentChanges[filename] {
			fileSlug := strings.TrimSuffix(filename, ".md")
			for _, fieldName := range attachmentFields {
				changes, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
				if err != nil || len(changes) == 0 {
					continue
				}
				fmt.Printf("\n%sAttachment changes in '%s' field '%s':%s\n", colorOrange, filename, fieldName, colorReset)
				for _, change := range changes {
					var warning string
					if change.Warning != "" {
						warning = fmt.Sprintf(" %s⚠️  %s%s", colorOrange, change.Warning, colorReset)
					}
					switch change.Type {
					case "removed":
						fmt.Printf("  %s- %s%s\n", colorRed, change.Filename, colorReset)
					case "added":
						fmt.Printf("  %s+ %s%s%s\n", colorGreen, change.Filename, colorReset, warning)
					case "modified":
						fmt.Printf("  %s~ %s%s%s\n", colorOrange, change.Filename, colorReset, warning)
					}
				}
			}
		}
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

func runContentDirtyFields(cmd *cobra.Command, args []string) error {
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

	// Load table config to get content field name
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil {
		return fmt.Errorf("failed to load table config: %w", err)
	}
	contentFieldName := ""
	if tableConfig != nil {
		contentFieldName = tableConfig.ContentField
	}

	// If --file flag is provided, show dirty fields for that specific file
	if fileName != "" {
		return runSingleFileDirtyFields(tableName, originalDir, fileName, contentFieldName)
	}

	// Otherwise, compare all files in the folder
	return runFolderDirtyFields(tableName, originalDir, contentFieldName)
}

func runSingleFileDirtyFields(tableName, originalDir, fileName, contentFieldName string) error {
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

	// Load schema and check for attachment fields if provider supports attachments
	var attachmentFields []string
	if providerSupportsAttachments(tableName) {
		schema, err := config.LoadTableSchema(tableName)
		if err == nil && schema != nil {
			attachmentFields = getAttachmentFieldsFromSchema(schema)
		}
	}

	// Compare fields
	modifiedFields, addedFields, removedFields := getChangedFieldsDetailed(currentFields, originalFields)

	// For attachment fields, we need special comparison logic
	// The field value in markdown just points to a folder path, so we compare the folder contents
	// against the AssetManifest to detect actual attachment changes
	attachmentChanges := make(map[string][]AttachmentChange) // fieldName -> changes
	fileSlug := strings.TrimSuffix(fileName, ".md")

	for _, fieldName := range attachmentFields {
		changes, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
		if err != nil {
			// Silently skip attachment fields that fail to compare
			continue
		}
		if len(changes) > 0 {
			attachmentChanges[fieldName] = changes
		}

		// Remove attachment fields from the regular modified/added/removed lists
		// since we handle them specially
		modifiedFields = removeFromSlice(modifiedFields, fieldName)
		addedFields = removeFromSlice(addedFields, fieldName)
		removedFields = removeFromSlice(removedFields, fieldName)
	}

	// Check if there are any changes at all
	hasChanges := len(modifiedFields) > 0 || len(addedFields) > 0 || len(removedFields) > 0 || len(attachmentChanges) > 0

	if !hasChanges {
		fmt.Println("No field changes detected.")
		return nil
	}

	// Show filename header
	fmt.Printf("%s%s%s\n", colorOrange, fileName, colorReset)

	// Show each field with appropriate color (no values, just field names)
	for _, f := range removedFields {
		fmt.Printf("  %s%s (removed)%s\n", colorRed, f, colorReset)
	}
	for _, f := range addedFields {
		fmt.Printf("  %s%s (added)%s\n", colorGreen, f, colorReset)
	}
	for _, f := range modifiedFields {
		fmt.Printf("  %s%s%s\n", colorOrange, f, colorReset)
	}

	// Show attachment field changes with detailed file-level information
	for fieldName, changes := range attachmentChanges {
		fmt.Printf("  %s%s (attachments)%s\n", colorOrange, fieldName, colorReset)
		for _, change := range changes {
			var warning string
			if change.Warning != "" {
				warning = fmt.Sprintf(" %s⚠️  %s%s", colorOrange, change.Warning, colorReset)
			}
			switch change.Type {
			case "removed":
				fmt.Printf("    %s- %s%s\n", colorRed, change.Filename, colorReset)
			case "added":
				fmt.Printf("    %s+ %s%s%s\n", colorGreen, change.Filename, colorReset, warning)
			case "modified":
				fmt.Printf("    %s~ %s%s%s\n", colorOrange, change.Filename, colorReset, warning)
			}
		}
	}

	return nil
}

// removeFromSlice removes a value from a string slice and returns the new slice
func removeFromSlice(slice []string, value string) []string {
	result := make([]string, 0, len(slice))
	for _, v := range slice {
		if v != value {
			result = append(result, v)
		}
	}
	return result
}

func runContentDiffFields(cmd *cobra.Command, args []string) error {
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

	// Load table config to get content field name
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil {
		return fmt.Errorf("failed to load table config: %w", err)
	}
	contentFieldName := ""
	if tableConfig != nil {
		contentFieldName = tableConfig.ContentField
	}

	// If --file flag is provided, show field diffs for that specific file
	if fileName != "" {
		return runSingleFileDiffField(tableName, originalDir, fileName, contentFieldName)
	}

	// Otherwise, show field diffs for all files
	return runFolderDiffField(tableName, originalDir, contentFieldName)
}

func runSingleFileDiffField(tableName, originalDir, fileName, contentFieldName string) error {
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

	// Show each field with values
	for _, f := range removedFields {
		fmt.Printf("  %s%s (removed)%s\n", colorRed, f, colorReset)
		printFieldValue(originalFields[f], colorRed)
	}
	for _, f := range addedFields {
		fmt.Printf("  %s%s (added)%s\n", colorGreen, f, colorReset)
		printFieldValue(currentFields[f], colorGreen)
	}
	for _, f := range modifiedFields {
		fmt.Printf("  %s%s%s\n", colorOrange, f, colorReset)
		printFieldValueChange(originalFields[f], currentFields[f])
	}

	return nil
}

func runFolderDiffField(tableName, originalDir, contentFieldName string) error {
	// Get list of .md files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	entries, err := os.ReadDir(tableName)
	if err != nil {
		return fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			currentFiles[entry.Name()] = true
		}
	}

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
	var modifiedFiles []string

	// Check for deleted and modified files
	for filename := range originalFiles {
		if currentFiles[filename] {
			// Check if actually modified
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)
			currentContent, _ := os.ReadFile(currentPath)
			originalContent, _ := os.ReadFile(originalPath)
			if !bytes.Equal(currentContent, originalContent) {
				modifiedFiles = append(modifiedFiles, filename)
			}
		} else {
			deleted = append(deleted, filename)
		}
	}

	// Check for created files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			created = append(created, filename)
		}
	}

	sort.Strings(deleted)
	sort.Strings(created)
	sort.Strings(modifiedFiles)

	if len(deleted) == 0 && len(created) == 0 && len(modifiedFiles) == 0 {
		fmt.Println("No changes detected.")
		return nil
	}

	// Show deleted files
	for _, f := range deleted {
		fmt.Printf("%s%s (deleted)%s\n", colorRed, f, colorReset)
	}

	// Show created files
	for _, f := range created {
		fmt.Printf("%s%s (created)%s\n", colorGreen, f, colorReset)
	}

	// Show modified files with field diffs
	for _, filename := range modifiedFiles {
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

		modifiedFieldsList, addedFields, removedFields := getChangedFieldsDetailed(currentFields, originalFields)
		if len(modifiedFieldsList) == 0 && len(addedFields) == 0 && len(removedFields) == 0 {
			continue
		}

		fmt.Printf("%s%s%s\n", colorOrange, filename, colorReset)
		for _, f := range removedFields {
			fmt.Printf("  %s%s (removed)%s\n", colorRed, f, colorReset)
			printFieldValue(originalFields[f], colorRed)
		}
		for _, f := range addedFields {
			fmt.Printf("  %s%s (added)%s\n", colorGreen, f, colorReset)
			printFieldValue(currentFields[f], colorGreen)
		}
		for _, f := range modifiedFieldsList {
			fmt.Printf("  %s%s%s\n", colorOrange, f, colorReset)
			printFieldValueChange(originalFields[f], currentFields[f])
		}
	}

	return nil
}

// printFieldValue prints a single value (for added/removed fields)
func printFieldValue(value, color string) {
	fmt.Printf("    %s%s%s\n", color, value, colorReset)
}

// printFieldValueChange displays a character-level diff using ANSI colors.
//
// Uses diffmatchpatch to compute inline diffs, then renders deleted text with
// red background and inserted text with green background. Unchanged text
// appears without highlighting.
func printFieldValueChange(oldVal, newVal string) {
	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(oldVal, newVal, false)

	// Build the highlighted output showing what changed
	fmt.Print("    ")
	for _, diff := range diffs {
		switch diff.Type {
		case diffmatchpatch.DiffDelete:
			// Red text on red background for deleted
			fmt.Printf("%s%s%s", bgRed+colorWhite, diff.Text, colorReset)
		case diffmatchpatch.DiffInsert:
			// Green text on green background for inserted
			fmt.Printf("%s%s%s", bgGreen+colorBlack, diff.Text, colorReset)
		case diffmatchpatch.DiffEqual:
			// Unchanged text in default color
			fmt.Print(diff.Text)
		}
	}
	fmt.Println()
}

func runFolderDirtyFields(tableName, originalDir, contentFieldName string) error {
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
	Operation     string                 // "delete", "create", "update"
	Filename      string                 // The filename
	RemoteID      string                 // The remote ID from the id field (for update/delete)
	ChangedFields []string               // List of changed fields (for create/update)
	FieldValues   map[string]interface{} // Field name -> new value (for create/update)

}

func runContentUpload(cmd *cobra.Command, args []string) error {
	noReview, _ := cmd.Flags().GetBool("no-review")
	syncDeletes, _ := cmd.Flags().GetBool("sync-deletes")
	simulate, _ := cmd.Flags().GetBool("simulate")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	jsonOutput, _ := cmd.Flags().GetBool("json")
	simulate = simulate || dryRun // --dry-run is an alias for --simulate

	// JSON output type definitions
	type uploadResult struct {
		File      string `json:"file"`
		Operation string `json:"operation"`
		ID        string `json:"id,omitempty"`
		Success   bool   `json:"success"`
		Error     string `json:"error,omitempty"`
	}
	type uploadOutput struct {
		Success   bool           `json:"success"`
		Simulated bool           `json:"simulated,omitempty"`
		Results   []uploadResult `json:"results"`
	}
	var jsonResults []uploadResult

	// Parse the argument to determine scope
	var tableName, fileName string
	if len(args) > 0 {
		arg := args[0]
		// Check if it's a folder/file.json pattern
		if strings.Contains(arg, "/") && strings.HasSuffix(arg, ".json") {
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

	// Load config and secrets for API calls
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Collect all changes across tables, grouped by table for API calls
	type tableChanges struct {
		tableName   string
		tableConfig *config.TableConfig
		changes     []UploadChange
	}
	var allTableChanges []tableChanges

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

		// Load table config to get content field name and id field
		tableConfig, err := config.LoadTableConfig(table)
		if err != nil {
			return fmt.Errorf("failed to load table config for '%s': %w", table, err)
		}
		contentFieldName := ""
		idField := "id" // default
		if tableConfig != nil {
			contentFieldName = tableConfig.ContentField
			if tableConfig.IdField != "" {
				idField = tableConfig.IdField
			}
		}

		// Get changes for this table
		var changes []UploadChange
		if fileName != "" {
			// Single file mode
			change, err := getSingleFileChange(table, originalDir, fileName, contentFieldName, idField)
			if err != nil {
				return err
			}
			if change != nil {
				changes = append(changes, *change)
			}
		} else {
			// Folder mode
			changes, err = getFolderChanges(table, originalDir, contentFieldName, idField, syncDeletes)
			if err != nil {
				return err
			}
		}

		if len(changes) > 0 {
			allTableChanges = append(allTableChanges, tableChanges{
				tableName:   table,
				tableConfig: tableConfig,
				changes:     changes,
			})
		}
	}

	// Flatten changes for display
	var allChanges []UploadChange
	for _, tc := range allTableChanges {
		allChanges = append(allChanges, tc.changes...)
	}

	if len(allChanges) == 0 {
		if jsonOutput {
			output := uploadOutput{Success: true, Results: []uploadResult{}}
			jsonBytes, _ := json.MarshalIndent(output, "", "  ")
			fmt.Println(string(jsonBytes))
			return nil
		}
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
				fmt.Printf("%s%s (delete)%s\n", colorRed, change.Filename, colorReset)
			case "create":
				fmt.Printf("%s%s (create)%s\n", colorGreen, change.Filename, colorReset)
				for _, field := range change.ChangedFields {
					fmt.Printf("  %s\n", field)
				}
			case "update":
				fmt.Printf("%s%s (update)%s\n", colorOrange, change.Filename, colorReset)
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

	// If --simulate flag is set, write operations to a text file instead of uploading
	if simulate {
		// For JSON output, return simulated results
		if jsonOutput {
			for _, change := range allChanges {
				jsonResults = append(jsonResults, uploadResult{
					File:      change.Filename,
					Operation: change.Operation,
					ID:        change.RemoteID,
					Success:   true,
				})
			}
			output := uploadOutput{Success: true, Simulated: true, Results: jsonResults}
			jsonBytes, _ := json.MarshalIndent(output, "", "  ")
			fmt.Println(string(jsonBytes))
			return nil
		}

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

		fmt.Printf("Simulation: Operations written to %s\n", outputFile)
		return nil
	}

	// Upload changes via API
	var hasErrors bool
	for _, tc := range allTableChanges {
		if tc.tableConfig == nil {
			if !jsonOutput {
				fmt.Printf("❌ Skipping '%s': no table config found\n", tc.tableName)
			}
			hasErrors = true
			continue
		}

		// Get the account for this table
		account := cfg.GetAccountByID(tc.tableConfig.AccountID)
		if account == nil {
			if !jsonOutput {
				fmt.Printf("❌ Skipping '%s': account not found\n", tc.tableName)
			}
			hasErrors = true
			continue
		}

		// Get the authentication properties
		authProps := secrets.GetSecretProperties(account.ID)
		if len(authProps) == 0 {
			if !jsonOutput {
				fmt.Printf("❌ Skipping '%s': no credentials found for account '%s'\n", tc.tableName, account.Name)
			}
			hasErrors = true
			continue
		}

		var s *spinner.Spinner
		if !jsonOutput {
			s = spinner.New(spinner.CharSets[14], 100*time.Millisecond)
			s.Suffix = fmt.Sprintf(" Uploading changes for '%s'...", tc.tableName)
			s.Start()
		}

		// Create API client
		client := newAPIClient(cfg.Settings.ScratchServerURL)

		// Build connector credentials
		creds := &api.ConnectorCredentials{
			Service: account.Provider,
			Params:  authProps,
		}

		// Build table ID array
		var tableID []string
		if tc.tableConfig.SiteID != "" {
			tableID = []string{tc.tableConfig.SiteID, tc.tableConfig.TableID}
		} else {
			tableID = []string{tc.tableConfig.TableID}
		}

		// Load schema to identify attachment fields
		schema, _ := config.LoadTableSchema(tc.tableName)
		var attachmentFields []string
		if schema != nil {
			attachmentFields = getAttachmentFieldsFromSchema(schema)
		}

		// Check if provider supports attachments
		supportsAttachments := providerSupportsAttachments(tc.tableName)

		// originalDir for attachment ID lookups
		originalDir := filepath.Join(".scratchmd", tc.tableName, "original")

		// Upload new attachment files BEFORE building operations
		// This ensures newly uploaded attachments get their IDs registered in the manifest
		// so they can be included in the attachment field data
		if supportsAttachments && len(attachmentFields) > 0 {
			// Get the provider's uploader interface
			provider, _ := providers.GetProvider(tc.tableConfig.Provider)
			uploader, isUploader := provider.(providers.AttachmentUploader)

			if isUploader {
				if s != nil {
					s.Suffix = fmt.Sprintf(" Uploading new attachments for '%s'...", tc.tableName)
				}

				// Progress callback that works with the spinner
				uploadProgress := func(msg string) {
					if s != nil {
						s.Stop()
					}
					if !jsonOutput {
						fmt.Println(msg)
					}
					if s != nil {
						s.Start()
					}
				}

				// Process each change that has an id (updates) or will get one (creates need special handling)
				for _, change := range tc.changes {
					// Skip deletes - no attachments to upload
					if change.Operation == "delete" {
						continue
					}

					// For creates, we cannot upload attachments yet because there's no recordID
					// The record must be created first, then attachments can be added in a follow-up
					if change.Operation == "create" {
						// Check if there are any attachment changes for this new file
						_, baseFilename := filepath.Split(change.Filename)
						fileSlug := getFileSlug(baseFilename)

						for _, fieldName := range attachmentFields {
							changes, _ := getAttachmentFieldChanges(tc.tableName, originalDir, fileSlug, fieldName)
							for _, c := range changes {
								if c.Type == "added" {
									uploadProgress(fmt.Sprintf("    ⚠️  Skipping attachment upload for new record '%s' - attachments will need to be uploaded after record creation", change.Filename))
									break
								}
							}
						}
						continue
					}

					// For updates, we have an id to upload to
					if change.RemoteID == "" {
						continue
					}

					_, baseFilename := filepath.Split(change.Filename)
					fileSlug := getFileSlug(baseFilename)

					for _, fieldName := range attachmentFields {
						uploaded, err := uploadNewAndModifiedAttachments(
							tc.tableName,
							originalDir,
							fileSlug,
							fieldName,
							tc.tableConfig,
							creds,
							uploader,
							change.RemoteID,
							uploadProgress,
						)
						if err != nil {
							uploadProgress(fmt.Sprintf("    ⚠️  Error uploading attachments for %s/%s: %v", fileSlug, fieldName, err))
						} else if uploaded > 0 {
							uploadProgress(fmt.Sprintf("    ✓ Uploaded %d new attachment(s) for %s/%s", uploaded, fileSlug, fieldName))
						}
					}
				}

				if s != nil {
					s.Suffix = fmt.Sprintf(" Uploading changes for '%s'...", tc.tableName)
				}
			}
		}

		// Get idField from table config (default to "id")
		idField := "id"
		if tc.tableConfig.IdField != "" {
			idField = tc.tableConfig.IdField
		}

		// Convert UploadChange to api.UploadOperation
		var operations []api.UploadOperation
		for _, change := range tc.changes {
			var op api.UploadOpType
			switch change.Operation {
			case "create":
				op = api.OpCreate
			case "update":
				op = api.OpUpdate
			case "delete":
				op = api.OpDelete
			}

			// Build data map, excluding idField
			// Send all fields for both create and update operations
			// (Some APIs like Audienceful need identifier fields like email for updates)
			var data map[string]interface{}
			if change.Operation == "create" || change.Operation == "update" {
				data = make(map[string]interface{})
				for k, v := range change.FieldValues {
					// Exclude the id field (used internally for tracking)
					if k != idField {
						data[k] = v
					}
				}
			}

			// Convert attachment field values from folder paths to attachment IDs
			// Only do this if the provider supports attachments and we have attachment fields
			if supportsAttachments && len(attachmentFields) > 0 && data != nil {
				// Get the file slug from the filename (e.g., "blog-posts/my-post.json" -> "my-post")
				_, baseFilename := filepath.Split(change.Filename)
				fileSlug := getFileSlug(baseFilename)

				for _, fieldName := range attachmentFields {
					if _, hasField := data[fieldName]; hasField {
						// This field is an attachment field and is being modified
						// Convert the folder path to a list of attachment IDs
						attachmentIDs, err := getAttachmentIDsForField(tc.tableName, originalDir, fileSlug, fieldName)
						if err != nil {
							// Log warning but continue - the field value will remain as the folder path
							// which will likely cause an error on the server side
							continue
						}
						// Replace the folder path with a list of attachment objects
						// Each object has a single "id" property, e.g., [{"id": "att123"}, {"id": "att456"}]
						var attachmentObjects []map[string]string
						for _, id := range attachmentIDs {
							attachmentObjects = append(attachmentObjects, map[string]string{"id": id})
						}
						data[fieldName] = attachmentObjects
					}
				}
			}

			operations = append(operations, api.UploadOperation{
				Op:       op,
				ID:       change.RemoteID,
				Filename: change.Filename,
				Data:     data,
			})
		}

		// Call the upload endpoint
		resp, err := client.Upload(creds, tableID, operations)
		if !jsonOutput {
			s.Stop()
		}
		if err != nil {
			if !jsonOutput {
				fmt.Printf("❌ Error uploading to '%s': %v\n", tc.tableName, err)
			}
			// For JSON mode, add error results for all operations in this table
			if jsonOutput {
				for _, change := range tc.changes {
					jsonResults = append(jsonResults, uploadResult{
						File:      change.Filename,
						Operation: change.Operation,
						Success:   false,
						Error:     err.Error(),
					})
				}
			}
			hasErrors = true
			continue
		}

		// Report results and update local file system for each file
		for _, result := range resp.Results {
			if result.Error != "" {
				if jsonOutput {
					jsonResults = append(jsonResults, uploadResult{
						File:      result.Filename,
						Operation: result.Op,
						Success:   false,
						Error:     result.Error,
					})
				} else {
					fmt.Printf("  %s❌ %s: %s%s\n", colorRed, result.Filename, result.Error, colorReset)
				}
				hasErrors = true
				continue
			}

			// Get just the filename from the full path (e.g., "blog-posts/post.md" -> "post.md")
			_, fileName := filepath.Split(result.Filename)
			currentPath := result.Filename
			originalPath := filepath.Join(originalDir, fileName)

			// Get idField from table config (default to "id")
			idField := "id"
			if tc.tableConfig.IdField != "" {
				idField = tc.tableConfig.IdField
			}

			// Collect result for JSON output
			if jsonOutput {
				jsonResults = append(jsonResults, uploadResult{
					File:      result.Filename,
					Operation: result.Op,
					ID:        result.ID,
					Success:   true,
				})
			}

			switch result.Op {
			case "create":
				if !jsonOutput {
					fmt.Printf("  %s✓ %s (created, id: %s)%s\n", colorGreen, result.Filename, result.ID, colorReset)
				}
				// Update the current file to add the id field to the JSON
				if err := addIDToJsonFile(currentPath, idField, result.ID); err != nil {
					if !jsonOutput {
						fmt.Printf("    ⚠️  Failed to update id: %v\n", err)
					}
				}
				// Copy the updated current file to the original folder
				if err := copyFile(currentPath, originalPath); err != nil {
					if !jsonOutput {
						fmt.Printf("    ⚠️  Failed to sync original: %v\n", err)
					}
				}
			case "update":
				if !jsonOutput {
					fmt.Printf("  %s✓ %s (updated)%s\n", colorGreen, result.Filename, colorReset)
				}
				// Copy the current file to the original folder
				if err := copyFile(currentPath, originalPath); err != nil {
					if !jsonOutput {
						fmt.Printf("    ⚠️  Failed to sync original: %v\n", err)
					}
				}
			case "delete":
				if !jsonOutput {
					fmt.Printf("  %s✓ %s (deleted)%s\n", colorGreen, result.Filename, colorReset)
				}
				// Delete the original file (current file already doesn't exist for deletes)
				if err := os.Remove(originalPath); err != nil && !os.IsNotExist(err) {
					if !jsonOutput {
						fmt.Printf("    ⚠️  Failed to remove original: %v\n", err)
					}
				}
			}
		}

		// Update AssetManifest: remove entries for deleted attachments
		if supportsAttachments && len(attachmentFields) > 0 {
			assetManifestPath := filepath.Join(originalDir, config.AssetManifestFileName)
			manifest, err := config.LoadAssetManifest(assetManifestPath)
			if err == nil {
				manifestModified := false

				// For each successfully uploaded file, check for removed attachments
				for _, result := range resp.Results {
					if result.Error != "" {
						continue // Skip failed uploads
					}

					// Only process updates (creates won't have removed attachments, deletes remove the whole file)
					if result.Op != "update" {
						continue
					}

					_, baseFilename := filepath.Split(result.Filename)
					fileSlug := getFileSlug(baseFilename)

					// Check each attachment field for removed files
					for _, fieldName := range attachmentFields {
						changes, err := getAttachmentFieldChanges(tc.tableName, originalDir, fileSlug, fieldName)
						if err != nil {
							continue
						}

						// Remove manifest entries for deleted attachments
						for _, change := range changes {
							if change.Type == "removed" {
								// Build the path prefix to find the entry in manifest
								// Manifest paths are like "assets/<fileSlug>/<fieldName>/<filename>"
								assetPath := filepath.Join("assets", fileSlug, fieldName, change.Filename)
								// Find and remove the entry by path
								for i := range manifest.Assets {
									if manifest.Assets[i].Path == assetPath {
										manifest.RemoveAsset(manifest.Assets[i].ID)
										manifestModified = true
										break
									}
								}
							}
						}
					}
				}

				// Save the manifest if it was modified
				if manifestModified {
					if err := config.SaveAssetManifest(assetManifestPath, manifest); err != nil {
						if !jsonOutput {
							fmt.Printf("    ⚠️  Failed to update asset manifest: %v\n", err)
						}
					}
				}
			}
		}
	}

	// Output JSON results if enabled
	if jsonOutput {
		output := uploadOutput{Success: !hasErrors, Results: jsonResults}
		jsonBytes, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(jsonBytes))
		if hasErrors {
			return fmt.Errorf("one or more operations failed")
		}
		return nil
	}

	fmt.Println("Upload complete.")

	if hasErrors {
		return fmt.Errorf("one or more operations failed")
	}
	return nil
}

func runContentValidate(cmd *cobra.Command, args []string) error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	secrets, err := config.LoadSecrets()
	if err != nil {
		return fmt.Errorf("failed to load secrets: %w", err)
	}

	// Check for --all flag
	validateAll, _ := cmd.Flags().GetBool("all")

	// Determine if we should run in interactive mode
	// Interactive mode: no args, no --all flag, and stdin is a terminal
	isInteractive := len(args) == 0 && !validateAll && isInteractiveTerminal()

	// Variables to track what to validate
	// specificFiles: List of "folder/file.md" paths (for both interactive and non-interactive multi-select)
	// specificFolders: List of folder names to validate all files in
	var specificFiles []string
	var specificFolders []string

	if isInteractive {
		// Interactive mode: prompt user to select what to validate
		selectedFiles, err := promptValidateSelection()
		if err != nil {
			if err == ErrGoBack {
				fmt.Println("Validation cancelled.")
				return nil
			}
			return fmt.Errorf("failed to get selection: %w", err)
		}
		if len(selectedFiles) == 0 {
			fmt.Println("No files selected for validation.")
			return nil
		}
		specificFiles = selectedFiles
	} else if len(args) > 0 {
		// Non-interactive with arguments - can be multiple folders and/or files
		for _, arg := range args {
			// Normalize path separators to forward slashes for consistent cross-platform handling
			normalizedArg := filepath.ToSlash(arg)

			// Check if it's folder/file.md format (contains / and ends with .md)
			if strings.Contains(normalizedArg, "/") && strings.HasSuffix(normalizedArg, ".md") {
				specificFiles = append(specificFiles, normalizedArg)
			} else if strings.Contains(normalizedArg, "/") {
				// It's a folder path with subdir, treat as folder
				specificFolders = append(specificFolders, arg) // Keep original for os.ReadDir
			} else {
				// It's a folder name
				specificFolders = append(specificFolders, arg)
			}
		}

		// Expand folders to get all their files
		if len(specificFolders) > 0 {
			folderFiles, err := getAllFilesFromTables(specificFolders)
			if err != nil {
				return fmt.Errorf("failed to get files from folders: %w", err)
			}
			specificFiles = append(specificFiles, folderFiles...)
		}
	}

	// Create API client
	client := newAPIClient(cfg.Settings.ScratchServerURL)

	// Determine which tables to validate
	var tablesToValidate []string
	if len(specificFiles) > 0 {
		// We have specific files selected (interactive or non-interactive multi-select)
		// Group files by table
		tableFilesMap := make(map[string][]string)
		for _, file := range specificFiles {
			parts := strings.SplitN(file, "/", 2)
			if len(parts) == 2 {
				tableFilesMap[parts[0]] = append(tableFilesMap[parts[0]], parts[1])
			}
		}
		for tbl := range tableFilesMap {
			tablesToValidate = append(tablesToValidate, tbl)
		}
		// Store for later use in the loop
		cmd.SetContext(context.WithValue(cmd.Context(), "tableFilesMap", tableFilesMap))
	} else {
		// Validate all configured tables (--all flag or no args in non-interactive)
		tables, err := config.ListConfiguredTables(".")
		if err != nil {
			return fmt.Errorf("failed to list tables: %w", err)
		}
		if len(tables) == 0 {
			fmt.Println("No tables configured.")
			fmt.Println("Run 'scratchmd setup' and select 'Set up tables' first.")
			return nil
		}
		tablesToValidate = tables
	}

	// Process each table
	var hasErrors bool
	for _, tblName := range tablesToValidate {
		// Load table config
		tableConfig, err := config.LoadTableConfig(tblName)
		if err != nil {
			fmt.Printf("❌ Failed to load config for '%s': %v\n", tblName, err)
			hasErrors = true
			continue
		}
		if tableConfig == nil {
			fmt.Printf("❌ No config found for '%s'\n", tblName)
			hasErrors = true
			continue
		}

		// Get account credentials
		account := cfg.GetAccountByID(tableConfig.AccountID)
		if account == nil {
			fmt.Printf("❌ Account not found for table '%s'\n", tblName)
			hasErrors = true
			continue
		}

		authProps := secrets.GetSecretPropertiesWithOverrides(account.ID)
		if len(authProps) == 0 {
			fmt.Printf("❌ No credentials found for account '%s'\n", account.Name)
			hasErrors = true
			continue
		}

		creds := &api.ConnectorCredentials{
			Service: account.Provider,
			Params:  authProps,
		}

		// Build table ID
		var tableID []string
		if tableConfig.SiteID != "" {
			tableID = []string{tableConfig.SiteID, tableConfig.TableID}
		} else {
			tableID = []string{tableConfig.TableID}
		}

		// Collect files to validate
		var filesToValidate []api.FileToValidate

		// Check if we have specific files from interactive mode
		var tableFilesMap map[string][]string
		if ctx := cmd.Context(); ctx != nil {
			if tfm, ok := ctx.Value("tableFilesMap").(map[string][]string); ok {
				tableFilesMap = tfm
			}
		}

		if tableFilesMap != nil && len(tableFilesMap[tblName]) > 0 {
			// Specific files selected (interactive or non-interactive with multiple args)
			for _, fName := range tableFilesMap[tblName] {
				file, err := loadFileForValidation(tblName, fName, tableConfig.ContentField, tableConfig.IdField)
				if err != nil {
					fmt.Printf("   ⚠️  Failed to load '%s': %v\n", fName, err)
					continue
				}
				filesToValidate = append(filesToValidate, *file)
			}
		} else {
			// Validate all .md files in the table folder
			entries, err := os.ReadDir(tblName)
			if err != nil {
				fmt.Printf("❌ Failed to read folder '%s': %v\n", tblName, err)
				hasErrors = true
				continue
			}

			for _, entry := range entries {
				if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
					continue
				}

				file, err := loadFileForValidation(tblName, entry.Name(), tableConfig.ContentField, tableConfig.IdField)
				if err != nil {
					fmt.Printf("   ⚠️  Failed to load '%s': %v\n", entry.Name(), err)
					continue
				}
				filesToValidate = append(filesToValidate, *file)
			}
		}

		if len(filesToValidate) == 0 {
			fmt.Printf("No files to validate in '%s'\n", tblName)
			continue
		}

		fmt.Printf("🔍 Validating %d file(s) in '%s'...\n", len(filesToValidate), tblName)

		// Call the validate-files endpoint
		req := &api.ValidateFilesRequest{
			TableID: tableID,
			Files:   filesToValidate,
		}

		resp, err := client.ValidateFiles(creds, req)
		if err != nil {
			fmt.Printf("❌ Validation request failed: %v\n", err)
			hasErrors = true
			continue
		}

		if resp.Error != "" {
			fmt.Printf("❌ Server error: %s\n", resp.Error)
			hasErrors = true
			continue
		}

		// Display results
		publishableCount := 0
		for _, file := range resp.Files {
			if file.Publishable {
				publishableCount++
				fmt.Printf("   ✅ %s - publishable\n", file.Filename)
			} else {
				fmt.Printf("   ❌ %s - not publishable\n", file.Filename)
				hasErrors = true
				for _, e := range file.Errors {
					fmt.Printf("      - %s\n", e)
				}
			}
		}

		fmt.Printf("   %d/%d file(s) are publishable\n", publishableCount, len(resp.Files))
	}

	if hasErrors {
		return fmt.Errorf("validation failed for one or more files")
	}
	return nil
}

// loadFileForValidation reads a markdown file and returns it in the format needed for validation.
func loadFileForValidation(tableName, fileName, contentFieldName, idField string) (*api.FileToValidate, error) {
	// Convert from forward-slash internal format to OS-specific path
	filePath := filepath.Join(filepath.FromSlash(tableName), fileName)

	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	contentStr := string(content)

	// Determine the key to use for markdown content
	contentKey := "_content"
	if contentFieldName != "" {
		contentKey = contentFieldName
	}

	data := make(map[string]interface{})

	// Check for YAML frontmatter (starts with ---)
	if !strings.HasPrefix(contentStr, "---") {
		// No frontmatter, just content
		data[contentKey] = strings.TrimSpace(contentStr)
		return &api.FileToValidate{
			Filename: fileName,
			Data:     data,
		}, nil
	}

	// Find the end of frontmatter
	rest := contentStr[3:] // Skip initial ---
	endIndex := strings.Index(rest, "\n---")
	if endIndex == -1 {
		// Malformed frontmatter
		data[contentKey] = strings.TrimSpace(contentStr)
		return &api.FileToValidate{
			Filename: fileName,
			Data:     data,
		}, nil
	}

	yamlContent := rest[:endIndex]
	markdownContent := strings.TrimPrefix(rest[endIndex+4:], "\n")

	// Parse YAML into map (keeping original types)
	if err := yaml.Unmarshal([]byte(yamlContent), &data); err != nil {
		return nil, fmt.Errorf("failed to parse YAML frontmatter: %w", err)
	}

	// Add markdown content under the appropriate key
	data[contentKey] = strings.TrimSpace(markdownContent)

	// Extract id for the file using the configured idField
	var remoteID string
	idKey := idField
	if idKey == "" {
		idKey = "id"
	}
	if id, ok := data[idKey]; ok {
		remoteID = fmt.Sprintf("%v", id)
	}

	return &api.FileToValidate{
		ID:       remoteID,
		Filename: fileName,
		Data:     data,
	}, nil
}

// promptValidateSelection prompts the user to select what to validate interactively.
// Returns a list of "folder/file.md" paths to validate.
func promptValidateSelection() ([]string, error) {
	// Get all configured tables
	tables, err := config.ListConfiguredTables(".")
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	if len(tables) == 0 {
		fmt.Println("No tables configured.")
		fmt.Println("Run 'scratchmd setup' and select 'Set up tables' first.")
		return nil, nil
	}

	// Ask user what scope they want to validate
	scopeOptions := []string{
		"All files",
		"Select folders",
		"Select files",
	}

	var selectedScope string
	scopePrompt := &survey.Select{
		Message: "What would you like to validate?",
		Options: scopeOptions,
	}
	if err := askOne(scopePrompt, &selectedScope); err != nil {
		return nil, err
	}

	switch selectedScope {
	case "All files":
		// Return all files from all tables
		return getAllFilesFromTables(tables)

	case "Select folders":
		// Let user select folders
		var selectedFolders []string
		folderPrompt := &survey.MultiSelect{
			Message: "Select folders to validate (type to filter, space to select):",
			Options: tables,
		}
		if err := askOne(folderPrompt, &selectedFolders); err != nil {
			return nil, err
		}
		if len(selectedFolders) == 0 {
			return nil, nil
		}
		return getAllFilesFromTables(selectedFolders)

	case "Select files":
		// Collect all files from all tables
		allFiles, err := getAllFilesFromTables(tables)
		if err != nil {
			return nil, err
		}
		if len(allFiles) == 0 {
			fmt.Println("No files found in any configured table.")
			return nil, nil
		}

		// Let user select specific files
		var selectedFiles []string
		filePrompt := &survey.MultiSelect{
			Message:  "Select files to validate (type to filter, space to select):",
			Options:  allFiles,
			PageSize: 15,
		}
		if err := askOne(filePrompt, &selectedFiles); err != nil {
			return nil, err
		}
		return selectedFiles, nil
	}

	return nil, nil
}

// getAllFilesFromTables returns all .md files from the specified tables as "folder/file.md" paths.
// Uses forward slashes consistently for cross-platform compatibility in parsing.
func getAllFilesFromTables(tables []string) ([]string, error) {
	var allFiles []string
	for _, tbl := range tables {
		// Convert to OS-specific path for filesystem operations
		osPath := filepath.FromSlash(tbl)
		entries, err := os.ReadDir(osPath)
		if err != nil {
			// Skip tables that don't have a folder yet
			continue
		}
		// Normalize table name to forward slashes for consistent internal representation
		normalizedTbl := filepath.ToSlash(tbl)
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			// Use forward slash consistently for cross-platform path handling
			allFiles = append(allFiles, normalizedTbl+"/"+entry.Name())
		}
	}
	return allFiles, nil
}

// getSingleFileChange detects what changed for a single JSON file by comparing against its original.
//
// Returns nil if no changes detected. Determines operation type (create/update/delete) by
// checking file existence in current vs original directories. For updates, only changed
// fields are included in the result. idField specifies which JSON field to use as the record ID.
func getSingleFileChange(tableName, originalDir, fileName, contentFieldName, idField string) (*UploadChange, error) {
	currentPath := filepath.Join(tableName, fileName)
	originalPath := filepath.Join(originalDir, fileName)

	_, currentErr := os.Stat(currentPath)
	currentExists := currentErr == nil

	_, originalErr := os.Stat(originalPath)
	originalExists := originalErr == nil

	fullFileName := filepath.Join(tableName, fileName)

	// Deleted file
	if !currentExists && originalExists {
		originalFields, err := parseJsonFile(originalPath)
		if err != nil {
			return nil, fmt.Errorf("failed to parse original file: %w", err)
		}
		return &UploadChange{
			Operation: "delete",
			Filename:  fullFileName,
			RemoteID:  getRemoteIDFromInterface(originalFields, idField),
		}, nil
	}

	// Created file
	if currentExists && !originalExists {
		currentFields, err := parseJsonFile(currentPath)
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
			RemoteID:      getRemoteIDFromInterface(currentFields, idField),
			ChangedFields: fields,
			FieldValues:   currentFields,
		}, nil
	}

	// File doesn't exist in either
	if !currentExists && !originalExists {
		return nil, fmt.Errorf("file '%s' not found", fileName)
	}

	// Both exist - check for changes
	currentFields, err := parseJsonFile(currentPath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse current file: %w", err)
	}

	originalFields, err := parseJsonFile(originalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse original file: %w", err)
	}

	changedFields := getChangedFieldsInterface(currentFields, originalFields)
	fileSlug := getFileSlug(fileName)

	// Check for attachment field changes if provider supports attachments
	if providerSupportsAttachments(tableName) {
		schema, _ := config.LoadTableSchema(tableName)
		if schema != nil {
			attachmentFields := getAttachmentFieldsFromSchema(schema)
			for _, fieldName := range attachmentFields {
				changes, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
				if err == nil && len(changes) > 0 {
					// Add the attachment field to changed fields if not already present
					found := false
					for _, cf := range changedFields {
						if cf == fieldName {
							found = true
							break
						}
					}
					if !found {
						changedFields = append(changedFields, fieldName)
					}
				}
			}
		}
	}

	if len(changedFields) == 0 {
		return nil, nil // No changes
	}

	return &UploadChange{
		Operation:     "update",
		Filename:      fullFileName,
		RemoteID:      getRemoteIDFromInterface(currentFields, idField),
		ChangedFields: changedFields,
		FieldValues:   currentFields,
	}, nil
}

// getFolderChanges scans a folder and detects all changes compared to original copies.
//
// Compares .json files in tableName/ against .scratchmd/<tableName>/original/ to find:
// - Deleted: files in original but not in current (only if includeDeletes=true)
// - Created: files in current but not in original
// - Updated: files in both with different content
//
// Results are sorted by operation (delete, create, update) then filename.
// idField specifies which JSON field to use as the record ID.
func getFolderChanges(tableName, originalDir, contentFieldName, idField string, includeDeletes bool) ([]UploadChange, error) {
	var changes []UploadChange

	// Get list of .json files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	// Read current folder
	entries, err := os.ReadDir(tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to read folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			currentFiles[entry.Name()] = true
		}
	}

	// Read original folder
	entries, err = os.ReadDir(originalDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read original folder: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			originalFiles[entry.Name()] = true
		}
	}

	// Check for deleted files (only if includeDeletes is true)
	if includeDeletes {
		for filename := range originalFiles {
			if !currentFiles[filename] {
				originalPath := filepath.Join(originalDir, filename)
				fields, err := parseJsonFile(originalPath)
				if err != nil {
					continue
				}
				changes = append(changes, UploadChange{
					Operation: "delete",
					Filename:  filepath.Join(tableName, filename),
					RemoteID:  getRemoteIDFromInterface(fields, idField),
				})
			}
		}
	}

	// Check for created files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			currentPath := filepath.Join(tableName, filename)
			jsonFields, err := parseJsonFile(currentPath)
			if err != nil {
				continue
			}
			var fields []string
			for field := range jsonFields {
				fields = append(fields, field)
			}
			sort.Strings(fields)
			changes = append(changes, UploadChange{
				Operation:     "create",
				Filename:      filepath.Join(tableName, filename),
				RemoteID:      getRemoteIDFromInterface(jsonFields, idField),
				ChangedFields: fields,
				FieldValues:   jsonFields,
			})
		}
	}

	// Load schema and check for attachment support once for the folder
	var attachmentFields []string
	supportsAttachments := providerSupportsAttachments(tableName)
	if supportsAttachments {
		schema, _ := config.LoadTableSchema(tableName)
		if schema != nil {
			attachmentFields = getAttachmentFieldsFromSchema(schema)
		}
	}

	// Check for modified files
	for filename := range originalFiles {
		if currentFiles[filename] {
			currentPath := filepath.Join(tableName, filename)
			originalPath := filepath.Join(originalDir, filename)

			currentFields, err := parseJsonFile(currentPath)
			if err != nil {
				continue
			}
			originalFields, err := parseJsonFile(originalPath)
			if err != nil {
				continue
			}

			changedFields := getChangedFieldsInterface(currentFields, originalFields)
			fileSlug := getFileSlug(filename)

			// Check for attachment field changes if provider supports attachments
			if supportsAttachments && len(attachmentFields) > 0 {
				for _, fieldName := range attachmentFields {
					attChanges, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
					if err == nil && len(attChanges) > 0 {
						// Add the attachment field to changed fields if not already present
						found := false
						for _, cf := range changedFields {
							if cf == fieldName {
								found = true
								break
							}
						}
						if !found {
							changedFields = append(changedFields, fieldName)
						}
					}
				}
			}

			if len(changedFields) > 0 {
				changes = append(changes, UploadChange{
					Operation:     "update",
					Filename:      filepath.Join(tableName, filename),
					RemoteID:      getRemoteIDFromInterface(currentFields, idField),
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

// getChangedFields compares field maps and returns changed field names with annotations.
//
// Returns a sorted list where modified fields appear as-is, removed fields have " (removed)"
// suffix, and added fields have " (added)" suffix. Used for upload operations where
// annotations help identify the type of change.
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

// getChangedFieldsDetailed compares field maps and returns changes categorized by type.
//
// Unlike getChangedFields which annotates names, this returns three separate sorted lists
// for UI display where different change types need different styling (colors, icons).
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

// stringMapToInterface converts map[string]string to map[string]interface{}
func stringMapToInterface(m map[string]string) map[string]interface{} {
	result := make(map[string]interface{}, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}

// getChangedFieldsInterface compares two interface maps and returns the list of changed fields.
// Values are compared by JSON serialization for complex types.
func getChangedFieldsInterface(current, original map[string]interface{}) []string {
	var changed []string

	// Check for modified and removed fields
	for field, originalValue := range original {
		if currentValue, exists := current[field]; exists {
			if !valuesEqual(currentValue, originalValue) {
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

// valuesEqual compares two interface values for equality.
// For complex types (maps, slices), it compares JSON representations.
func valuesEqual(a, b interface{}) bool {
	// Handle nil cases
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Try direct comparison for simple types
	if fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b) {
		return true
	}

	// For complex types, compare JSON representations
	aJSON, aErr := json.Marshal(a)
	bJSON, bErr := json.Marshal(b)
	if aErr != nil || bErr != nil {
		return false
	}
	return string(aJSON) == string(bJSON)
}

// getRemoteIDFromInterface extracts the record ID from a map[string]interface{}.
// It uses the specified idField (default "id") to find the record identifier.
func getRemoteIDFromInterface(m map[string]interface{}, idField string) string {
	if idField == "" {
		idField = "id"
	}
	id, ok := m[idField]
	if !ok {
		return ""
	}
	// Handle different types to avoid scientific notation for large numbers
	switch v := id.(type) {
	case string:
		return v
	case float64:
		// Use %.0f to avoid scientific notation for large numbers
		return fmt.Sprintf("%.0f", v)
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// getFileSlug extracts the slug from a filename, removing the .json extension.
func getFileSlug(filename string) string {
	return strings.TrimSuffix(filename, ".json")
}

// parseMarkdownFile extracts field values from a markdown file with YAML frontmatter.
//
// File format expected:
//
//	---
//	title: My Post
//	slug: my-post
//	---
//	Markdown content here...
//
// Returns a map where YAML keys become fields, and the markdown body is stored under
// contentFieldName (or "_content" if not specified). All values are stringified for comparison.
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
		contentKey = contentFieldName
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

// parseJsonFile reads a JSON file and returns its fields as a map.
func parseJsonFile(filePath string) (map[string]interface{}, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var data map[string]interface{}
	if err := json.Unmarshal(content, &data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON file: %w", err)
	}

	return data, nil
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	content, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, content, 0644)
}

// addIDToJsonFile adds the id field directly to the JSON object.
//
// Called after a successful create operation to link the local file with its CMS record.
func addIDToJsonFile(filePath, idField, idValue string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	// Parse the JSON
	var data map[string]interface{}
	if err := json.Unmarshal(content, &data); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Add the id field - try to preserve type (int for numeric IDs)
	if intVal, err := strconv.ParseInt(idValue, 10, 64); err == nil {
		data[idField] = intVal
	} else {
		data[idField] = idValue
	}

	// Marshal back to JSON with indentation
	newContent, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return os.WriteFile(filePath, append(newContent, '\n'), 0644)
}

// AttachmentChange represents a change to an attachment file
type AttachmentChange struct {
	Filename string // The filename of the attachment
	Type     string // "added", "removed", or "modified"
	Warning  string // Optional warning message (e.g., file too large)
}

// getAttachmentFieldChanges compares the current state of an asset folder against the original
// AssetManifest to detect changes in attachment files.
//
// The comparison logic:
// 1. Removed files: files in the manifest that no longer exist in the folder
// 2. Added files: files in the folder that are not in the manifest
// 3. Modified files: files that exist in both but have different checksums
//
// Parameters:
//   - tableName: the name of the table folder (e.g., "blog-posts")
//   - originalDir: path to .scratchmd/<tableName>/original
//   - fileSlug: the slug of the markdown file (without .md extension)
//   - fieldName: the name of the attachment field
//
// Returns a slice of AttachmentChange describing what changed, or nil if no changes.
func getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName string) ([]AttachmentChange, error) {
	var changes []AttachmentChange

	// Get the provider for validation
	provider := getProviderForTable(tableName)

	// Load the asset manifest from the original folder
	assetManifestPath := filepath.Join(originalDir, config.AssetManifestFileName)
	manifest, err := config.LoadAssetManifest(assetManifestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load asset manifest: %w", err)
	}

	// Build the path to the current asset folder
	// Asset folder structure: <tableName>/assets/<fileSlug>/<fieldName>/
	assetFolderPath := filepath.Join(tableName, "assets", fileSlug, fieldName)

	// Get manifest entries for this specific field by filtering on path prefix
	// Manifest entries have Path like "assets/<fileSlug>/<fieldName>/<filename>"
	pathPrefix := filepath.Join("assets", fileSlug, fieldName)
	manifestFiles := make(map[string]config.AssetEntry) // filename -> entry
	for _, entry := range manifest.Assets {
		// Check if this entry belongs to the target field
		if strings.HasPrefix(entry.Path, pathPrefix+string(filepath.Separator)) || strings.HasPrefix(entry.Path, pathPrefix+"/") {
			// Extract just the filename from the path
			filename := filepath.Base(entry.Path)
			manifestFiles[filename] = entry
		}
	}

	// Get current files in the asset folder
	currentFiles := make(map[string]bool)
	entries, err := os.ReadDir(assetFolderPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Folder doesn't exist - if manifest had files, they're all removed
			for filename := range manifestFiles {
				changes = append(changes, AttachmentChange{
					Filename: filename,
					Type:     "removed",
				})
			}
			return changes, nil
		}
		return nil, fmt.Errorf("failed to read asset folder: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			currentFiles[entry.Name()] = true
		}
	}

	// Check for removed files (in manifest but not in folder)
	for filename := range manifestFiles {
		if !currentFiles[filename] {
			changes = append(changes, AttachmentChange{
				Filename: filename,
				Type:     "removed",
			})
		}
	}

	// Check for added files (in folder but not in manifest)
	for filename := range currentFiles {
		if _, inManifest := manifestFiles[filename]; !inManifest {
			change := AttachmentChange{
				Filename: filename,
				Type:     "added",
			}
			// Validate file using provider
			if provider != nil {
				filePath := filepath.Join(assetFolderPath, filename)
				if warnings := provider.ValidateAttachmentFile(filePath); len(warnings) > 0 {
					change.Warning = strings.Join(warnings, "; ")
				}
			}
			changes = append(changes, change)
		}
	}

	// Check for modified files (in both, compare checksums)
	for filename, entry := range manifestFiles {
		if currentFiles[filename] {
			// File exists in both - compare checksums
			filePath := filepath.Join(assetFolderPath, filename)
			currentChecksum, err := config.CalculateFileChecksum(filePath)
			if err != nil {
				// If we can't read the file, treat it as modified
				changes = append(changes, AttachmentChange{
					Filename: filename,
					Type:     "modified",
				})
				continue
			}

			if currentChecksum != entry.Checksum {
				change := AttachmentChange{
					Filename: filename,
					Type:     "modified",
				}
				// Validate file using provider
				if provider != nil {
					if warnings := provider.ValidateAttachmentFile(filePath); len(warnings) > 0 {
						change.Warning = strings.Join(warnings, "; ")
					}
				}
				changes = append(changes, change)
			}
		}
	}

	// Sort changes by filename for consistent output
	sort.Slice(changes, func(i, j int) bool {
		return changes[i].Filename < changes[j].Filename
	})

	return changes, nil
}

// getAttachmentFieldsFromSchema returns the field slugs that have attachment metadata.
func getAttachmentFieldsFromSchema(schema config.TableSchema) []string {
	var attachmentFields []string
	for slug, field := range schema {
		if field.Metadata != nil {
			if attachments, ok := field.Metadata["attachments"]; ok && (attachments == "single" || attachments == "multiple") {
				attachmentFields = append(attachmentFields, slug)
			}
		}
	}
	return attachmentFields
}

// isAttachmentField checks if a field name is an attachment field based on the schema
func isAttachmentField(fieldName string, attachmentFields []string) bool {
	for _, af := range attachmentFields {
		if af == fieldName {
			return true
		}
	}
	return false
}

// providerSupportsAttachments checks if the table's provider supports attachments
func providerSupportsAttachments(tableName string) bool {
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil || tableConfig == nil {
		return false
	}

	provider, err := providers.GetProvider(tableConfig.Provider)
	if err != nil {
		return false
	}

	return provider.SupportsAttachments()
}

// getProviderForTable returns the provider for a table, or nil if not found.
func getProviderForTable(tableName string) providers.Provider {
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil || tableConfig == nil {
		return nil
	}

	provider, err := providers.GetProvider(tableConfig.Provider)
	if err != nil {
		return nil
	}

	return provider
}

// hasAttachmentChanges checks if a file has any attachment field changes.
// It returns true if there are any added, removed, or modified attachment files.
func hasAttachmentChanges(tableName, originalDir, fileSlug string, attachmentFields []string) bool {
	for _, fieldName := range attachmentFields {
		changes, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
		if err != nil {
			continue
		}
		if len(changes) > 0 {
			return true
		}
	}
	return false
}

// getAttachmentIDsForField returns a list of attachment IDs for files currently in an attachment field folder.
// It looks up each file in the AssetManifest to obtain the provider's attachment ID.
// For files not in the manifest (newly added files), they are skipped.
//
// Parameters:
//   - tableName: the name of the table folder (e.g., "blog-posts")
//   - originalDir: path to .scratchmd/<tableName>/original
//   - fileSlug: the slug of the markdown file (without .md extension)
//   - fieldName: the name of the attachment field
//
// Returns a slice of attachment IDs in order of filenames, or an error if the manifest cannot be loaded.
func getAttachmentIDsForField(tableName, originalDir, fileSlug, fieldName string) ([]string, error) {
	// Load the asset manifest from the original folder
	assetManifestPath := filepath.Join(originalDir, config.AssetManifestFileName)
	manifest, err := config.LoadAssetManifest(assetManifestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load asset manifest: %w", err)
	}

	// Build the path to the current asset folder
	assetFolderPath := filepath.Join(tableName, "assets", fileSlug, fieldName)

	// Build a lookup map from filename to attachment ID from the manifest
	// Manifest entries have Path like "assets/<fileSlug>/<fieldName>/<filename>"
	pathPrefix := filepath.Join("assets", fileSlug, fieldName)
	manifestByFilename := make(map[string]string) // filename -> attachment ID
	for _, entry := range manifest.Assets {
		if strings.HasPrefix(entry.Path, pathPrefix+string(filepath.Separator)) || strings.HasPrefix(entry.Path, pathPrefix+"/") {
			filename := filepath.Base(entry.Path)
			manifestByFilename[filename] = entry.ID
		}
	}

	// Get current files in the asset folder, sorted by name
	entries, err := os.ReadDir(assetFolderPath)
	if err != nil {
		if os.IsNotExist(err) {
			// No attachment folder exists - return empty list
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read asset folder: %w", err)
	}

	// Collect filenames and sort them
	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() {
			filenames = append(filenames, entry.Name())
		}
	}
	sort.Strings(filenames)

	// Build the list of attachment IDs
	var attachmentIDs []string
	for _, filename := range filenames {
		if id, ok := manifestByFilename[filename]; ok {
			attachmentIDs = append(attachmentIDs, id)
		}
		// Note: files not in manifest (newly added) are skipped - they cannot be uploaded this way
		// and need to be handled by separate attachment upload logic
	}

	return attachmentIDs, nil
}

// uploadNewAndModifiedAttachments uploads new attachment files and re-uploads modified ones.
//
// For new files (added):
// 1. Uploads the attachment via the provider's AttachmentUploader
// 2. Renames the file to include the returned attachment ID and proper index
// 3. Registers the file in the AssetManifest
//
// For modified files (checksum changed):
// 1. Extracts the base filename without index prefix or attachment ID
// 2. Uploads the attachment via the provider's AttachmentUploader using the base name
// 3. Updates the filename to replace the old attachment ID with the new one
// 4. Removes the old manifest entry and creates a new one
//
// Parameters:
//   - tableName: the name of the table folder (e.g., "blog-posts")
//   - originalDir: path to .scratchmd/<tableName>/original
//   - fileSlug: the slug of the markdown file (without .md extension)
//   - fieldName: the name of the attachment field
//   - tableConfig: the table configuration (for provider credentials)
//   - creds: connector credentials for the provider API
//   - uploader: the provider's attachment uploader interface
//   - recordID: the remote record ID for this file
//   - progress: callback for progress messages
//
// Returns the number of attachments uploaded, or an error.
func uploadNewAndModifiedAttachments(
	tableName, originalDir, fileSlug, fieldName string,
	tableConfig *config.TableConfig,
	creds *api.ConnectorCredentials,
	uploader providers.AttachmentUploader,
	recordID string,
	progress func(string),
) (int, error) {
	// Get the changes to identify added and modified files
	changes, err := getAttachmentFieldChanges(tableName, originalDir, fileSlug, fieldName)
	if err != nil {
		return 0, fmt.Errorf("failed to get attachment changes: %w", err)
	}

	// Separate added and modified files
	var addedFiles []string
	var modifiedFiles []string
	for _, change := range changes {
		switch change.Type {
		case "added":
			addedFiles = append(addedFiles, change.Filename)
		case "modified":
			modifiedFiles = append(modifiedFiles, change.Filename)
		}
	}

	if len(addedFiles) == 0 && len(modifiedFiles) == 0 {
		return 0, nil
	}

	// Build paths
	assetFolderPath := filepath.Join(tableName, "assets", fileSlug, fieldName)
	assetManifestPath := filepath.Join(originalDir, config.AssetManifestFileName)

	// Load the asset manifest
	manifest, err := config.LoadAssetManifest(assetManifestPath)
	if err != nil {
		return 0, fmt.Errorf("failed to load asset manifest: %w", err)
	}

	// Build a lookup map from filename to manifest entry for modified file handling
	pathPrefix := filepath.Join("assets", fileSlug, fieldName)
	manifestByFilename := make(map[string]config.AssetEntry)
	for _, entry := range manifest.Assets {
		if strings.HasPrefix(entry.Path, pathPrefix+string(filepath.Separator)) || strings.HasPrefix(entry.Path, pathPrefix+"/") {
			filename := filepath.Base(entry.Path)
			manifestByFilename[filename] = entry
		}
	}

	// Get the highest existing index in the folder
	highestIndex := getHighestIndexInFolder(assetFolderPath)

	// Build provider credentials for the uploader
	providerCreds := providers.ConnectorCredentials{
		Service: creds.Service,
		Params:  creds.Params,
	}

	uploaded := 0

	// Process added files
	for _, filename := range addedFiles {
		filePath := filepath.Join(assetFolderPath, filename)

		// Read the file content
		fileContent, err := os.ReadFile(filePath)
		if err != nil {
			progress(fmt.Sprintf("    ⚠️  Failed to read attachment %s: %v", filename, err))
			continue
		}

		// Detect content type from extension
		contentType := detectContentType(filename)

		// Get the base filename (without index prefix) for upload
		_, nameWithoutIndex := parseAttachmentFilename(filename)
		if nameWithoutIndex == "" {
			nameWithoutIndex = filename
		}

		// Create the upload file
		uploadFile := providers.UploadFile{
			ContentType: contentType,
			Filename:    nameWithoutIndex,
			Content:     base64.StdEncoding.EncodeToString(fileContent),
			Size:        int64(len(fileContent)),
		}

		// Upload the attachment
		progress(fmt.Sprintf("    📤 Uploading new attachment %s...", filename))
		result, err := uploader.UploadAttachment(
			providerCreds,
			tableConfig.SiteID,
			tableConfig.TableID,
			recordID,
			fieldName,
			uploadFile,
		)
		if err != nil {
			progress(fmt.Sprintf("    ⚠️  Failed to upload %s: %v", filename, err))
			continue
		}

		// Build the new filename with proper index and attachment ID
		newFilename := buildAttachmentFilename(filename, result.ID, highestIndex+uploaded+1)
		newFilePath := filepath.Join(assetFolderPath, newFilename)

		// Rename the file if the name changed
		if newFilename != filename {
			if err := os.Rename(filePath, newFilePath); err != nil {
				progress(fmt.Sprintf("    ⚠️  Failed to rename %s to %s: %v", filename, newFilename, err))
				continue
			}
			progress(fmt.Sprintf("    📝 Renamed %s -> %s", filename, newFilename))
		}

		// Calculate checksum and file info for manifest
		fileInfo, _ := os.Stat(newFilePath)
		checksum, _ := config.CalculateFileChecksum(newFilePath)

		// Register in manifest
		entry := config.AssetEntry{
			ID:               result.ID,
			FileID:           fileSlug,
			Filename:         newFilename,
			Path:             filepath.Join("assets", fileSlug, fieldName, newFilename),
			FileSize:         fileInfo.Size(),
			Checksum:         checksum,
			MimeType:         contentType,
			LastDownloadDate: time.Now().Format(time.RFC3339),
		}
		manifest.UpsertAsset(entry)

		uploaded++
		progress(fmt.Sprintf("    ✓ Uploaded %s (id: %s)", newFilename, result.ID))
	}

	// Process modified files
	for _, filename := range modifiedFiles {
		filePath := filepath.Join(assetFolderPath, filename)

		// Get the old manifest entry for this file
		oldEntry, hasOldEntry := manifestByFilename[filename]
		if !hasOldEntry {
			progress(fmt.Sprintf("    ⚠️  Modified file %s not found in manifest, skipping", filename))
			continue
		}

		// Read the file content
		fileContent, err := os.ReadFile(filePath)
		if err != nil {
			progress(fmt.Sprintf("    ⚠️  Failed to read attachment %s: %v", filename, err))
			continue
		}

		// Detect content type from extension
		contentType := detectContentType(filename)

		// Extract the base filename without index prefix AND without attachment ID
		// e.g., "01-myfile-att0000000.jpg" -> "myfile.jpg"
		baseName := extractBaseFilename(filename)

		// Create the upload file with the base name
		uploadFile := providers.UploadFile{
			ContentType: contentType,
			Filename:    baseName,
			Content:     base64.StdEncoding.EncodeToString(fileContent),
			Size:        int64(len(fileContent)),
		}

		// Upload the attachment
		progress(fmt.Sprintf("    📤 Re-uploading modified attachment %s, %s...", filename, baseName))
		result, err := uploader.UploadAttachment(
			providerCreds,
			tableConfig.SiteID,
			tableConfig.TableID,
			recordID,
			fieldName,
			uploadFile,
		)
		if err != nil {
			progress(fmt.Sprintf("    ⚠️  Failed to upload %s: %v", filename, err))
			continue
		}

		// Build the new filename replacing the old attachment ID with the new one
		// Preserve the existing index
		existingIndex, _ := parseAttachmentFilename(filename)
		if existingIndex == 0 {
			existingIndex = 1
		}
		newFilename := fmt.Sprintf("%02d-%s-%s%s", existingIndex, strings.TrimSuffix(baseName, filepath.Ext(baseName)), result.ID, filepath.Ext(baseName))
		newFilePath := filepath.Join(assetFolderPath, newFilename)

		// Rename the file to update the attachment ID
		if newFilename != filename {
			if err := os.Rename(filePath, newFilePath); err != nil {
				progress(fmt.Sprintf("    ⚠️  Failed to rename %s to %s: %v", filename, newFilename, err))
				continue
			}
			progress(fmt.Sprintf("    📝 Renamed %s -> %s", filename, newFilename))
		}

		// Remove the old manifest entry
		manifest.RemoveAsset(oldEntry.ID)

		// Calculate checksum and file info for the new manifest entry
		fileInfo, _ := os.Stat(newFilePath)
		checksum, _ := config.CalculateFileChecksum(newFilePath)

		// Create new manifest entry
		newEntry := config.AssetEntry{
			ID:               result.ID,
			FileID:           fileSlug,
			Filename:         newFilename,
			Path:             filepath.Join("assets", fileSlug, fieldName, newFilename),
			FileSize:         fileInfo.Size(),
			Checksum:         checksum,
			MimeType:         contentType,
			LastDownloadDate: time.Now().Format(time.RFC3339),
		}
		manifest.UpsertAsset(newEntry)

		uploaded++
		progress(fmt.Sprintf("    ✓ Re-uploaded %s (old id: %s, new id: %s)", newFilename, oldEntry.ID, result.ID))
	}

	// Save the updated manifest
	if uploaded > 0 {
		if err := config.SaveAssetManifest(assetManifestPath, manifest); err != nil {
			return uploaded, fmt.Errorf("failed to save asset manifest: %w", err)
		}
	}

	return uploaded, nil
}

// extractBaseFilename extracts the base filename without index prefix and attachment ID.
// Examples:
//
//	"01-myfile-att0000000.jpg" -> "myfile.jpg"
//	"01-my-photo-attXYZ123.png" -> "my-photo.png"
//	"photo.jpg" -> "photo.jpg"
//	"01-photo.jpg" -> "photo.jpg"
func extractBaseFilename(filename string) string {
	// First, remove the index prefix if present
	_, nameWithoutIndex := parseAttachmentFilename(filename)

	// Get the extension
	ext := filepath.Ext(nameWithoutIndex)
	nameWithoutExt := strings.TrimSuffix(nameWithoutIndex, ext)

	// Try to find and remove the attachment ID suffix
	// Attachment IDs are typically like "-attXXXXXX" at the end
	// Look for the last occurrence of "-att" followed by alphanumeric characters
	lastDashIdx := strings.LastIndex(nameWithoutExt, "-att")
	if lastDashIdx > 0 {
		// Verify the part after "-att" looks like an ID (alphanumeric)
		suffix := nameWithoutExt[lastDashIdx+4:] // skip "-att"
		if len(suffix) > 0 && isAlphanumeric(suffix) {
			return nameWithoutExt[:lastDashIdx] + ext
		}
	}

	// No attachment ID found, return as-is
	return nameWithoutIndex
}

// isAlphanumeric checks if a string contains only alphanumeric characters
func isAlphanumeric(s string) bool {
	for _, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

// getHighestIndexInFolder scans an attachment folder and returns the highest 2-digit index prefix found.
// Returns 0 if no indexed files exist.
func getHighestIndexInFolder(folderPath string) int {
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return 0
	}

	highest := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		idx, _ := parseAttachmentFilename(entry.Name())
		if idx > highest {
			highest = idx
		}
	}
	return highest
}

// parseAttachmentFilename parses a filename with the format "<NN>-<name>-<id>.<ext>" or "<name>.<ext>".
// Returns the index (0 if none), and the name part (without index prefix but with extension).
// Examples:
//
//	"01-photo-attXYZ.jpg" -> 1, "photo-attXYZ.jpg"
//	"photo.jpg" -> 0, "photo.jpg"
//	"02-my-image.png" -> 2, "my-image.png"
func parseAttachmentFilename(filename string) (int, string) {
	// Check if filename starts with 2-digit index followed by dash
	if len(filename) >= 3 && filename[2] == '-' {
		var idx int
		if n, err := fmt.Sscanf(filename[:2], "%02d", &idx); err == nil && n == 1 {
			return idx, filename[3:]
		}
	}
	return 0, filename
}

// buildAttachmentFilename creates a properly formatted attachment filename.
// If the file already has an ID suffix (from the manifest), it's preserved.
// If the file needs an index, a 2-digit index is prepended.
//
// The format is: "<NN>-<name>-<id>.<ext>"
// Examples:
//
//	buildAttachmentFilename("photo.jpg", "attXYZ", 1) -> "01-photo-attXYZ.jpg"
//	buildAttachmentFilename("01-photo.jpg", "attXYZ", 1) -> "01-photo-attXYZ.jpg"
func buildAttachmentFilename(originalFilename, attachmentID string, index int) string {
	// Parse out any existing index
	existingIdx, nameWithoutIndex := parseAttachmentFilename(originalFilename)

	// Use the existing index if present and valid, otherwise use the provided index
	finalIndex := index
	if existingIdx > 0 {
		finalIndex = existingIdx
	}

	// Check if the name already ends with the attachment ID
	ext := filepath.Ext(nameWithoutIndex)
	nameWithoutExt := strings.TrimSuffix(nameWithoutIndex, ext)

	// If the filename already contains the ID, don't add it again
	if strings.HasSuffix(nameWithoutExt, "-"+attachmentID) {
		return fmt.Sprintf("%02d-%s", finalIndex, nameWithoutIndex)
	}

	// Build the new filename: NN-name-id.ext
	return fmt.Sprintf("%02d-%s-%s%s", finalIndex, nameWithoutExt, attachmentID, ext)
}

// detectContentType returns the MIME type based on file extension.
func detectContentType(filename string) string {
	ext := filepath.Ext(filename)
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	return "application/octet-stream"
}
