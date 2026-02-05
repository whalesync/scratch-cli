package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// workbooksCmd represents the workbooks command
var workbooksCmd = &cobra.Command{
	Use:   "workbooks",
	Short: "Manage workbooks",
	Long: `Manage your workbooks in Scratch.md.

Commands:
  workbooks list      List all workbooks
  workbooks create    Create a new workbook
  workbooks show      Show workbook details
  workbooks delete    Delete a workbook`,
}

// workbooksListCmd represents the workbooks list command
var workbooksListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all workbooks",
	Long:  `List all workbooks for your account.`,
	RunE:  runWorkbooksList,
}

// workbooksCreateCmd represents the workbooks create command
var workbooksCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new workbook",
	Long:  `Create a new workbook in your account.`,
	RunE:  runWorkbooksCreate,
}

// workbooksShowCmd represents the workbooks show command
var workbooksShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show workbook details",
	Long:  `Show details for a specific workbook.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runWorkbooksShow,
}

// workbooksDeleteCmd represents the workbooks delete command
var workbooksDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a workbook",
	Long:  `Delete a workbook from your account.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runWorkbooksDelete,
}

func init() {
	rootCmd.AddCommand(workbooksCmd)
	workbooksCmd.AddCommand(workbooksListCmd)
	workbooksCmd.AddCommand(workbooksCreateCmd)
	workbooksCmd.AddCommand(workbooksShowCmd)
	workbooksCmd.AddCommand(workbooksDeleteCmd)

	// Flags for workbooks list
	workbooksListCmd.Flags().String("sort-by", "createdAt", "Sort by field (name, createdAt, updatedAt)")
	workbooksListCmd.Flags().String("sort-order", "desc", "Sort order (asc, desc)")
	workbooksListCmd.Flags().Bool("json", false, "Output as JSON")

	// Flags for workbooks create
	workbooksCreateCmd.Flags().String("name", "", "Workbook name")
	workbooksCreateCmd.Flags().Bool("json", false, "Output as JSON")

	// Flags for workbooks show
	workbooksShowCmd.Flags().Bool("json", false, "Output as JSON")

	// Flags for workbooks delete
	workbooksDeleteCmd.Flags().Bool("yes", false, "Skip confirmation prompt")
}

func getAuthenticatedClient() (*api.Client, error) {
	serverURL := getServerURL()

	if !config.IsLoggedIn(serverURL) {
		return nil, fmt.Errorf("not logged in. Run 'scratchmd auth login' first")
	}

	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return nil, fmt.Errorf("failed to load credentials: %w", err)
	}

	client := api.NewClient(
		api.WithBaseURL(serverURL),
		api.WithAPIToken(creds.APIToken),
	)

	return client, nil
}

func getServerURL() string {
	cfg, err := config.LoadConfig()
	if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
		return cfg.Settings.ScratchServerURL
	}
	return api.DefaultScratchServerURL
}

func runWorkbooksList(cmd *cobra.Command, args []string) error {
	sortBy, _ := cmd.Flags().GetString("sort-by")
	sortOrder, _ := cmd.Flags().GetString("sort-order")
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	result, err := client.ListWorkbooks(sortBy, sortOrder)
	if err != nil {
		return fmt.Errorf("failed to list workbooks: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(result)
	}

	// Human-readable output
	if len(result.Workbooks) == 0 {
		fmt.Println("No workbooks found.")
		fmt.Println()
		fmt.Println("Create one with: scratchmd workbooks create --name \"My Workbook\"")
		return nil
	}

	fmt.Println()
	fmt.Printf("Found %d workbook(s):\n", len(result.Workbooks))
	fmt.Println()

	for _, wb := range result.Workbooks {
		name := wb.Name
		if name == "" {
			name = "(unnamed)"
		}
		fmt.Printf("  ID:      %s\n", wb.ID)
		fmt.Printf("  Name:    %s\n", name)
		fmt.Printf("  Tables:  %d\n", wb.TableCount)
		fmt.Printf("  Created: %s\n", wb.CreatedAt)
		fmt.Println()
	}

	return nil
}

func runWorkbooksCreate(cmd *cobra.Command, args []string) error {
	name, _ := cmd.Flags().GetString("name")
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbook, err := client.CreateWorkbook(name)
	if err != nil {
		return fmt.Errorf("failed to create workbook: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(workbook)
	}

	// Human-readable output
	fmt.Println()
	fmt.Println("Workbook created successfully!")
	fmt.Println()
	displayName := workbook.Name
	if displayName == "" {
		displayName = "(unnamed)"
	}
	fmt.Printf("  ID:      %s\n", workbook.ID)
	fmt.Printf("  Name:    %s\n", displayName)
	fmt.Printf("  Created: %s\n", workbook.CreatedAt)
	fmt.Println()

	return nil
}

func runWorkbooksShow(cmd *cobra.Command, args []string) error {
	id := args[0]
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbook, err := client.GetWorkbook(id)
	if err != nil {
		return fmt.Errorf("failed to get workbook: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(workbook)
	}

	// Human-readable output
	fmt.Println()
	displayName := workbook.Name
	if displayName == "" {
		displayName = "(unnamed)"
	}
	fmt.Printf("  ID:      %s\n", workbook.ID)
	fmt.Printf("  Name:    %s\n", displayName)
	fmt.Printf("  Tables:  %d\n", workbook.TableCount)
	fmt.Printf("  Created: %s\n", workbook.CreatedAt)
	fmt.Printf("  Updated: %s\n", workbook.UpdatedAt)
	fmt.Println()

	return nil
}

func runWorkbooksDelete(cmd *cobra.Command, args []string) error {
	id := args[0]
	yes, _ := cmd.Flags().GetBool("yes")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	// First get the workbook to show name in confirmation
	workbook, err := client.GetWorkbook(id)
	if err != nil {
		return fmt.Errorf("failed to get workbook: %w", err)
	}

	displayName := workbook.Name
	if displayName == "" {
		displayName = "(unnamed)"
	}

	// Confirmation prompt
	if !yes {
		fmt.Printf("Are you sure you want to delete workbook \"%s\" (%s)? [y/N] ", displayName, id)
		reader := bufio.NewReader(os.Stdin)
		response, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("failed to read response: %w", err)
		}
		response = strings.TrimSpace(strings.ToLower(response))
		if response != "y" && response != "yes" {
			fmt.Println("Cancelled.")
			return nil
		}
	}

	if err := client.DeleteWorkbook(id); err != nil {
		return fmt.Errorf("failed to delete workbook: %w", err)
	}

	fmt.Printf("Workbook \"%s\" deleted successfully.\n", displayName)
	return nil
}
