// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"encoding/json"
	"fmt"

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

func init() {
	rootCmd.AddCommand(workbookCmd)
	workbookCmd.AddCommand(workbookListCmd)

	// Flags for workbook list
	workbookListCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
	workbookListCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")
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
