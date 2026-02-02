// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
)

// statusCmd shows which files have changed across all linked tables
var statusCmd = &cobra.Command{
	Use:   "status [folder[/file.json]]",
	Short: "[NON-INTERACTIVE] Check changes (-> push if changes)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Show which files differ from the original downloaded versions.

Without arguments, shows status for all linked tables.
With a folder argument, shows status for that specific table only.
With a folder/file.json argument, shows status for that specific file only.

Reports:
  - Deleted files (exist in original but not in folder) in red
  - Created files (exist in folder but not in original) in green
  - Modified files (content differs from original) in orange

Flags:
  --no-global-summary   Don't show "Linked folders: N" line (global mode only)
  --no-table-summary    Don't show per-table counts (folder/global mode only)
  --no-file-status      Don't list individual files, only summaries (error if file mode)

Examples:
  scratchmd status                          # check all linked tables
  scratchmd status blog-posts               # check one table
  scratchmd status blog-posts/post-1.json   # check one file
  scratchmd status --no-file-status         # only show summaries`,
	RunE: runStatus,
}

func init() {
	rootCmd.AddCommand(statusCmd)

	statusCmd.Flags().Bool("no-global-summary", false, "Don't show the 'Linked folders: N' line (ignored for folder/file level)")
	statusCmd.Flags().Bool("no-table-summary", false, "Don't show per-table summary counts (ignored for file level)")
	statusCmd.Flags().Bool("no-file-status", false, "Don't list individual file statuses (error if used with file level)")
	statusCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
}

// tableStatus holds the status results for a single table
type tableStatus struct {
	tableName    string
	modified     []string
	added        []string
	deleted      []string
	unchanged    int
	lastDownload string // RFC3339 timestamp
	err          error
}

func runStatus(cmd *cobra.Command, args []string) error {
	noGlobalSummary, _ := cmd.Flags().GetBool("no-global-summary")
	noTableSummary, _ := cmd.Flags().GetBool("no-table-summary")
	noFileStatus, _ := cmd.Flags().GetBool("no-file-status")
	jsonOutput, _ := cmd.Flags().GetBool("json")

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

	// File-level mode
	if fileName != "" {
		if noFileStatus {
			return fmt.Errorf("--no-file-status cannot be used when checking a specific file")
		}
		return runSingleFileStatus(tableName, fileName, jsonOutput)
	}

	// Get list of tables to check
	var tablesToCheck []string
	isGlobalMode := tableName == ""

	if tableName != "" {
		// Check specific folder
		tablesToCheck = []string{tableName}
	} else {
		// Check all configured tables
		tables, err := config.ListConfiguredTables(".")
		if err != nil {
			return fmt.Errorf("failed to list tables: %w", err)
		}
		if len(tables) == 0 {
			if jsonOutput {
				// Count accounts for state info
				accountCount := 0
				if cfg, err := config.LoadConfig(); err == nil && cfg != nil {
					accountCount = len(cfg.Accounts)
				}

				// Build response with state and nextActions
				type stateInfo struct {
					Accounts       int `json:"accounts"`
					LinkedFolders  int `json:"linkedFolders"`
					PendingChanges int `json:"pendingChanges"`
				}
				type nextAction struct {
					Action string `json:"action"`
					Reason string `json:"reason"`
				}
				type emptyStatusOutput struct {
					State       stateInfo    `json:"state"`
					Folders     []struct{}   `json:"folders"`
					HasChanges  bool         `json:"hasChanges"`
					NextActions []nextAction `json:"nextActions,omitempty"`
				}

				output := emptyStatusOutput{
					State: stateInfo{
						Accounts:       accountCount,
						LinkedFolders:  0,
						PendingChanges: 0,
					},
					Folders:    []struct{}{},
					HasChanges: false,
				}

				// Add appropriate next action
				if accountCount == 0 {
					output.NextActions = []nextAction{{
						Action: "account add",
						Reason: "No accounts configured",
					}}
				} else {
					output.NextActions = []nextAction{{
						Action: "folder link",
						Reason: "No folders linked to CMS tables",
					}}
				}

				jsonBytes, _ := json.MarshalIndent(output, "", "  ")
				fmt.Println(string(jsonBytes))
				return nil
			}
			fmt.Println("No tables configured.")
			fmt.Println("Run 'scratchmd setup' and select 'Set up tables' first.")
			return nil
		}
		tablesToCheck = tables
	}

	// JSON output mode - collect all results and output at once
	if jsonOutput {
		type fileChange struct {
			File   string `json:"file"`
			Status string `json:"status"`
		}
		type folderStatus struct {
			Name         string       `json:"name"`
			LastDownload string       `json:"lastDownload,omitempty"`
			Created      int          `json:"created"`
			Updated      int          `json:"updated"`
			Deleted      int          `json:"deleted"`
			Unchanged    int          `json:"unchanged"`
			Changes      []fileChange `json:"changes,omitempty"`
			Error        string       `json:"error,omitempty"`
		}
		type stateInfo struct {
			Accounts       int `json:"accounts"`
			LinkedFolders  int `json:"linkedFolders"`
			PendingChanges int `json:"pendingChanges"`
		}
		type nextAction struct {
			Action string `json:"action"`
			Reason string `json:"reason"`
		}
		type statusOutput struct {
			State       stateInfo      `json:"state"`
			Folders     []folderStatus `json:"folders"`
			HasChanges  bool           `json:"hasChanges"`
			NextActions []nextAction   `json:"nextActions,omitempty"`
		}

		// Count accounts
		accountCount := 0
		if cfg, err := config.LoadConfig(); err == nil && cfg != nil {
			accountCount = len(cfg.Accounts)
		}

		output := statusOutput{
			State: stateInfo{
				Accounts:       accountCount,
				LinkedFolders:  len(tablesToCheck),
				PendingChanges: 0,
			},
			Folders:    []folderStatus{},
			HasChanges: false,
		}

		totalPendingChanges := 0
		foldersWithContent := 0

		for _, table := range tablesToCheck {
			status := getTableStatus(table)
			fs := folderStatus{
				Name:      table,
				Created:   len(status.added),
				Updated:   len(status.modified),
				Deleted:   len(status.deleted),
				Unchanged: status.unchanged,
			}

			if status.err != nil {
				fs.Error = status.err.Error()
			} else {
				fs.LastDownload = status.lastDownload

				// Track folders with content
				if status.unchanged > 0 || len(status.modified) > 0 || len(status.added) > 0 || len(status.deleted) > 0 {
					foldersWithContent++
				}

				// Collect changes
				var changes []fileChange
				for _, f := range status.deleted {
					changes = append(changes, fileChange{File: f, Status: "deleted"})
				}
				for _, f := range status.added {
					changes = append(changes, fileChange{File: f, Status: "created"})
				}
				for _, f := range status.modified {
					changes = append(changes, fileChange{File: f, Status: "modified"})
				}
				if len(changes) > 0 {
					fs.Changes = changes
					output.HasChanges = true
					totalPendingChanges += len(changes)
				}
			}

			output.Folders = append(output.Folders, fs)
		}

		output.State.PendingChanges = totalPendingChanges

		// Build nextActions based on current state
		var nextActions []nextAction

		if accountCount == 0 {
			nextActions = append(nextActions, nextAction{
				Action: "account add",
				Reason: "No accounts configured",
			})
		} else if len(tablesToCheck) == 0 {
			nextActions = append(nextActions, nextAction{
				Action: "folder link",
				Reason: "No folders linked to CMS tables",
			})
		} else if foldersWithContent == 0 {
			nextActions = append(nextActions, nextAction{
				Action: "pull",
				Reason: "Folders linked but no content downloaded yet",
			})
		} else if totalPendingChanges > 0 {
			nextActions = append(nextActions, nextAction{
				Action: "push",
				Reason: fmt.Sprintf("%d file(s) have local changes", totalPendingChanges),
			})
		}

		if len(nextActions) > 0 {
			output.NextActions = nextActions
		}

		jsonBytes, _ := json.MarshalIndent(output, "", "  ")
		fmt.Println(string(jsonBytes))
		return nil
	}

	// Show global summary if in global mode
	if isGlobalMode && !noGlobalSummary {
		fmt.Printf("Linked folders: %d\n", len(tablesToCheck))
	}

	hasChanges := false

	for _, table := range tablesToCheck {
		status := getTableStatus(table)

		if status.err != nil {
			fmt.Printf("%s\n", status.err)
			continue
		}

		// Skip tables with no changes
		if len(status.modified) == 0 && len(status.added) == 0 && len(status.deleted) == 0 {
			continue
		}

		hasChanges = true

		// Print table header
		fmt.Printf("-- Folder: %s --\n", table)

		// Print last download time if available
		if status.lastDownload != "" {
			if t, err := time.Parse(time.RFC3339, status.lastDownload); err == nil {
				ago := formatTimeAgo(t)
				fmt.Printf("Last download: %s (%s)\n", t.Format("2006-01-02 15:04:05"), ago)
			}
		}

		// Print summary counts
		if !noTableSummary {
			total := len(status.added) + len(status.modified) + len(status.deleted) + status.unchanged
			// Find width needed for alignment (based on largest number)
			width := len(fmt.Sprintf("%d", total))

			// Print with colors for non-zero counts
			if len(status.added) > 0 {
				fmt.Printf("created:   %s%*d%s\n", colorGreen, width, len(status.added), colorReset)
			} else {
				fmt.Printf("created:   %*d\n", width, len(status.added))
			}
			if len(status.modified) > 0 {
				fmt.Printf("updated:   %s%*d%s\n", colorOrange, width, len(status.modified), colorReset)
			} else {
				fmt.Printf("updated:   %*d\n", width, len(status.modified))
			}
			if len(status.deleted) > 0 {
				fmt.Printf("deleted:   %s%*d%s\n", colorRed, width, len(status.deleted), colorReset)
			} else {
				fmt.Printf("deleted:   %*d\n", width, len(status.deleted))
			}
			fmt.Printf("unchanged: %*d\n", width, status.unchanged)
			fmt.Printf("TOTAL:     %*d\n", width, total)
		}

		// Print individual file statuses unless suppressed
		if !noFileStatus {
			// Show deleted first (red)
			for _, f := range status.deleted {
				fmt.Printf("%s%s (deleted)%s\n", colorRed, f, colorReset)
			}

			// Show created (green)
			for _, f := range status.added {
				fmt.Printf("%s%s (created)%s\n", colorGreen, f, colorReset)
			}

			// Show modified (orange)
			for _, f := range status.modified {
				fmt.Printf("%s%s (modified)%s\n", colorOrange, f, colorReset)
			}
		}
	}

	if !hasChanges {
		fmt.Println("No changes detected.")
	}

	return nil
}

// formatTimeAgo returns a human-readable "X ago" string
func formatTimeAgo(t time.Time) string {
	duration := time.Since(t)

	if duration < time.Minute {
		return "just now"
	} else if duration < time.Hour {
		mins := int(duration.Minutes())
		if mins == 1 {
			return "1 minute ago"
		}
		return fmt.Sprintf("%d minutes ago", mins)
	} else if duration < 24*time.Hour {
		hours := int(duration.Hours())
		if hours == 1 {
			return "1 hour ago"
		}
		return fmt.Sprintf("%d hours ago", hours)
	} else {
		days := int(duration.Hours() / 24)
		if days == 1 {
			return "1 day ago"
		}
		return fmt.Sprintf("%d days ago", days)
	}
}

// getTableStatus computes the status for a single table
func getTableStatus(tableName string) tableStatus {
	status := tableStatus{tableName: tableName}

	// Check that the table folder exists
	if _, err := os.Stat(tableName); os.IsNotExist(err) {
		status.err = fmt.Errorf("Folder '%s' does not exist", tableName)
		return status
	}

	// Check that the original folder exists
	originalDir := filepath.Join(".scratchmd", tableName, "original")
	if _, err := os.Stat(originalDir); os.IsNotExist(err) {
		status.err = fmt.Errorf("No original data for '%s'. Run 'scratchmd content download %s' first.", tableName, tableName)
		return status
	}

	// Load table config to get lastDownload
	tableConfig, err := config.LoadTableConfig(tableName)
	if err == nil && tableConfig != nil {
		status.lastDownload = tableConfig.LastDownload
	}

	// Check if provider supports attachments and get attachment fields
	var attachmentFields []string
	if tableConfig != nil {
		provider, err := providers.GetProvider(tableConfig.Provider)
		if err == nil && provider.SupportsAttachments() {
			schema, err := config.LoadTableSchema(tableName)
			if err == nil && schema != nil {
				attachmentFields = getAttachmentFieldsFromSchema(schema)
			}
		}
	}

	// Get list of .json files in both directories
	currentFiles := make(map[string]bool)
	originalFiles := make(map[string]bool)

	// Read current folder
	entries, err := os.ReadDir(tableName)
	if err != nil {
		status.err = fmt.Errorf("Failed to read folder '%s': %v", tableName, err)
		return status
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			currentFiles[entry.Name()] = true
		}
	}

	// Read original folder
	entries, err = os.ReadDir(originalDir)
	if err != nil {
		status.err = fmt.Errorf("Failed to read original folder for '%s': %v", tableName, err)
		return status
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			originalFiles[entry.Name()] = true
		}
	}

	// Check for modified, unchanged, and deleted files
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

			isModified := !bytes.Equal(currentContent, originalContent)

			// Also check for attachment changes if provider supports them
			if !isModified && len(attachmentFields) > 0 {
				fileSlug := strings.TrimSuffix(filename, ".json")
				if hasAttachmentChanges(tableName, originalDir, fileSlug, attachmentFields) {
					isModified = true
				}
			}

			if isModified {
				status.modified = append(status.modified, filename)
			} else {
				status.unchanged++
			}
		} else {
			// File only in original - deleted
			status.deleted = append(status.deleted, filename)
		}
	}

	// Check for added files
	for filename := range currentFiles {
		if !originalFiles[filename] {
			status.added = append(status.added, filename)
		}
	}

	// Sort for consistent output
	sort.Strings(status.modified)
	sort.Strings(status.added)
	sort.Strings(status.deleted)

	return status
}

// runSingleFileStatus checks the status of a single file
func runSingleFileStatus(tableName, fileName string, jsonOutput bool) error {
	// Check that the table folder exists
	if _, err := os.Stat(tableName); os.IsNotExist(err) {
		return fmt.Errorf("folder '%s' does not exist", tableName)
	}

	originalDir := filepath.Join(".scratchmd", tableName, "original")
	if _, err := os.Stat(originalDir); os.IsNotExist(err) {
		return fmt.Errorf("original folder '%s' does not exist. Run 'content download %s' first", originalDir, tableName)
	}

	currentPath := filepath.Join(tableName, fileName)
	originalPath := filepath.Join(originalDir, fileName)

	currentExists := true
	if _, err := os.Stat(currentPath); os.IsNotExist(err) {
		currentExists = false
	}

	originalExists := true
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		originalExists = false
	}

	if !currentExists && !originalExists {
		return fmt.Errorf("file '%s' not found in either location", fileName)
	}

	// Helper for JSON output
	outputFileStatus := func(file, status string) {
		if jsonOutput {
			type fileStatus struct {
				File   string `json:"file"`
				Status string `json:"status"`
			}
			output, _ := json.MarshalIndent(fileStatus{File: file, Status: status}, "", "  ")
			fmt.Println(string(output))
		} else {
			switch status {
			case "created":
				fmt.Printf("%s%s (created)%s\n", colorGreen, file, colorReset)
			case "deleted":
				fmt.Printf("%s%s (deleted)%s\n", colorRed, file, colorReset)
			case "modified":
				fmt.Printf("%s%s (modified)%s\n", colorOrange, file, colorReset)
			default:
				fmt.Printf("%s (clean)\n", file)
			}
		}
	}

	if !originalExists {
		outputFileStatus(fileName, "created")
		return nil
	}

	if !currentExists {
		outputFileStatus(fileName, "deleted")
		return nil
	}

	// Both exist - compare content
	currentContent, err := os.ReadFile(currentPath)
	if err != nil {
		return fmt.Errorf("failed to read current file: %w", err)
	}
	originalContent, err := os.ReadFile(originalPath)
	if err != nil {
		return fmt.Errorf("failed to read original file: %w", err)
	}

	isModified := !bytes.Equal(currentContent, originalContent)

	// Also check for attachment changes if provider supports them
	if !isModified {
		tableConfig, err := config.LoadTableConfig(tableName)
		if err == nil && tableConfig != nil {
			provider, err := providers.GetProvider(tableConfig.Provider)
			if err == nil && provider.SupportsAttachments() {
				schema, err := config.LoadTableSchema(tableName)
				if err == nil && schema != nil {
					attachmentFields := getAttachmentFieldsFromSchema(schema)
					if len(attachmentFields) > 0 {
						fileSlug := strings.TrimSuffix(fileName, ".json")
						if hasAttachmentChanges(tableName, originalDir, fileSlug, attachmentFields) {
							isModified = true
						}
					}
				}
			}
		}
	}

	if isModified {
		outputFileStatus(fileName, "modified")
	} else {
		outputFileStatus(fileName, "clean")
	}

	return nil
}
