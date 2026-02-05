package cmd

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"gopkg.in/yaml.v3"
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
  workbooks delete    Delete a workbook
  workbooks init      Initialize a local copy of a workbook`,
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

// workbooksInitCmd represents the workbooks init command
var workbooksInitCmd = &cobra.Command{
	Use:   "init <workbook-id>",
	Short: "Initialize a local copy of a workbook",
	Long: `Initialize a local directory with a workbook's files.

Downloads all files from the workbook and creates a .scratchmd marker file
to track the workbook association.

Example:
  scratchmd workbooks init abc123
  scratchmd workbooks init abc123 --output ./my-project
  scratchmd workbooks init abc123 --force  # Overwrite existing directory`,
	Args: cobra.ExactArgs(1),
	RunE: runWorkbooksInit,
}

func init() {
	rootCmd.AddCommand(workbooksCmd)
	workbooksCmd.AddCommand(workbooksListCmd)
	workbooksCmd.AddCommand(workbooksCreateCmd)
	workbooksCmd.AddCommand(workbooksShowCmd)
	workbooksCmd.AddCommand(workbooksDeleteCmd)
	workbooksCmd.AddCommand(workbooksInitCmd)

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

	// Flags for workbooks init
	workbooksInitCmd.Flags().StringP("output", "o", ".", "Output directory")
	workbooksInitCmd.Flags().Bool("force", false, "Overwrite existing directory")
	workbooksInitCmd.Flags().Bool("json", false, "Output as JSON")
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

// WorkbookMarker represents the .scratchmd marker file structure
type WorkbookMarker struct {
	Version  string         `yaml:"version"`
	Workbook WorkbookConfig `yaml:"workbook"`
}

// WorkbookConfig represents the workbook configuration in the marker file
type WorkbookConfig struct {
	ID            string `yaml:"id"`
	Name          string `yaml:"name"`
	ServerURL     string `yaml:"serverUrl"`
	InitializedAt string `yaml:"initializedAt"`
}

// DataFolderMarker represents the .scratchmd marker file structure for data folders
type DataFolderMarker struct {
	Version    string           `yaml:"version"`
	DataFolder DataFolderConfig `yaml:"dataFolder"`
}

// DataFolderConfig represents the data folder configuration in the marker file
type DataFolderConfig struct {
	ID   string `yaml:"id"`
	Name string `yaml:"name"`
}

// InitResult represents the result of a workbooks init operation (for JSON output)
type InitResult struct {
	WorkbookID   string `json:"workbookId"`
	WorkbookName string `json:"workbookName"`
	Directory    string `json:"directory"`
	FileCount    int    `json:"fileCount"`
}

func runWorkbooksInit(cmd *cobra.Command, args []string) error {
	workbookID := args[0]
	outputDir, _ := cmd.Flags().GetString("output")
	force, _ := cmd.Flags().GetBool("force")
	jsonOutput, _ := cmd.Flags().GetBool("json")

	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	// 1. Check if workbook is already initialized in the output directory
	existingDir, err := findExistingWorkbookMarker(outputDir, workbookID)
	if err != nil {
		return fmt.Errorf("failed to check for existing workbook: %w", err)
	}

	if existingDir != "" {
		if force {
			// proceed with overwrite
		} else if jsonOutput {
			return fmt.Errorf("workbook %s is already initialized at %s (use --force to overwrite)", workbookID, existingDir)
		} else {
			fmt.Printf("\nWorkbook is already initialized at %q.\n", existingDir)
			fmt.Print("Overwrite with fresh files? [y/N]: ")

			reader := bufio.NewReader(os.Stdin)
			response, _ := reader.ReadString('\n')
			response = strings.TrimSpace(strings.ToLower(response))

			if response != "y" && response != "yes" {
				fmt.Println("Cancelled.")
				return nil
			}
		}
	}

	// 2. Get workbook metadata
	workbook, err := client.GetWorkbook(workbookID)
	if err != nil {
		return fmt.Errorf("failed to get workbook: %w", err)
	}

	// 3. Determine target directory
	workbookName := workbook.Name
	if workbookName == "" {
		workbookName = workbookID
	}
	// If overwriting existing, use that directory; otherwise create new one
	var targetDir string
	if existingDir != "" {
		targetDir = existingDir
	} else {
		targetDir = filepath.Join(outputDir, workbookName)
	}

	// 3. Create directory
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 4. Create .scratchmd marker file
	marker := WorkbookMarker{
		Version: "1",
		Workbook: WorkbookConfig{
			ID:            workbook.ID,
			Name:          workbook.Name,
			ServerURL:     getServerURL(),
			InitializedAt: time.Now().UTC().Format(time.RFC3339),
		},
	}

	markerPath := filepath.Join(targetDir, ".scratchmd")
	markerData, err := yaml.Marshal(&marker)
	if err != nil {
		return fmt.Errorf("failed to marshal marker file: %w", err)
	}
	if err := os.WriteFile(markerPath, markerData, 0644); err != nil {
		return fmt.Errorf("failed to write marker file: %w", err)
	}

	// 5. Download and extract ZIP
	body, err := client.DownloadWorkbook(workbookID)
	if err != nil {
		return fmt.Errorf("failed to download workbook: %w", err)
	}
	defer body.Close()

	fileCount, err := extractZip(body, targetDir)
	if err != nil {
		return fmt.Errorf("failed to extract workbook: %w", err)
	}

	// 6. Create .scratchmd markers in each data folder
	if err := createDataFolderMarkers(targetDir, workbook.DataFolders); err != nil {
		return fmt.Errorf("failed to create data folder markers: %w", err)
	}

	if jsonOutput {
		result := InitResult{
			WorkbookID:   workbook.ID,
			WorkbookName: workbook.Name,
			Directory:    targetDir,
			FileCount:    fileCount,
		}
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(result)
	}

	// Human-readable output
	fmt.Println()
	fmt.Printf("Initialized workbook '%s' (%d files)\n", workbookName, fileCount)
	fmt.Printf("  Directory: %s\n", targetDir)
	fmt.Println()

	return nil
}

// findExistingWorkbookMarker scans the output directory for a .scratchmd marker
// with the given workbook ID. Returns the directory path if found, empty string otherwise.
func findExistingWorkbookMarker(outputDir string, workbookID string) (string, error) {
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // Output directory doesn't exist yet, no conflicts
		}
		return "", err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		markerPath := filepath.Join(outputDir, entry.Name(), ".scratchmd")
		data, err := os.ReadFile(markerPath)
		if err != nil {
			continue // No marker file or can't read it, skip
		}

		var marker WorkbookMarker
		if err := yaml.Unmarshal(data, &marker); err != nil {
			continue // Invalid marker file, skip
		}

		if marker.Workbook.ID == workbookID {
			return filepath.Join(outputDir, entry.Name()), nil
		}
	}

	return "", nil
}

// extractZip extracts a ZIP archive from a reader into the target directory
func extractZip(r io.Reader, targetDir string) (int, error) {
	// Read the entire ZIP into memory (needed for archive/zip)
	data, err := io.ReadAll(r)
	if err != nil {
		return 0, fmt.Errorf("failed to read archive: %w", err)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return 0, fmt.Errorf("failed to open archive: %w", err)
	}

	fileCount := 0
	for _, f := range zipReader.File {
		// Skip directories
		if f.FileInfo().IsDir() {
			continue
		}

		// Construct target path
		targetPath := filepath.Join(targetDir, f.Name)

		// Ensure the directory exists
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return fileCount, fmt.Errorf("failed to create directory for %s: %w", f.Name, err)
		}

		// Extract the file
		rc, err := f.Open()
		if err != nil {
			return fileCount, fmt.Errorf("failed to open %s in archive: %w", f.Name, err)
		}

		outFile, err := os.Create(targetPath)
		if err != nil {
			rc.Close()
			return fileCount, fmt.Errorf("failed to create %s: %w", targetPath, err)
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return fileCount, fmt.Errorf("failed to extract %s: %w", f.Name, err)
		}

		fileCount++
	}

	return fileCount, nil
}

// createDataFolderMarkers creates .scratchmd marker files in each data folder directory
func createDataFolderMarkers(targetDir string, dataFolders []api.DataFolder) error {
	// Build a map from folder name to data folder for quick lookup
	folderMap := make(map[string]api.DataFolder)
	for _, df := range dataFolders {
		folderMap[df.Name] = df
	}

	// Read directories in the target directory
	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return fmt.Errorf("failed to read target directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		folderName := entry.Name()

		// Check if this folder matches a data folder
		df, exists := folderMap[folderName]
		if !exists {
			continue // Not a data folder, skip
		}

		// Create .scratchmd marker in the folder
		marker := DataFolderMarker{
			Version: "1",
			DataFolder: DataFolderConfig{
				ID:   df.ID,
				Name: df.Name,
			},
		}

		markerPath := filepath.Join(targetDir, folderName, ".scratchmd")
		markerData, err := yaml.Marshal(&marker)
		if err != nil {
			return fmt.Errorf("failed to marshal marker for %s: %w", folderName, err)
		}

		if err := os.WriteFile(markerPath, markerData, 0644); err != nil {
			return fmt.Errorf("failed to write marker for %s: %w", folderName, err)
		}
	}

	return nil
}
