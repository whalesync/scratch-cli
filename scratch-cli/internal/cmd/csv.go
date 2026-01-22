package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/csv"
	"golang.org/x/term"
)

// csvCmd represents the csv command group
var csvCmd = &cobra.Command{
	Use:   "csv",
	Short: "CSV import and export operations",
	Long:  `Import CSV files as local markdown content folders.`,
}

// csvImportCmd represents the csv import command
var csvImportCmd = &cobra.Command{
	Use:   "import <file.csv> [folder-name]",
	Short: "Import a CSV file as markdown files",
	Long: `Import a CSV file into a folder of markdown files.

INTERACTIVE MODE (default when no --name flag and TTY available):
  Prompts to select which columns to include, which column is the
  filename, and which columns become the content body.

NON-INTERACTIVE MODE (with --name flag):
  --name       Column for filename (required for non-interactive)
  --content    Comma-separated columns for markdown body
  --include    Columns to include (defaults to all)
  --exclude    Columns to exclude

Examples:
  scratchmd csv import posts.csv                    # interactive
  scratchmd csv import posts.csv blog-posts         # interactive with folder name
  scratchmd csv import posts.csv --name=title --content=body
  scratchmd csv import posts.csv --name=slug --content=body,summary --exclude=id`,
	Args: cobra.RangeArgs(1, 2),
	RunE: runCSVImport,
}

func init() {
	rootCmd.AddCommand(csvCmd)
	csvCmd.AddCommand(csvImportCmd)

	csvImportCmd.Flags().String("name", "", "Column to use for filename (required for non-interactive)")
	csvImportCmd.Flags().StringSlice("content", nil, "Columns for markdown body (comma-separated)")
	csvImportCmd.Flags().StringSlice("include", nil, "Columns to include (defaults to all)")
	csvImportCmd.Flags().StringSlice("exclude", nil, "Columns to exclude")
}

func runCSVImport(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	// Validate file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("CSV file not found: %s", filePath)
	}

	// Determine folder name
	folderName := ""
	if len(args) > 1 {
		folderName = args[1]
	} else {
		// Use CSV filename without extension as default
		base := filepath.Base(filePath)
		folderName = strings.TrimSuffix(base, filepath.Ext(base))
	}

	// Check if interactive or non-interactive mode
	nameFlag, _ := cmd.Flags().GetString("name")

	if nameFlag == "" && term.IsTerminal(int(os.Stdin.Fd())) {
		return runCSVImportInteractive(filePath, folderName)
	}

	if nameFlag == "" {
		return fmt.Errorf("--name flag is required in non-interactive mode")
	}

	return runCSVImportNonInteractive(cmd, filePath, folderName)
}

func runCSVImportInteractive(filePath string, folderName string) error {
	// Parse CSV
	fmt.Printf("Reading %s...\n", filePath)
	headers, rows, err := csv.ParseCSV(filePath)
	if err != nil {
		return err
	}

	// Get column info with types
	columns := csv.InferColumnTypes(headers, rows)

	// Build column options with type info
	columnOptions := make([]string, len(columns))
	for i, col := range columns {
		columnOptions[i] = fmt.Sprintf("%s (%s)", col.Name, col.InferredType)
	}

	// 1. Select columns to include
	var selectedColumnOptions []string
	includePrompt := &survey.MultiSelect{
		Message: "Select columns to include (space to toggle, enter to confirm):",
		Options: columnOptions,
		Default: columnOptions, // All selected by default
	}
	if err := askOne(includePrompt, &selectedColumnOptions); err != nil {
		return err
	}

	if len(selectedColumnOptions) == 0 {
		return fmt.Errorf("at least one column must be selected")
	}

	// Extract column names from selections (remove type info)
	selectedColumns := make([]string, len(selectedColumnOptions))
	for i, opt := range selectedColumnOptions {
		// Extract name before " ("
		if idx := strings.Index(opt, " ("); idx != -1 {
			selectedColumns[i] = opt[:idx]
		} else {
			selectedColumns[i] = opt
		}
	}

	// 2. Select name column (for filename)
	var nameColumn string
	namePrompt := &survey.Select{
		Message: "Select the column to use for filenames:",
		Options: selectedColumns,
	}
	if err := askOne(namePrompt, &nameColumn); err != nil {
		return err
	}

	// 3. Select content columns (remaining columns minus name)
	remainingColumns := filterOut(selectedColumns, nameColumn)
	var contentColumns []string

	if len(remainingColumns) > 0 {
		contentPrompt := &survey.MultiSelect{
			Message: "Select columns for markdown body (none = all become metadata):",
			Options: remainingColumns,
		}
		if err := askOne(contentPrompt, &contentColumns); err != nil {
			return err
		}
	}

	// 4. Order content columns if more than one selected
	if len(contentColumns) > 1 {
		contentColumns, err = orderContentColumns(contentColumns)
		if err != nil {
			return err
		}
	}

	// 5. Show preview
	fmt.Println()
	fmt.Println("Preview of import:")
	fmt.Println("==================")
	showImportPreview(headers, rows, selectedColumns, nameColumn, contentColumns)

	// 5. Confirm
	var confirm bool
	confirmPrompt := &survey.Confirm{
		Message: fmt.Sprintf("Import %d records to '%s/'?", len(rows), folderName),
		Default: true,
	}
	if err := askOne(confirmPrompt, &confirm); err != nil {
		return err
	}

	if !confirm {
		fmt.Println("Import cancelled.")
		return nil
	}

	// 6. Execute import
	cfg := &csv.ImportConfig{
		FilePath:       filePath,
		FolderName:     folderName,
		NameColumn:     nameColumn,
		ContentColumns: contentColumns,
		IncludeColumns: selectedColumns,
		ExcludeColumns: nil,
	}

	result, err := csv.RunImport(cfg, func(msg string) {
		fmt.Println(msg)
	})
	if err != nil {
		return err
	}

	fmt.Println()
	fmt.Printf("Successfully imported %d records to '%s/'.\n", result.TotalCreated, result.FolderPath)
	fmt.Printf("Created %s/scratchmd.config.yaml\n", result.FolderPath)
	fmt.Printf("Created %s/scratchmd.schema.yaml\n", result.FolderPath)
	return nil
}

func runCSVImportNonInteractive(cmd *cobra.Command, filePath string, folderName string) error {
	nameColumn, _ := cmd.Flags().GetString("name")
	contentColumns, _ := cmd.Flags().GetStringSlice("content")
	includeColumns, _ := cmd.Flags().GetStringSlice("include")
	excludeColumns, _ := cmd.Flags().GetStringSlice("exclude")

	cfg := &csv.ImportConfig{
		FilePath:       filePath,
		FolderName:     folderName,
		NameColumn:     nameColumn,
		ContentColumns: contentColumns,
		IncludeColumns: includeColumns,
		ExcludeColumns: excludeColumns,
	}

	result, err := csv.RunImport(cfg, func(msg string) {
		fmt.Println(msg)
	})
	if err != nil {
		return err
	}

	fmt.Printf("Successfully imported %d records to '%s/'.\n", result.TotalCreated, result.FolderPath)
	return nil
}

func showImportPreview(headers []string, rows [][]string, selectedColumns []string, nameColumn string, contentColumns []string) {
	// Build header index
	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[h] = i
	}

	// Determine metadata columns
	metadataColumns := make([]string, 0)
	for _, col := range selectedColumns {
		if col != nameColumn && !containsString(contentColumns, col) {
			metadataColumns = append(metadataColumns, col)
		}
	}

	// Show up to 3 rows
	previewCount := 3
	if len(rows) < previewCount {
		previewCount = len(rows)
	}

	for i := 0; i < previewCount; i++ {
		row := rows[i]

		// Get filename
		var filename string
		if idx, ok := headerIndex[nameColumn]; ok && idx < len(row) && row[idx] != "" {
			filename = csv.Slugify(row[idx]) + ".md"
		} else {
			filename = fmt.Sprintf("row-%d.md", i+1)
		}

		fmt.Printf("\n--- %s ---\n", filename)

		// Show frontmatter fields
		if len(metadataColumns) > 0 {
			fmt.Println("Frontmatter:")
			for _, col := range metadataColumns {
				if idx, ok := headerIndex[col]; ok && idx < len(row) && row[idx] != "" {
					value := row[idx]
					if len(value) > 50 {
						value = value[:50] + "..."
					}
					fmt.Printf("  %s: %s\n", col, value)
				}
			}
		}

		// Show content preview
		if len(contentColumns) > 0 {
			fmt.Println("Content body:")
			for _, col := range contentColumns {
				if idx, ok := headerIndex[col]; ok && idx < len(row) && row[idx] != "" {
					value := row[idx]
					if len(value) > 100 {
						value = value[:100] + "..."
					}
					fmt.Printf("  [%s] %s\n", col, value)
				}
			}
		}
	}

	if len(rows) > previewCount {
		fmt.Printf("\n... and %d more records\n", len(rows)-previewCount)
	}
	fmt.Println()
}

func filterOut(slice []string, value string) []string {
	result := make([]string, 0, len(slice)-1)
	for _, v := range slice {
		if v != value {
			result = append(result, v)
		}
	}
	return result
}

func containsString(slice []string, value string) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

// orderContentColumns prompts user to order content columns by selecting them one at a time
func orderContentColumns(columns []string) ([]string, error) {
	fmt.Printf("\nYou selected %d content columns. Select them in the order they should appear in the markdown body.\n", len(columns))

	ordered := make([]string, 0, len(columns))
	remaining := make([]string, len(columns))
	copy(remaining, columns)

	for i := 0; i < len(columns); i++ {
		position := i + 1
		var selected string

		prompt := &survey.Select{
			Message: fmt.Sprintf("Select content column #%d:", position),
			Options: remaining,
		}
		if err := askOne(prompt, &selected); err != nil {
			return nil, err
		}

		ordered = append(ordered, selected)
		remaining = filterOut(remaining, selected)
	}

	fmt.Printf("Content order: %s\n", strings.Join(ordered, " → "))
	return ordered, nil
}
