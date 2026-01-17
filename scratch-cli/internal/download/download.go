// Package download provides shared table download functionality for the scratchmd CLI.
package download

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/providers"
	"gopkg.in/yaml.v3"
)

// TableDownloader handles downloading table records and attachments from CMS providers.
type TableDownloader struct {
	client  *api.Client
	cfg     *config.Config
	secrets *config.SecretsConfig
}

// Options configures the download behavior.
type Options struct {
	// Clobber deletes existing files before downloading fresh copies.
	Clobber bool
	// DownloadAttachments enables downloading file attachments.
	DownloadAttachments bool
	// OnProgress is called with status messages during download.
	// If nil, messages are silently discarded.
	OnProgress func(msg string)
}

// Result contains the outcome of a download operation.
type Result struct {
	TotalSaved       int
	TotalSkipped     int
	TotalAttachments int
}

// NewTableDownloader creates a new TableDownloader instance.
func NewTableDownloader(cfg *config.Config, secrets *config.SecretsConfig, serverURL string) *TableDownloader {
	return &TableDownloader{
		client:  api.NewClient(api.WithBaseURL(serverURL)),
		cfg:     cfg,
		secrets: secrets,
	}
}

// Download fetches records from the CMS and writes them as markdown files.
//
// Change detection: Compares the current file against the stored "original" copy.
// If the user has edited a file locally (current != original), that file is skipped
// to preserve local changes. The original copy is always updated for future comparisons.
//
// File structure created:
//   - <tableName>/*.md - User-editable markdown files
//   - .scratchmd/<tableName>/original/*.md - Pristine copies for change detection
func (d *TableDownloader) Download(tableName string, opts Options) (*Result, error) {
	progress := opts.OnProgress
	if progress == nil {
		progress = func(msg string) {} // no-op
	}

	// Load table config
	tableConfig, err := config.LoadTableConfig(tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to load table config: %w", err)
	}
	if tableConfig == nil {
		return nil, fmt.Errorf("table config not found for '%s'", tableName)
	}

	schema, err := config.LoadTableSchema(tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to load schema for table '%s': %w", tableName, err)
	}
	if schema == nil {
		return nil, fmt.Errorf("schema not found for table '%s'", tableName)
	}

	provider, err := providers.GetProvider(tableConfig.Provider)
	if err != nil {
		return nil, fmt.Errorf("failed to load provider for table '%s': %w", tableName, err)
	}

	// Get the account for this table
	account := d.cfg.GetAccountByID(tableConfig.AccountID)
	if account == nil {
		return nil, fmt.Errorf("account not found for table '%s'", tableName)
	}

	// Get the authentication properties
	authProps := d.secrets.GetSecretProperties(account.ID)
	if len(authProps) == 0 {
		return nil, fmt.Errorf("no credentials found for account '%s'", account.Name)
	}

	originalDir := filepath.Join(".scratchmd", tableName, "original")

	// If clobber, delete both folders first
	if opts.Clobber {
		progress(fmt.Sprintf("🗑️  Clobbering existing files for '%s'...", tableName))
		// Remove main folder contents (but not the folder itself, as it may have config)
		if entries, err := os.ReadDir(tableName); err == nil {
			for _, entry := range entries {
				if strings.HasSuffix(entry.Name(), ".md") {
					os.Remove(filepath.Join(tableName, entry.Name()))
				}
			}
		}
		// Remove assets folder in main folder
		os.RemoveAll(filepath.Join(tableName, "assets"))
		// Remove original folder entirely (includes original/assets)
		os.RemoveAll(originalDir)
	}

	progress(fmt.Sprintf("📥 Downloading '%s' from %s...", tableConfig.TableName, account.Name))

	// Build connector credentials
	creds := &api.ConnectorCredentials{
		Service: account.Provider,
		Params:  authProps,
	}

	// Build table ID array - if SiteID exists, use [siteId, tableId], otherwise just [tableId]
	var tableID []string
	if tableConfig.SiteID != "" {
		tableID = []string{tableConfig.SiteID, tableConfig.TableID}
	} else {
		tableID = []string{tableConfig.TableID}
	}

	// Build download request
	req := &api.DownloadRequest{
		TableID:         tableID,
		FilenameFieldID: tableConfig.FilenameField,
		ContentFieldID:  tableConfig.ContentField,
	}

	// Call the download endpoint
	resp, err := d.client.Download(creds, req)
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}

	// Check for errors in response
	if resp.Error != "" {
		return nil, fmt.Errorf("server error: %s", resp.Error)
	}

	// Create the .scratchmd/<folder>/original directory for tracking changes
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create original directory: %w", err)
	}

	// Ensure main folder exists
	if err := os.MkdirAll(tableName, 0755); err != nil {
		return nil, fmt.Errorf("failed to create table directory: %w", err)
	}

	// Save each file
	result := &Result{}
	for _, file := range resp.Files {
		// Use the slug directly as the filename (already sanitized by server)
		filename := file.Slug
		if filename == "" {
			filename = file.ID
		}

		fileContent := []byte(file.Content)
		mdFilename := filename + ".md"

		mainPath := filepath.Join(tableName, mdFilename)
		originalPath := filepath.Join(originalDir, mdFilename)

		// Check if main file should be updated
		// Only update main file if it matches the current original (unedited) or doesn't exist
		shouldUpdateMain := true
		if !opts.Clobber {
			// Read current original file (if exists)
			oldOriginal, errOldOrig := os.ReadFile(originalPath)
			// Read current main file (if exists)
			currentMain, errMain := os.ReadFile(mainPath)

			if errOldOrig == nil && errMain == nil {
				// Both files exist - only update main if it matches the old original
				if !bytes.Equal(currentMain, oldOriginal) {
					// Main file has been edited, don't overwrite it
					shouldUpdateMain = false
					result.TotalSkipped++
					progress(fmt.Sprintf("   ⏭️  Skipping '%s' (locally modified)", mdFilename))
				}
			}
			// If original doesn't exist or main doesn't exist, we'll write both
		}

		// Always update the original file
		if err := os.WriteFile(originalPath, fileContent, 0644); err != nil {
			progress(fmt.Sprintf("   ⚠️  Failed to save original '%s': %v", originalPath, err))
			continue
		}

		// Update main file only if appropriate
		if shouldUpdateMain {
			if err := os.WriteFile(mainPath, fileContent, 0644); err != nil {
				progress(fmt.Sprintf("   ⚠️  Failed to save '%s': %v", mainPath, err))
				continue
			}
		}

		result.TotalSaved++
	}

	if result.TotalSkipped > 0 {
		progress(fmt.Sprintf("✅ Downloaded %d record(s) to '%s/' (%d locally modified files preserved)", result.TotalSaved, tableName, result.TotalSkipped))
	} else {
		progress(fmt.Sprintf("✅ Downloaded %d record(s) to '%s/'", result.TotalSaved, tableName))
	}

	// Update lastDownload timestamp in table config
	tableConfig.LastDownload = time.Now().Format(time.RFC3339)
	if err := config.SaveTableConfig(tableName, tableConfig); err != nil {
		progress(fmt.Sprintf("   ⚠️  Failed to update lastDownload: %v", err))
	}

	// Phase 2: Download attachments if enabled and the provider supports them
	if opts.DownloadAttachments && provider.SupportsAttachments() {
		attachmentFields := getAttachmentFields(schema)
		if len(attachmentFields) > 0 {
			attachments, err := d.downloadAttachments(tableName, originalDir, resp.Files, attachmentFields, provider, progress)
			if err != nil {
				progress(fmt.Sprintf("   ⚠️  Attachment download error: %v", err))
			}
			result.TotalAttachments = attachments
		}
	}

	return result, nil
}

// downloadAttachments downloads file attachments and updates markdown frontmatter.
//
// For each file's attachment fields, it:
//  1. Extracts attachment URLs from YAML frontmatter
//  2. Downloads files to <tableName>/assets/ with format: <name>-<id>.<ext>
//  3. Updates the asset manifest for tracking downloaded files
//  4. Rewrites frontmatter to reference local asset paths instead of remote URLs
//
// Attachments are not re-downloaded if they already exist (immutable sources like Airtable).
func (d *TableDownloader) downloadAttachments(
	tableName string,
	originalDir string,
	files []api.FileContent,
	attachmentFields []string,
	provider providers.Provider,
	progress func(string),
) (int, error) {
	// Create assets folder in the content folder
	assetsDir := filepath.Join(tableName, "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create assets directory: %w", err)
	}

	// Load or create the asset manifest
	assetManifestPath := filepath.Join(originalDir, config.AssetManifestFileName)
	assetManifest, err := config.LoadAssetManifest(assetManifestPath)
	if err != nil {
		progress(fmt.Sprintf("   ⚠️  Failed to load asset manifest: %v", err))
		assetManifest = &config.AssetManifest{Assets: []config.AssetEntry{}}
	}

	// Check if provider implements AttachmentExtractor
	extractor, ok := provider.(providers.AttachmentExtractor)
	if !ok {
		return 0, nil
	}

	progress(fmt.Sprintf("📎 Downloading attachments for fields: %v", attachmentFields))
	totalAttachments := 0

	// Process each downloaded file to extract and download attachments
	for _, file := range files {
		// Parse the file content to get field values, organized by field
		fieldAttachments, allAttachments := extractAttachmentsFromContentByField(file.Content, attachmentFields, extractor)

		if len(allAttachments) > 0 {
			// Download to content assets folder (overwrite=false since Airtable attachments are immutable)
			downloaded, err := providers.DownloadAttachments(assetsDir, allAttachments, false, func(msg string) {
				progress(fmt.Sprintf("   %s", msg))
			})
			if err != nil {
				progress(fmt.Sprintf("   ⚠️  Failed to download attachments for '%s': %v", file.Slug, err))
			}
			totalAttachments += downloaded

			// Track downloaded files in manifest
			for _, att := range allAttachments {
				if att.Name == "" || att.ID == "" {
					continue
				}
				ext := filepath.Ext(att.Name)
				nameWithoutExt := strings.TrimSuffix(att.Name, ext)
				filename := fmt.Sprintf("%s-%s%s", nameWithoutExt, att.ID, ext)
				srcPath := filepath.Join(assetsDir, filename)

				// Get file info for the manifest
				fileInfo, err := os.Stat(srcPath)
				if err != nil {
					// File may not exist if it was skipped (already exists)
					continue
				}

				// Calculate checksum
				checksum, err := config.CalculateFileChecksum(srcPath)
				if err != nil {
					progress(fmt.Sprintf("   ⚠️  Failed to calculate checksum for '%s': %v", filename, err))
					checksum = ""
				}

				// Create or update asset entry
				assetEntry := config.AssetEntry{
					ID:               att.ID,
					FileID:           file.ID,
					Filename:         filename,
					FileSize:         fileInfo.Size(),
					Checksum:         checksum,
					MimeType:         att.Type,
					LastDownloadDate: time.Now().UTC().Format(time.RFC3339),
				}
				assetManifest.UpsertAsset(assetEntry)
			}

			// Update frontmatter in both main and original files with local asset paths
			filename := file.Slug
			if filename == "" {
				filename = file.ID
			}
			mdFilename := filename + ".md"
			mainPath := filepath.Join(tableName, mdFilename)
			originalPath := filepath.Join(originalDir, mdFilename)

			if err := updateFrontmatterAttachments(mainPath, fieldAttachments); err != nil {
				progress(fmt.Sprintf("   ⚠️  Failed to update frontmatter in '%s': %v", mainPath, err))
			}
			if err := updateFrontmatterAttachments(originalPath, fieldAttachments); err != nil {
				progress(fmt.Sprintf("   ⚠️  Failed to update frontmatter in '%s': %v", originalPath, err))
			}
		}
	}

	// Save the updated asset manifest
	if err := config.SaveAssetManifest(assetManifestPath, assetManifest); err != nil {
		progress(fmt.Sprintf("   ⚠️  Failed to save asset manifest: %v", err))
	}

	if totalAttachments > 0 {
		progress(fmt.Sprintf("📎 Downloaded %d attachment(s) to assets folder", totalAttachments))
	}

	return totalAttachments, nil
}

// getAttachmentFields returns the field slugs that have attachment metadata.
// It checks for fields with metadata.attachments set to "single" or "multiple".
func getAttachmentFields(schema config.TableSchema) []string {
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

// extractAttachmentsFromContentByField parses YAML frontmatter to extract attachment metadata.
//
// Parses the "---" delimited frontmatter, looks up each attachmentField in the YAML,
// and uses the provider's ExtractAttachments to convert field values to Attachment structs.
// Returns both a per-field map (for updating frontmatter) and a flat list (for downloading).
func extractAttachmentsFromContentByField(content string, attachmentFields []string, extractor providers.AttachmentExtractor) (map[string][]providers.Attachment, []providers.Attachment) {
	fieldAttachments := make(map[string][]providers.Attachment)
	var allAttachments []providers.Attachment

	// Check for YAML frontmatter
	if !strings.HasPrefix(content, "---") {
		return fieldAttachments, nil
	}

	// Find the end of frontmatter
	rest := content[3:] // Skip initial ---
	endIndex := strings.Index(rest, "\n---")
	if endIndex == -1 {
		return fieldAttachments, nil
	}

	yamlContent := rest[:endIndex]

	// Parse YAML into map
	var yamlData map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &yamlData); err != nil {
		return fieldAttachments, nil
	}

	// Extract attachments from each attachment field
	for _, fieldName := range attachmentFields {
		fieldValue, ok := yamlData[fieldName]
		if !ok {
			continue
		}

		attachments, err := extractor.ExtractAttachments(fieldValue)
		if err != nil {
			continue // Skip fields that fail to extract
		}

		if len(attachments) > 0 {
			fieldAttachments[fieldName] = attachments
			allAttachments = append(allAttachments, attachments...)
		}
	}

	return fieldAttachments, allAttachments
}

// updateFrontmatterAttachments rewrites a markdown file's YAML frontmatter to use local asset paths.
//
// For each attachment field, replaces the original value (remote URL structure) with
// an array of local paths like ["assets/image-abc123.jpg"]. This enables the markdown
// files to reference downloaded assets instead of remote URLs.
func updateFrontmatterAttachments(filePath string, fieldAttachments map[string][]providers.Attachment) error {
	if len(fieldAttachments) == 0 {
		return nil
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	contentStr := string(content)

	// Check for existing YAML frontmatter
	if !strings.HasPrefix(contentStr, "---") {
		return nil // No frontmatter to update
	}

	// Find the end of frontmatter
	rest := contentStr[3:] // Skip initial ---
	endIndex := strings.Index(rest, "\n---")
	if endIndex == -1 {
		return nil // Malformed frontmatter
	}

	yamlContent := rest[:endIndex]
	markdownContent := rest[endIndex+4:] // Skip \n---

	// Parse existing YAML
	var yamlData map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &yamlData); err != nil {
		return fmt.Errorf("failed to parse YAML frontmatter: %w", err)
	}

	// Update each attachment field with local file paths
	for fieldName, attachments := range fieldAttachments {
		var assetPaths []string
		for _, att := range attachments {
			if att.Name == "" || att.ID == "" {
				continue
			}
			ext := filepath.Ext(att.Name)
			nameWithoutExt := strings.TrimSuffix(att.Name, ext)
			filename := fmt.Sprintf("%s-%s%s", nameWithoutExt, att.ID, ext)
			assetPaths = append(assetPaths, fmt.Sprintf("assets/%s", filename))
		}
		if len(assetPaths) > 0 {
			yamlData[fieldName] = assetPaths
		}
	}

	// Marshal back to YAML
	newYAML, err := yaml.Marshal(yamlData)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	// Reconstruct the file
	newContent := fmt.Sprintf("---\n%s---\n%s", string(newYAML), strings.TrimPrefix(markdownContent, "\n"))
	return os.WriteFile(filePath, []byte(newContent), 0644)
}
