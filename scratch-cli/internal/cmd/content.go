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
	"time"

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
	contentCmd.AddCommand(contentDirtyFieldsCmd)
	contentCmd.AddCommand(contentDiffCmd)
	contentCmd.AddCommand(contentDiffFieldsCmd)
	contentCmd.AddCommand(contentUploadCmd)

	// Flags for content download
	contentDownloadCmd.Flags().Bool("clobber", false, "Delete existing files and re-download fresh")
	contentDownloadCmd.Flags().Bool("no-attachments", false, "Skip downloading attachments")

	// Flags for content dirty-fields
	contentDirtyFieldsCmd.Flags().String("file", "", "Check a specific file only")

	// Flags for content diff
	contentDiffCmd.Flags().String("file", "", "Show diff for a specific file only")

	// Flags for content diff-fields
	contentDiffFieldsCmd.Flags().String("file", "", "Show field diffs for a specific file only")

	// Flags for content upload
	contentUploadCmd.Flags().Bool("no-review", false, "Skip confirmation prompt")
	contentUploadCmd.Flags().Bool("sync-deletes", false, "Delete remote records that are missing locally")
	contentUploadCmd.Flags().Bool("simulate", false, "Output operations to a text file instead of uploading")
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
	for _, tableName := range tablesToDownload {
		opts := download.Options{
			Clobber:             clobber,
			DownloadAttachments: !noAttachments,
			OnProgress:          func(msg string) { fmt.Println(msg) },
		}
		if _, err := downloader.Download(tableName, opts); err != nil {
			fmt.Printf("❌ Error downloading '%s': %v\n", tableName, err)
			continue
		}
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
					switch change.Type {
					case "removed":
						fmt.Printf("  %s- %s%s\n", colorRed, change.Filename, colorReset)
					case "added":
						fmt.Printf("  %s+ %s%s\n", colorGreen, change.Filename, colorReset)
					case "modified":
						fmt.Printf("  %s~ %s%s\n", colorOrange, change.Filename, colorReset)
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
			switch change.Type {
			case "removed":
				fmt.Printf("    %s- %s%s\n", colorRed, change.Filename, colorReset)
			case "added":
				fmt.Printf("    %s+ %s%s\n", colorGreen, change.Filename, colorReset)
			case "modified":
				fmt.Printf("    %s~ %s%s\n", colorOrange, change.Filename, colorReset)
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
	RemoteID      string                 // The remote ID from frontmatter (for update/delete)
	ChangedFields []string               // List of changed fields (for create/update)
	FieldValues   map[string]interface{} // Field name -> new value (for create/update)

}

func runContentUpload(cmd *cobra.Command, args []string) error {
	noReview, _ := cmd.Flags().GetBool("no-review")
	syncDeletes, _ := cmd.Flags().GetBool("sync-deletes")
	simulate, _ := cmd.Flags().GetBool("simulate")

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
		var changes []UploadChange
		if fileName != "" {
			// Single file mode
			change, err := getSingleFileChange(table, originalDir, fileName, contentFieldName)
			if err != nil {
				return err
			}
			if change != nil {
				changes = append(changes, *change)
			}
		} else {
			// Folder mode
			changes, err = getFolderChanges(table, originalDir, contentFieldName, syncDeletes)
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
	for _, tc := range allTableChanges {
		if tc.tableConfig == nil {
			fmt.Printf("❌ Skipping '%s': no table config found\n", tc.tableName)
			continue
		}

		// Get the account for this table
		account := cfg.GetAccountByID(tc.tableConfig.AccountID)
		if account == nil {
			fmt.Printf("❌ Skipping '%s': account not found\n", tc.tableName)
			continue
		}

		// Get the authentication properties
		authProps := secrets.GetSecretProperties(account.ID)
		if len(authProps) == 0 {
			fmt.Printf("❌ Skipping '%s': no credentials found for account '%s'\n", tc.tableName, account.Name)
			continue
		}

		s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
		s.Suffix = fmt.Sprintf(" Uploading changes for '%s'...", tc.tableName)
		s.Start()

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

			// Build data map, excluding remoteId
			// For updates, only include changed fields
			var data map[string]interface{}
			switch change.Operation {
			case "update":
				data = make(map[string]interface{})
				for _, field := range change.ChangedFields {
					// Strip suffix like " (added)" or " (removed)" from field names
					cleanField := strings.TrimSuffix(strings.TrimSuffix(field, " (added)"), " (removed)")
					if cleanField != "remoteId" {
						if val, ok := change.FieldValues[cleanField]; ok {
							data[cleanField] = val
						}
					}
				}
			case "create":
				data = make(map[string]interface{})
				for k, v := range change.FieldValues {
					if k != "remoteId" {
						data[k] = v
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
		s.Stop()
		if err != nil {
			fmt.Printf("❌ Error uploading to '%s': %v\n", tc.tableName, err)
			continue
		}

		// Report results and update local file system for each file
		originalDir := filepath.Join(".scratchmd", tc.tableName, "original")
		for _, result := range resp.Results {
			if result.Error != "" {
				fmt.Printf("  %s❌ %s: %s%s\n", colorRed, result.Filename, result.Error, colorReset)
				continue
			}

			// Get just the filename from the full path (e.g., "blog-posts/post.md" -> "post.md")
			_, fileName := filepath.Split(result.Filename)
			currentPath := result.Filename
			originalPath := filepath.Join(originalDir, fileName)

			switch result.Op {
			case "create":
				fmt.Printf("  %s✓ %s (created, id: %s)%s\n", colorGreen, result.Filename, result.ID, colorReset)
				// Update the current file to add the remoteId to frontmatter
				if err := addRemoteIDToFile(currentPath, result.ID); err != nil {
					fmt.Printf("    ⚠️  Failed to update remoteId: %v\n", err)
				}
				// Copy the updated current file to the original folder
				if err := copyFile(currentPath, originalPath); err != nil {
					fmt.Printf("    ⚠️  Failed to sync original: %v\n", err)
				}
			case "update":
				fmt.Printf("  %s✓ %s (updated)%s\n", colorGreen, result.Filename, colorReset)
				// Copy the current file to the original folder
				if err := copyFile(currentPath, originalPath); err != nil {
					fmt.Printf("    ⚠️  Failed to sync original: %v\n", err)
				}
			case "delete":
				fmt.Printf("  %s✓ %s (deleted)%s\n", colorGreen, result.Filename, colorReset)
				// Delete the original file (current file already doesn't exist for deletes)
				if err := os.Remove(originalPath); err != nil && !os.IsNotExist(err) {
					fmt.Printf("    ⚠️  Failed to remove original: %v\n", err)
				}
			}
		}
	}

	fmt.Println("Upload complete.")

	return nil
}

// getSingleFileChange detects what changed for a single file by comparing against its original.
//
// Returns nil if no changes detected. Determines operation type (create/update/delete) by
// checking file existence in current vs original directories. For updates, only changed
// fields are included in the result.
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
		// Get remoteId from the original file for delete operations
		originalFields, err := parseMarkdownFile(originalPath, contentFieldName)
		if err != nil {
			return nil, fmt.Errorf("failed to parse original file: %w", err)
		}
		return &UploadChange{
			Operation: "delete",
			Filename:  fullFileName,
			RemoteID:  originalFields["remoteId"],
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
			RemoteID:      currentFields["remoteId"],
			ChangedFields: fields,
			FieldValues:   stringMapToInterface(currentFields),
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
		RemoteID:      currentFields["remoteId"],
		ChangedFields: changedFields,
		FieldValues:   stringMapToInterface(currentFields),
	}, nil
}

// getFolderChanges scans a folder and detects all changes compared to original copies.
//
// Compares .md files in tableName/ against .scratchmd/<tableName>/original/ to find:
// - Deleted: files in original but not in current (only if includeDeletes=true)
// - Created: files in current but not in original
// - Updated: files in both with different content
//
// Results are sorted by operation (delete, create, update) then filename.
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
				originalPath := filepath.Join(originalDir, filename)
				originalFields, err := parseMarkdownFile(originalPath, contentFieldName)
				if err != nil {
					continue
				}
				changes = append(changes, UploadChange{
					Operation: "delete",
					Filename:  filepath.Join(tableName, filename),
					RemoteID:  originalFields["remoteId"],
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
				RemoteID:      currentFields["remoteId"],
				ChangedFields: fields,
				FieldValues:   stringMapToInterface(currentFields),
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
					RemoteID:      currentFields["remoteId"],
					ChangedFields: changedFields,
					FieldValues:   stringMapToInterface(currentFields),
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

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	content, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, content, 0644)
}

// addRemoteIDToFile injects or updates the remoteId field in YAML frontmatter.
//
// Called after a successful create operation to link the local file with its CMS record.
// If the file has no frontmatter, creates one with just remoteId. If frontmatter exists,
// parses and re-marshals it to add/update the remoteId field.
func addRemoteIDToFile(filePath, remoteID string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	contentStr := string(content)

	// Check for existing YAML frontmatter
	if !strings.HasPrefix(contentStr, "---") {
		// No frontmatter, add it with remoteId
		newContent := fmt.Sprintf("---\nremoteId: %s\n---\n%s", remoteID, contentStr)
		return os.WriteFile(filePath, []byte(newContent), 0644)
	}

	// Find the end of frontmatter
	rest := contentStr[3:] // Skip initial ---
	endIndex := strings.Index(rest, "\n---")
	if endIndex == -1 {
		// Malformed frontmatter, add remoteId at the start
		newContent := fmt.Sprintf("---\nremoteId: %s\n---\n%s", remoteID, contentStr)
		return os.WriteFile(filePath, []byte(newContent), 0644)
	}

	yamlContent := rest[:endIndex]
	markdownContent := rest[endIndex+4:] // Skip \n---

	// Parse existing YAML
	var yamlData map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &yamlData); err != nil {
		return fmt.Errorf("failed to parse YAML frontmatter: %w", err)
	}

	// Add or update remoteId
	yamlData["remoteId"] = remoteID

	// Marshal back to YAML
	newYAML, err := yaml.Marshal(yamlData)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	// Reconstruct the file
	newContent := fmt.Sprintf("---\n%s---\n%s", string(newYAML), strings.TrimPrefix(markdownContent, "\n"))
	return os.WriteFile(filePath, []byte(newContent), 0644)
}

// AttachmentChange represents a change to an attachment file
type AttachmentChange struct {
	Filename string // The filename of the attachment
	Type     string // "added", "removed", or "modified"
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
			changes = append(changes, AttachmentChange{
				Filename: filename,
				Type:     "added",
			})
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
				changes = append(changes, AttachmentChange{
					Filename: filename,
					Type:     "modified",
				})
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
