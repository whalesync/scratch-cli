// Package csv provides CSV import functionality for the scratchmd CLI.
package csv

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/whalesync/scratch-cli/internal/config"
	"gopkg.in/yaml.v3"
)

// ImportConfig holds the configuration for a CSV import operation.
type ImportConfig struct {
	FilePath       string   // Path to CSV file
	FolderName     string   // Output folder name
	NameColumn     string   // Column to use for filename
	ContentColumns []string // Columns to become markdown body
	IncludeColumns []string // Columns to include (nil = all)
	ExcludeColumns []string // Columns to exclude
}

// ImportResult contains the outcome of an import operation.
type ImportResult struct {
	TotalRecords int
	TotalCreated int
	FolderPath   string
}

// ColumnInfo represents metadata about a CSV column.
type ColumnInfo struct {
	Name         string
	Index        int
	InferredType string // "text", "number", "boolean"
	SampleValues []string
}

// ParseCSV reads and parses a CSV file, returning headers and rows.
func ParseCSV(filePath string) ([]string, [][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	// Check for and skip UTF-8 BOM if present
	bom := make([]byte, 3)
	n, err := file.Read(bom)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read file: %w", err)
	}

	// If not a BOM, seek back to start
	if n < 3 || bom[0] != 0xEF || bom[1] != 0xBB || bom[2] != 0xBF {
		if _, err := file.Seek(0, 0); err != nil {
			return nil, nil, fmt.Errorf("failed to seek file: %w", err)
		}
	}

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // Allow variable field counts

	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, nil, fmt.Errorf("CSV file is empty")
	}

	headers := records[0]
	rows := records[1:]

	if len(rows) == 0 {
		return nil, nil, fmt.Errorf("CSV file has no data rows (only headers)")
	}

	return headers, rows, nil
}

// InferColumnTypes analyzes column values to infer data types.
func InferColumnTypes(headers []string, rows [][]string) []ColumnInfo {
	columns := make([]ColumnInfo, len(headers))

	for i, header := range headers {
		columns[i] = ColumnInfo{
			Name:         header,
			Index:        i,
			SampleValues: make([]string, 0, 5),
		}

		// Collect sample values (up to 5)
		for j := 0; j < len(rows) && len(columns[i].SampleValues) < 5; j++ {
			if i < len(rows[j]) && rows[j][i] != "" {
				columns[i].SampleValues = append(columns[i].SampleValues, rows[j][i])
			}
		}

		// Infer type from samples
		columns[i].InferredType = inferType(columns[i].SampleValues)
	}

	return columns
}

// inferType determines the data type from sample values.
func inferType(samples []string) string {
	if len(samples) == 0 {
		return "text"
	}

	allNumbers := true
	allBooleans := true

	for _, v := range samples {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}

		// Check if number
		if _, err := strconv.ParseFloat(v, 64); err != nil {
			allNumbers = false
		}

		// Check if boolean
		lower := strings.ToLower(v)
		if lower != "true" && lower != "false" && lower != "yes" && lower != "no" && lower != "1" && lower != "0" {
			allBooleans = false
		}
	}

	switch {
	case allBooleans:
		return "boolean"
	case allNumbers:
		return "number"
	default:
		return "text"
	}
}

// Slugify converts a string to a valid filename slug.
func Slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)

	// Replace spaces and underscores with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")

	// Remove or replace non-ASCII characters
	var result strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' {
			if r > 127 {
				// Skip non-ASCII letters
				continue
			}
			result.WriteRune(r)
		}
	}
	s = result.String()

	// Collapse multiple hyphens
	re := regexp.MustCompile(`-+`)
	s = re.ReplaceAllString(s, "-")

	// Trim leading/trailing hyphens
	s = strings.Trim(s, "-")

	// Handle empty result
	if s == "" {
		return "untitled"
	}

	return s
}

// GenerateMarkdown creates markdown content with YAML frontmatter.
func GenerateMarkdown(row map[string]string, contentColumns []string, metadataColumns []string) string {
	var buf bytes.Buffer

	// Build frontmatter
	buf.WriteString("---\n")

	frontmatter := make(map[string]interface{})
	for _, col := range metadataColumns {
		value := row[col]
		if value == "" {
			continue // Skip empty values
		}
		frontmatter[col] = value
	}

	if len(frontmatter) > 0 {
		yamlData, _ := yaml.Marshal(frontmatter)
		buf.Write(yamlData)
	}
	buf.WriteString("---\n")

	// Build content body (concatenate content columns)
	hasContent := false
	for _, col := range contentColumns {
		if value := row[col]; value != "" {
			if hasContent {
				buf.WriteString("\n\n")
			}
			buf.WriteString(value)
			hasContent = true
		}
	}
	buf.WriteString("\n")

	return buf.String()
}

// RunImport executes the full import process.
func RunImport(cfg *ImportConfig, progress func(string)) (*ImportResult, error) {
	if progress == nil {
		progress = func(string) {} // no-op
	}

	// Parse CSV
	progress(fmt.Sprintf("Reading %s...", cfg.FilePath))
	headers, rows, err := ParseCSV(cfg.FilePath)
	if err != nil {
		return nil, err
	}

	// Determine included columns
	includedColumns := determineIncludedColumns(headers, cfg.IncludeColumns, cfg.ExcludeColumns)

	// Validate name column
	if !contains(includedColumns, cfg.NameColumn) {
		return nil, fmt.Errorf("name column '%s' is not in included columns", cfg.NameColumn)
	}

	// Validate content columns
	for _, col := range cfg.ContentColumns {
		if !contains(includedColumns, col) {
			return nil, fmt.Errorf("content column '%s' is not in included columns", col)
		}
	}

	// Determine metadata columns (included columns minus name and content)
	metadataColumns := make([]string, 0)
	for _, col := range includedColumns {
		if col != cfg.NameColumn && !contains(cfg.ContentColumns, col) {
			metadataColumns = append(metadataColumns, col)
		}
	}

	// Check if folder already exists with config
	existingConfig, err := config.LoadTableConfig(cfg.FolderName)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing config: %w", err)
	}
	if existingConfig != nil {
		return nil, fmt.Errorf("folder '%s' already has a table configuration", cfg.FolderName)
	}

	// Create folder structure
	progress(fmt.Sprintf("Creating folder '%s'...", cfg.FolderName))
	if err := os.MkdirAll(cfg.FolderName, 0755); err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	// Create .scratchmd metadata directory
	scratchmdDir := filepath.Join(".scratchmd", cfg.FolderName)
	if err := os.MkdirAll(scratchmdDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create .scratchmd folder: %w", err)
	}

	// Build header index for quick lookup
	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[h] = i
	}

	// Track used filenames to handle duplicates
	usedFilenames := make(map[string]int)

	// Generate markdown files
	progress(fmt.Sprintf("Generating %d markdown files...", len(rows)))
	created := 0

	for rowNum, row := range rows {
		// Build row map
		rowMap := make(map[string]string)
		for _, col := range includedColumns {
			if idx, ok := headerIndex[col]; ok && idx < len(row) {
				rowMap[col] = row[idx]
			}
		}

		// Determine filename
		nameValue := rowMap[cfg.NameColumn]
		var filename string
		if nameValue == "" {
			filename = fmt.Sprintf("row-%d", rowNum+1)
		} else {
			filename = Slugify(nameValue)
		}

		// Handle duplicates
		if count, exists := usedFilenames[filename]; exists {
			usedFilenames[filename] = count + 1
			filename = fmt.Sprintf("%s-%d", filename, count+1)
		} else {
			usedFilenames[filename] = 1
		}

		// Generate markdown content
		content := GenerateMarkdown(rowMap, cfg.ContentColumns, metadataColumns)

		// Write file
		filePath := filepath.Join(cfg.FolderName, filename+".md")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			return nil, fmt.Errorf("failed to write %s: %w", filePath, err)
		}
		created++
	}

	// Infer schema from columns
	columns := InferColumnTypes(headers, rows)
	schema := make(config.TableSchema)
	for _, col := range columns {
		if contains(includedColumns, col.Name) {
			schema[col.Name] = config.FieldSchema{
				Type: col.InferredType,
				Metadata: map[string]string{
					"source": "csv-import",
				},
			}
		}
	}

	// Save schema
	if err := config.SaveTableSchema(cfg.FolderName, schema); err != nil {
		return nil, fmt.Errorf("failed to save schema: %w", err)
	}

	// Build content field value (comma-separated for multiple)
	contentFieldValue := ""
	if len(cfg.ContentColumns) > 0 {
		contentFieldValue = strings.Join(cfg.ContentColumns, ",")
	}

	// Get absolute path for the CSV file
	absFilePath, err := filepath.Abs(cfg.FilePath)
	if err != nil {
		absFilePath = cfg.FilePath // Fall back to original if Abs fails
	}

	// Save table config
	tableConfig := &config.TableConfig{
		AccountID:     "",
		Provider:      "local-csv",
		TableID:       absFilePath,
		SiteID:        "",
		TableName:     cfg.FolderName,
		FilenameField: cfg.NameColumn,
		ContentField:  contentFieldValue,
	}

	if err := config.SaveTableConfig(cfg.FolderName, tableConfig); err != nil {
		return nil, fmt.Errorf("failed to save config: %w", err)
	}

	return &ImportResult{
		TotalRecords: len(rows),
		TotalCreated: created,
		FolderPath:   cfg.FolderName,
	}, nil
}

// determineIncludedColumns determines which columns to include based on include/exclude lists.
func determineIncludedColumns(headers []string, include []string, exclude []string) []string {
	// If include is specified, use those
	if len(include) > 0 {
		result := make([]string, 0)
		for _, col := range include {
			if contains(headers, col) && !contains(exclude, col) {
				result = append(result, col)
			}
		}
		return result
	}

	// Otherwise, use all headers minus excluded
	result := make([]string, 0)
	for _, col := range headers {
		if !contains(exclude, col) {
			result = append(result, col)
		}
	}
	return result
}

// contains checks if a string slice contains a value.
func contains(slice []string, value string) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

// GetColumnNames returns just the names from a slice of ColumnInfo.
func GetColumnNames(columns []ColumnInfo) []string {
	names := make([]string, len(columns))
	for i, col := range columns {
		names[i] = col.Name
	}
	return names
}
