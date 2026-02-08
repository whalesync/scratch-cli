package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	survey "github.com/AlecAivazis/survey/v2"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"gopkg.in/yaml.v3"
)

// linkedCmd represents the linked command group
var linkedCmd = &cobra.Command{
	Use:   "linked",
	Short: "Manage linked tables",
	Long: `Manage linked tables (data folders connected to external CRM connectors).

Commands:
  linked available    List available tables from connections
  linked list         List linked tables in a workbook
  linked add          Link a new table to a workbook
  linked remove       Unlink a table from a workbook
  linked show         Show linked table details
  linked pull         Pull CRM changes into the workbook
  linked publish      Publish workbook changes to the CRM`,
}

var linkedAvailableCmd = &cobra.Command{
	Use:   "available [connection-id]",
	Short: "List available tables from connections in the current workbook",
	Long: `List tables available from connections in the current workbook.

This command requires a workbook context — run from inside a workbook directory
or use the --workbook flag.

Examples:
  scratchmd linked available
  scratchmd linked available conn_abc123
  scratchmd linked available --workbook wb_abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLinkedAvailable,
}

var linkedListCmd = &cobra.Command{
	Use:   "list",
	Short: "List linked tables in a workbook",
	Long: `List all linked tables in a workbook, grouped by connector.

If run inside a workbook directory (contains .scratchmd marker), the workbook
is detected automatically. Otherwise, use the --workbook flag.

Examples:
  scratchmd linked list
  scratchmd linked list --workbook wb_abc123`,
	RunE: runLinkedList,
}

var linkedAddCmd = &cobra.Command{
	Use:   "add",
	Short: "Link a new table to a workbook",
	Long: `Interactively select a connection and table to link to the workbook.

In non-interactive mode, provide --connection-id, --table-id, and --name flags.

Examples:
  scratchmd linked add
  scratchmd linked add --connection-id conn_abc --table-id tbl_123 --name "My Table"`,
	RunE: runLinkedAdd,
}

var linkedRemoveCmd = &cobra.Command{
	Use:   "remove [id]",
	Short: "Unlink a table from a workbook",
	Long: `Remove a linked table from the workbook. The data in the CRM is not affected.

If run inside a data folder directory (contains .scratchmd with dataFolder key),
the folder ID is detected automatically. Otherwise, pass it as an argument.

Examples:
  scratchmd linked remove
  scratchmd linked remove df_abc123
  scratchmd linked remove df_abc123 --yes`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLinkedRemove,
}

var linkedShowCmd = &cobra.Command{
	Use:   "show [id]",
	Short: "Show linked table details",
	Long: `Show details for a linked table including pending changes.

If run inside a data folder directory, the folder ID is detected automatically.

Examples:
  scratchmd linked show
  scratchmd linked show df_abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLinkedShow,
}

var linkedPullCmd = &cobra.Command{
	Use:   "pull [id]",
	Short: "Pull CRM changes into the workbook",
	Long: `Pull the latest changes from the CRM into the workbook for a linked table.

After the server-side pull completes, a local download is triggered to sync
the changes to your local disk.

Examples:
  scratchmd linked pull
  scratchmd linked pull df_abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLinkedPull,
}

var linkedPublishCmd = &cobra.Command{
	Use:   "publish [id]",
	Short: "Publish workbook changes to the CRM",
	Long: `Publish local changes from the workbook to the CRM for a linked table.

Examples:
  scratchmd linked publish
  scratchmd linked publish df_abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLinkedPublish,
}

func init() {
	rootCmd.AddCommand(linkedCmd)
	linkedCmd.PersistentFlags().String("workbook", "", "Workbook ID (auto-detected from .scratchmd if not set)")

	linkedCmd.AddCommand(linkedAvailableCmd)
	linkedCmd.AddCommand(linkedListCmd)
	linkedCmd.AddCommand(linkedAddCmd)
	linkedCmd.AddCommand(linkedRemoveCmd)
	linkedCmd.AddCommand(linkedShowCmd)
	linkedCmd.AddCommand(linkedPullCmd)
	linkedCmd.AddCommand(linkedPublishCmd)

	// --json flag on subcommands
	linkedAvailableCmd.Flags().Bool("json", false, "Output as JSON")
	linkedListCmd.Flags().Bool("json", false, "Output as JSON")
	linkedAddCmd.Flags().Bool("json", false, "Output as JSON")
	linkedRemoveCmd.Flags().Bool("json", false, "Output as JSON")
	linkedShowCmd.Flags().Bool("json", false, "Output as JSON")
	linkedPullCmd.Flags().Bool("json", false, "Output as JSON")
	linkedPublishCmd.Flags().Bool("json", false, "Output as JSON")

	// Command-specific flags
	linkedAvailableCmd.Flags().Bool("refresh", false, "Force refresh from connector")
	linkedRemoveCmd.Flags().Bool("yes", false, "Skip confirmation prompt")

	// Non-interactive flags for add
	linkedAddCmd.Flags().String("connection-id", "", "Connector account ID (non-interactive)")
	linkedAddCmd.Flags().StringSlice("table-id", nil, "Table ID(s) to link (non-interactive)")
	linkedAddCmd.Flags().String("name", "", "Name for the linked table (non-interactive)")
}

// --- Context Resolution ---

// findDataFolderMarkerUpward walks the current directory and parents looking for
// a .scratchmd marker with a dataFolder key. Returns the directory path and parsed marker.
func findDataFolderMarkerUpward(startDir string) (string, *DataFolderMarker, error) {
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return "", nil, err
	}

	for {
		m, err := loadDataFolderMarker(dir)
		if err == nil && m != nil {
			return dir, m, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break // Reached filesystem root.
		}
		dir = parent
	}

	return "", nil, nil
}

// loadDataFolderMarker reads and parses a .scratchmd marker with dataFolder key in a directory.
func loadDataFolderMarker(dir string) (*DataFolderMarker, error) {
	data, err := os.ReadFile(filepath.Join(dir, ".scratchmd"))
	if err != nil {
		return nil, err
	}

	var marker DataFolderMarker
	if err := yaml.Unmarshal(data, &marker); err != nil {
		return nil, err
	}

	if marker.DataFolder.ID == "" {
		return nil, fmt.Errorf("marker missing dataFolder ID")
	}

	return &marker, nil
}

// resolveWorkbookContext resolves workbook ID from --workbook flag or .scratchmd marker.
func resolveWorkbookContext(cmd *cobra.Command) (string, error) {
	// Check --workbook flag first
	workbookID, _ := cmd.Flags().GetString("workbook")
	if workbookID != "" {
		return workbookID, nil
	}

	// Walk up looking for workbook marker
	_, m, err := findWorkbookMarkerUpward(".")
	if err != nil {
		return "", fmt.Errorf("failed to detect workbook: %w", err)
	}
	if m == nil {
		return "", fmt.Errorf("not inside a workbook directory. Use --workbook flag or run from a workbook directory")
	}

	return m.Workbook.ID, nil
}

// resolveLinkedContext resolves both workbook ID and data folder ID from args/flags/markers.
func resolveLinkedContext(cmd *cobra.Command, args []string) (workbookID string, dataFolderID string, err error) {
	// 1. Resolve data folder ID from args or marker
	if len(args) > 0 {
		dataFolderID = args[0]
	} else {
		_, dfMarker, dfErr := findDataFolderMarkerUpward(".")
		if dfErr != nil {
			return "", "", fmt.Errorf("failed to detect linked table: %w", dfErr)
		}
		if dfMarker == nil {
			return "", "", fmt.Errorf("not inside a linked table directory. Pass a folder ID or run from a data folder directory")
		}
		dataFolderID = dfMarker.DataFolder.ID
	}

	// 2. Resolve workbook ID
	workbookID, err = resolveWorkbookContext(cmd)
	if err != nil {
		return "", "", err
	}

	return workbookID, dataFolderID, nil
}

// --- Job Polling ---

// pollJobUntilDone polls the server for job progress until the job completes or fails.
// It prints progress dots to stderr and returns nil on success, or an error on failure/timeout.
func pollJobUntilDone(client *api.Client, jobID string) error {
	const pollInterval = 2 * time.Second
	const timeout = 30 * time.Minute

	deadline := time.Now().Add(timeout)

	for {
		if time.Now().After(deadline) {
			fmt.Fprintln(os.Stderr)
			return fmt.Errorf("timed out waiting for job %s after %v", jobID, timeout)
		}

		progress, err := client.GetJobProgress(jobID)
		if err != nil {
			fmt.Fprintln(os.Stderr)
			return fmt.Errorf("failed to check job progress: %w", err)
		}

		switch progress.State {
		case "completed":
			fmt.Fprintln(os.Stderr)
			return nil
		case "failed":
			fmt.Fprintln(os.Stderr)
			reason := "unknown"
			if progress.FailedReason != nil {
				reason = *progress.FailedReason
			}
			return fmt.Errorf("job failed: %s", reason)
		case "canceled":
			fmt.Fprintln(os.Stderr)
			return fmt.Errorf("job was canceled")
		}

		fmt.Fprint(os.Stderr, ".")
		time.Sleep(pollInterval)
	}
}

// --- Command Implementations ---

func runLinkedAvailable(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, err := resolveWorkbookContext(cmd)
	if err != nil {
		return err
	}

	connectionID := ""
	if len(args) > 0 {
		connectionID = args[0]
	}

	groups, err := client.ListAvailableTables(workbookID, connectionID)
	if err != nil {
		return fmt.Errorf("failed to list available tables: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(groups)
	}

	if len(groups) == 0 {
		fmt.Println("No connections found in this workbook.")
		fmt.Println()
		fmt.Println("Add a connection in your workbook at https://app.scratch.md to see available tables.")
		return nil
	}

	fmt.Println()
	for _, group := range groups {
		fmt.Printf("  %s (%s)\n", group.DisplayName, group.Service)
		fmt.Printf("  Connection ID: %s\n", group.ConnectorAccountID)
		if len(group.Tables) == 0 {
			fmt.Println("    No tables found")
		} else {
			for _, table := range group.Tables {
				fmt.Printf("    - %s (ID: %s)\n", table.DisplayName, table.ID)
			}
		}
		fmt.Println()
	}

	return nil
}

func runLinkedList(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, err := resolveWorkbookContext(cmd)
	if err != nil {
		return err
	}

	groups, err := client.ListLinkedTables(workbookID)
	if err != nil {
		return fmt.Errorf("failed to list linked tables: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(groups)
	}

	totalFolders := 0
	for _, g := range groups {
		totalFolders += len(g.DataFolders)
	}

	if totalFolders == 0 {
		fmt.Println("No linked tables found in this workbook.")
		fmt.Println()
		fmt.Println("Link a table with: scratchmd linked add")
		return nil
	}

	fmt.Println()
	for _, group := range groups {
		service := ""
		if group.Service != nil {
			service = " (" + *group.Service + ")"
		}
		fmt.Printf("  %s%s\n", group.Name, service)
		for _, df := range group.DataFolders {
			lockStatus := ""
			if df.Lock != nil && *df.Lock != "" {
				lockStatus = fmt.Sprintf(" [%s]", *df.Lock)
			}
			fmt.Printf("    - %s  (ID: %s)%s\n", df.Name, df.ID, lockStatus)
		}
		fmt.Println()
	}

	return nil
}

func runLinkedAdd(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, err := resolveWorkbookContext(cmd)
	if err != nil {
		return err
	}

	// Check for non-interactive flags
	connectionID, _ := cmd.Flags().GetString("connection-id")
	tableIDs, _ := cmd.Flags().GetStringSlice("table-id")
	name, _ := cmd.Flags().GetString("name")

	if connectionID != "" && len(tableIDs) > 0 {
		// Non-interactive mode
		if name == "" {
			name = tableIDs[0]
		}

		req := &api.CreateLinkedTableRequest{
			Name:               name,
			ConnectorAccountID: connectionID,
			TableID:            tableIDs,
		}

		result, err := client.CreateLinkedTable(workbookID, req)
		if err != nil {
			return fmt.Errorf("failed to create linked table: %w", err)
		}

		if jsonOutput {
			encoder := json.NewEncoder(os.Stdout)
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(result); err != nil {
				return err
			}
		} else {
			fmt.Printf("\nLinked table '%s' created successfully.\n", result.Name)
			fmt.Printf("  ID: %s\n", result.ID)
		}

		fmt.Println("Downloading files...")
		return runFilesDownload(cmd, nil)
	}

	// Interactive mode
	groups, err := client.ListAvailableTables(workbookID, "")
	if err != nil {
		return fmt.Errorf("failed to list available tables: %w", err)
	}

	if len(groups) == 0 {
		return fmt.Errorf("no connections found in this workbook. Add a connection in your workbook at https://app.scratch.md first")
	}

	// Step 1: Select connection
	var selectedGroup api.TableGroup
	if len(groups) == 1 {
		selectedGroup = groups[0]
		fmt.Printf("Using connection: %s (%s)\n", selectedGroup.DisplayName, selectedGroup.Service)
	} else {
		connectionOptions := make([]string, len(groups))
		for i, g := range groups {
			connectionOptions[i] = fmt.Sprintf("%s (%s)", g.DisplayName, g.Service)
		}

		var selectedIdx int
		prompt := &survey.Select{
			Message: "Select a connection:",
			Options: connectionOptions,
		}
		if err := survey.AskOne(prompt, &selectedIdx); err != nil {
			return fmt.Errorf("prompt cancelled: %w", err)
		}
		selectedGroup = groups[selectedIdx]
	}

	if len(selectedGroup.Tables) == 0 {
		return fmt.Errorf("no tables found for connection '%s'", selectedGroup.DisplayName)
	}

	// Step 2: Select table(s)
	tableOptions := make([]string, len(selectedGroup.Tables))
	for i, t := range selectedGroup.Tables {
		tableOptions[i] = fmt.Sprintf("%s (ID: %s)", t.DisplayName, t.ID)
	}

	var selectedTableIdxs []int
	tablePrompt := &survey.MultiSelect{
		Message: "Select table(s) to link:",
		Options: tableOptions,
	}
	if err := survey.AskOne(tablePrompt, &selectedTableIdxs); err != nil {
		return fmt.Errorf("prompt cancelled: %w", err)
	}

	if len(selectedTableIdxs) == 0 {
		return fmt.Errorf("no tables selected")
	}

	var selectedTableIDs []string
	defaultName := selectedGroup.Tables[selectedTableIdxs[0]].DisplayName
	for _, idx := range selectedTableIdxs {
		selectedTableIDs = append(selectedTableIDs, selectedGroup.Tables[idx].ID.Parts()...)
	}

	// Step 3: Prompt for name
	var folderName string
	namePrompt := &survey.Input{
		Message: "Name for the linked table:",
		Default: defaultName,
	}
	if err := survey.AskOne(namePrompt, &folderName); err != nil {
		return fmt.Errorf("prompt cancelled: %w", err)
	}

	if folderName == "" {
		folderName = defaultName
	}

	req := &api.CreateLinkedTableRequest{
		Name:               folderName,
		ConnectorAccountID: selectedGroup.ConnectorAccountID,
		TableID:            selectedTableIDs,
	}

	result, err := client.CreateLinkedTable(workbookID, req)
	if err != nil {
		return fmt.Errorf("failed to create linked table: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(result); err != nil {
			return err
		}
	} else {
		fmt.Printf("\nLinked table '%s' created successfully.\n", result.Name)
		fmt.Printf("  ID: %s\n", result.ID)
	}

	fmt.Println("Downloading files...")
	return runFilesDownload(cmd, nil)
}

func runLinkedRemove(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")
	yes, _ := cmd.Flags().GetBool("yes")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, dataFolderID, err := resolveLinkedContext(cmd, args)
	if err != nil {
		return err
	}

	// Get details for confirmation
	detail, err := client.GetLinkedTable(workbookID, dataFolderID)
	if err != nil {
		return fmt.Errorf("failed to get linked table: %w", err)
	}

	// Confirmation prompt
	if !yes && !jsonOutput {
		fmt.Printf("Are you sure you want to unlink \"%s\" (%s)? [y/N] ", detail.Name, detail.ID)
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

	if err := client.DeleteLinkedTable(workbookID, dataFolderID); err != nil {
		return fmt.Errorf("failed to remove linked table: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(map[string]interface{}{
			"success": true,
			"id":      dataFolderID,
			"name":    detail.Name,
		}); err != nil {
			return err
		}
	} else {
		fmt.Printf("Linked table \"%s\" removed successfully.\n", detail.Name)
	}

	fmt.Println("Downloading files...")
	return runFilesDownload(cmd, nil)
}

func runLinkedShow(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, dataFolderID, err := resolveLinkedContext(cmd, args)
	if err != nil {
		return err
	}

	detail, err := client.GetLinkedTable(workbookID, dataFolderID)
	if err != nil {
		return fmt.Errorf("failed to get linked table: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(detail)
	}

	fmt.Println()
	fmt.Printf("  Name:      %s\n", detail.Name)
	fmt.Printf("  ID:        %s\n", detail.ID)
	if detail.ConnectorService != nil {
		fmt.Printf("  Service:   %s\n", *detail.ConnectorService)
	}
	if detail.ConnectorDisplayName != nil {
		fmt.Printf("  Connector: %s\n", *detail.ConnectorDisplayName)
	}
	if detail.LastSyncTime != nil {
		fmt.Printf("  Last Sync: %s\n", *detail.LastSyncTime)
	}
	if detail.Lock != nil && *detail.Lock != "" {
		fmt.Printf("  Lock:      %s\n", *detail.Lock)
	}

	if detail.HasChanges {
		fmt.Println()
		fmt.Println("  Pending changes:")
		if detail.Creates > 0 {
			fmt.Printf("    %d new record(s)\n", detail.Creates)
		}
		if detail.Updates > 0 {
			fmt.Printf("    %d updated record(s)\n", detail.Updates)
		}
		if detail.Deletes > 0 {
			fmt.Printf("    %d deleted record(s)\n", detail.Deletes)
		}
	} else {
		fmt.Println()
		fmt.Println("  No pending changes.")
	}
	fmt.Println()

	return nil
}

func runLinkedPull(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, dataFolderID, err := resolveLinkedContext(cmd, args)
	if err != nil {
		return err
	}

	resp, err := client.PullLinkedTable(workbookID, dataFolderID)
	if err != nil {
		return fmt.Errorf("failed to pull linked table: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(resp)
	}

	fmt.Fprintf(os.Stderr, "Pull job started (job ID: %s). Waiting for completion", resp.JobID)

	if err := pollJobUntilDone(client, resp.JobID); err != nil {
		return err
	}

	fmt.Println("Pull completed. Downloading files...")
	return runFilesDownload(cmd, nil)
}

func runLinkedPublish(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workbookID, dataFolderID, err := resolveLinkedContext(cmd, args)
	if err != nil {
		return err
	}

	resp, err := client.PublishLinkedTable(workbookID, dataFolderID)
	if err != nil {
		return fmt.Errorf("failed to publish linked table: %w", err)
	}

	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(resp)
	}

	fmt.Fprintf(os.Stderr, "Publish job started (job ID: %s). Waiting for completion", resp.JobID)

	if err := pollJobUntilDone(client, resp.JobID); err != nil {
		return err
	}

	fmt.Println("Publish completed. Downloading files...")
	return runFilesDownload(cmd, nil)
}
