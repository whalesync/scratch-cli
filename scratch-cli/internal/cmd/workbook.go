// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// workbookCmd represents the workbook command
var workbookCmd = &cobra.Command{
	Use:   "workbook",
	Short: "Manage workbooks",
	Long: `Manage workbooks in Scratch.md.

Workbooks are containers that hold your content organized into folders.
This command helps you list and manage workbooks that support the CLI workflow.`,
}

// workbookListCmd represents the workbook list command
var workbookListCmd = &cobra.Command{
	Use:   "list",
	Short: "[NON-INTERACTIVE] List workbooks",
	Long: `[NON-INTERACTIVE - safe for LLM use]

List workbooks that are compatible with the CLI workflow (DataFolders system).

This includes:
- Workbooks that have at least one data folder
- Empty workbooks that can be used with the CLI

Requires authentication. Run 'scratchmd auth login' first.`,
	RunE: runWorkbookList,
}

// workbookPullCmd represents the workbook pull command
var workbookPullCmd = &cobra.Command{
	Use:   "pull <workbook-id>",
	Short: "[NON-INTERACTIVE] Pull records from a data folder's remote service",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Triggers a pull job that fetches records from a data folder's connector
into the workbook's database and Git repository.

This command:
1. Starts a background pull job on the server
2. Polls for job progress every 2 seconds
3. Displays progress until the job completes or fails

Requires authentication. Run 'scratchmd auth login' first.

Example:
  scratchmd workbook pull wb_abc123 --folder dfd_xyz789
  scratchmd workbook pull wb_abc123 --folder dfd_xyz789 --json`,
	Args: cobra.ExactArgs(1),
	RunE: runWorkbookPull,
}

func init() {
	rootCmd.AddCommand(workbookCmd)
	workbookCmd.AddCommand(workbookListCmd)
	workbookCmd.AddCommand(workbookPullCmd)

	// Flags for workbook list
	workbookListCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	workbookListCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")

	// Flags for workbook pull
	workbookPullCmd.Flags().String("folder", "", "Data folder ID to pull (required)")
	workbookPullCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	workbookPullCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")
	_ = workbookPullCmd.MarkFlagRequired("folder")
}

func runWorkbookList(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")
	serverURL, _ := cmd.Flags().GetString("server")

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
		if jsonOutput {
			output := map[string]interface{}{
				"error": "Not logged in. Run 'scratchmd auth login' first.",
			}
			data, _ := json.MarshalIndent(output, "", "  ")
			fmt.Println(string(data))
			return fmt.Errorf("not logged in")
		}
		return fmt.Errorf("not logged in. Run 'scratchmd auth login' first")
	}

	// Load credentials
	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		if jsonOutput {
			output := map[string]interface{}{
				"error": fmt.Sprintf("Failed to load credentials: %s", err.Error()),
			}
			data, _ := json.MarshalIndent(output, "", "  ")
			fmt.Println(string(data))
		}
		return fmt.Errorf("failed to load credentials: %w", err)
	}

	// Create API client with authentication
	client := api.NewClient(
		api.WithBaseURL(serverURL),
		api.WithAPIToken(creds.APIToken),
	)

	// Fetch workbooks
	workbooks, err := client.ListWorkbooks()
	if err != nil {
		if jsonOutput {
			output := map[string]interface{}{
				"error": fmt.Sprintf("Failed to list workbooks: %s", err.Error()),
			}
			data, _ := json.MarshalIndent(output, "", "  ")
			fmt.Println(string(data))
		}
		return fmt.Errorf("failed to list workbooks: %w", err)
	}

	// Output results
	if jsonOutput {
		data, err := json.MarshalIndent(workbooks, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal response: %w", err)
		}
		fmt.Println(string(data))
		return nil
	}

	// Human-readable output
	if len(workbooks) == 0 {
		fmt.Println()
		fmt.Println("No workbooks found.")
		fmt.Println()
		fmt.Println("Create a workbook at https://app.scratch.md to get started.")
		return nil
	}

	fmt.Println()
	fmt.Printf("Workbooks (%d total)\n", len(workbooks))
	fmt.Println()

	for _, wb := range workbooks {
		folderInfo := ""
		folderCount := len(wb.DataFolders)
		if folderCount > 0 {
			if folderCount == 1 {
				folderInfo = " (1 folder)"
			} else {
				folderInfo = fmt.Sprintf(" (%d folders)", folderCount)
			}
		}
		fmt.Printf("  %s  %s%s\n", wb.ID, wb.Name, folderInfo)
	}

	fmt.Println()
	fmt.Println("Use 'scratchmd workbook <id> ...' to work with a specific workbook.")
	fmt.Println()

	return nil
}

// PullResult represents the result of a workbook pull operation for JSON output.
type PullResult struct {
	Success    bool                   `json:"success"`
	WorkbookID string                 `json:"workbookId"`
	FolderID   string                 `json:"folderId"`
	JobID      string                 `json:"jobId,omitempty"`
	State      string                 `json:"state,omitempty"`
	TotalFiles int                    `json:"totalFiles,omitempty"`
	Progress   *api.JobStatusProgress `json:"progress,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

func runWorkbookPull(cmd *cobra.Command, args []string) error {
	workbookID := args[0]
	folderID, _ := cmd.Flags().GetString("folder")
	jsonOutput, _ := cmd.Flags().GetBool("json")
	serverURL, _ := cmd.Flags().GetString("server")

	// Validate folder ID is not empty
	if folderID == "" {
		if jsonOutput {
			result := PullResult{
				Success:    false,
				WorkbookID: workbookID,
				Error:      "Folder ID cannot be empty",
			}
			data, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(data))
		}
		return fmt.Errorf("folder ID cannot be empty")
	}

	// Use default or config server URL
	if serverURL == "" {
		cfg, err := config.LoadConfig()
		if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
			serverURL = cfg.Settings.ScratchServerURL
		} else {
			serverURL = api.DefaultScratchServerURL
		}
	}

	// Helper to output errors
	outputError := func(err string) error {
		if jsonOutput {
			result := PullResult{
				Success:    false,
				WorkbookID: workbookID,
				FolderID:   folderID,
				Error:      err,
			}
			data, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(data))
		}
		return fmt.Errorf("%s", err)
	}

	// Check if logged in
	if !config.IsLoggedIn(serverURL) {
		return outputError("Not logged in. Run 'scratchmd auth login' first.")
	}

	// Load credentials
	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return outputError(fmt.Sprintf("Failed to load credentials: %s", err.Error()))
	}

	// Create API client with authentication
	client := api.NewClient(
		api.WithBaseURL(serverURL),
		api.WithAPIToken(creds.APIToken),
	)

	// Trigger the pull
	if !jsonOutput {
		fmt.Printf("Starting pull for folder %s in workbook %s...\n", folderID, workbookID)
	}

	triggerResp, err := client.TriggerWorkbookPull(workbookID, &api.TriggerPullRequest{
		DataFolderID: folderID,
	})
	if err != nil {
		return outputError(fmt.Sprintf("Failed to trigger pull: %s", err.Error()))
	}

	if triggerResp.Error != "" {
		return outputError(triggerResp.Error)
	}

	if triggerResp.JobID == "" {
		return outputError("Server returned empty job ID")
	}

	jobID := triggerResp.JobID
	if !jsonOutput {
		fmt.Printf("Job started: %s\n", jobID)
	}

	// Poll for job status
	pollInterval := 2 * time.Second
	maxPollDuration := 2 * time.Minute
	startTime := time.Now()
	var lastState string
	var lastTotalFiles int

	for {
		// Check for timeout
		if time.Since(startTime) > maxPollDuration {
			return outputError(fmt.Sprintf("Timeout after %v waiting for job to complete", maxPollDuration))
		}
		statusResp, err := client.GetJobStatus(jobID)
		if err != nil {
			return outputError(fmt.Sprintf("Failed to get job status: %s", err.Error()))
		}

		if statusResp.Error != "" {
			return outputError(statusResp.Error)
		}

		state := statusResp.State
		totalFiles := 0
		if statusResp.Progress != nil {
			totalFiles = statusResp.Progress.TotalFiles
		}

		// Update display for human-readable output
		if !jsonOutput {
			if state != lastState || totalFiles != lastTotalFiles {
				if statusResp.Progress != nil && len(statusResp.Progress.Folders) > 0 {
					// Show progress for each folder
					for _, folder := range statusResp.Progress.Folders {
						fmt.Printf("  Status: %s | Folder: %s | Files: %d\n",
							folder.Status, folder.Name, folder.Files)
					}
				} else {
					fmt.Printf("  Status: %s | Files: %d\n", state, totalFiles)
				}
				lastState = state
				lastTotalFiles = totalFiles
			}
		}

		// Check for terminal states
		if state == "completed" {
			if jsonOutput {
				result := PullResult{
					Success:    true,
					WorkbookID: workbookID,
					FolderID:   folderID,
					JobID:      jobID,
					State:      state,
					TotalFiles: totalFiles,
					Progress:   statusResp.Progress,
				}
				data, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(data))
			} else {
				fmt.Println()
				fmt.Printf("Pull completed! Fetched %d files.\n", totalFiles)
			}
			return nil
		}

		if state == "failed" {
			errMsg := "Job failed"
			if statusResp.FailedReason != "" {
				errMsg = statusResp.FailedReason
			}
			if jsonOutput {
				result := PullResult{
					Success:    false,
					WorkbookID: workbookID,
					FolderID:   folderID,
					JobID:      jobID,
					State:      state,
					TotalFiles: totalFiles,
					Progress:   statusResp.Progress,
					Error:      errMsg,
				}
				data, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(data))
			}
			return fmt.Errorf("pull failed: %s", errMsg)
		}

		time.Sleep(pollInterval)
	}
}
