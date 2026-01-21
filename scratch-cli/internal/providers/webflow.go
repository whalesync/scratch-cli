package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// WebflowProvider implements the Provider interface for Webflow
type WebflowProvider struct{}

func (w *WebflowProvider) Name() string {
	return "webflow"
}

func (w *WebflowProvider) DisplayName() string {
	return "Webflow"
}

// AuthProperties returns the authentication properties needed for Webflow
func (w *WebflowProvider) AuthProperties() []AuthProperty {
	return []AuthProperty{
		{
			Key:         "apiKey",
			DisplayName: "API Key",
			Description: "Your Webflow API token",
			Required:    true,
			Sensitive:   true,
		},
	}
}

// SupportsAttachments returns whether the provider supports downloading attachments
func (w *WebflowProvider) SupportsAttachments() bool {
	return false
}

// MaxAttachmentUploadSize returns 0 as Webflow does not support attachment uploads
func (w *WebflowProvider) MaxAttachmentUploadSize() int64 {
	return 0
}

// ValidateAttachmentFile returns an empty slice as Webflow does not support attachment uploads
func (w *WebflowProvider) ValidateAttachmentFile(filePath string) []string {
	return []string{}
}

// UploadAttachment uploads a file attachment to Webflow.
// Currently returns ErrUploadNotSupported as this is not yet implemented.
func (w *WebflowProvider) UploadAttachment(creds ConnectorCredentials, siteID, tableID, recordID, fieldID string, file UploadFile) (*FileAttachment, error) {
	return nil, ErrUploadNotSupported
}

// Webflow API response types
type webflowSitesResponse struct {
	Sites []webflowSite `json:"sites"`
}

type webflowSite struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	ShortName   string `json:"shortName"`
}

type webflowCollectionsResponse struct {
	Collections []webflowCollection `json:"collections"`
}

type webflowCollection struct {
	ID           string         `json:"id"`
	DisplayName  string         `json:"displayName"`
	Slug         string         `json:"slug"`
	SingularName string         `json:"singularName"`
	Fields       []webflowField `json:"fields"`
}

type webflowField struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Slug        string `json:"slug"`
	Type        string `json:"type"`
	IsRequired  bool   `json:"isRequired"`
	HelpText    string `json:"helpText"`
}

// Record represents a single record from a CMS table
type Record struct {
	ID      string                 // Record ID
	Slug    string                 // URL-friendly slug (used as filename)
	RawData map[string]interface{} // Raw data from the API
}

// ecommerceCollectionSlugs contains slugs of Webflow ecommerce collections to skip
var ecommerceCollectionSlugs = []string{"products", "categories", "skus"}

// ListTables returns all available Webflow collections across all sites
func (w *WebflowProvider) ListTables(apiKey string, progress ProgressCallback) ([]TableInfo, error) {
	var tables []TableInfo

	// Step 1: Get all sites
	progress("Fetching sites...")
	sites, err := w.listSites(apiKey)
	if err != nil {
		return nil, fmt.Errorf("failed to list sites: %w", err)
	}
	progress(fmt.Sprintf("Found %d site(s)", len(sites)))

	// Step 2: For each site, get collections
	for _, site := range sites {
		progress(fmt.Sprintf("Fetching collections from '%s'...", site.DisplayName))

		collections, err := w.listCollections(apiKey, site.ID)
		if err != nil {
			progress(fmt.Sprintf("Warning: Failed to get collections for site '%s': %v", site.DisplayName, err))
			continue
		}

		for _, collectionSummary := range collections {
			// Skip ecommerce collections
			if isEcommerceCollection(collectionSummary.Slug) {
				continue
			}

			// Fetch full collection details to get fields
			progress(fmt.Sprintf("  Fetching schema for '%s'...", collectionSummary.DisplayName))
			collection, err := w.getCollection(apiKey, collectionSummary.ID)
			if err != nil {
				progress(fmt.Sprintf("  Warning: Failed to get schema for '%s': %v", collectionSummary.DisplayName, err))
				// Use summary data without fields
				collection = &collectionSummary
			}

			// Convert user-defined fields
			fields := make([]FieldInfo, len(collection.Fields))
			for i, f := range collection.Fields {
				fields[i] = FieldInfo{
					ID:       f.ID,
					Name:     f.DisplayName,
					Slug:     f.Slug,
					Type:     f.Type,
					Required: f.IsRequired,
					HelpText: f.HelpText,
				}
			}

			// Add Webflow system fields
			systemFields := []FieldInfo{
				{Slug: "id", Name: "ID", Type: "string"},
				{Slug: "cmsLocaleId", Name: "CMS Locale ID", Type: "string"},
				{Slug: "isDraft", Name: "Is Draft", Type: "boolean"},
				{Slug: "isArchived", Name: "Is Archived", Type: "boolean"},
				{Slug: "createdOn", Name: "Created On", Type: "datetime"},
				{Slug: "lastUpdated", Name: "Last Updated", Type: "datetime"},
				{Slug: "lastPublished", Name: "Last Published", Type: "datetime"},
			}

			tables = append(tables, TableInfo{
				ID:           collection.ID,
				Name:         collection.DisplayName,
				Slug:         collection.Slug,
				SiteID:       site.ID,
				SiteName:     site.DisplayName,
				Fields:       fields,
				SystemFields: systemFields,
				ExtraInfo: map[string]string{
					"singularName": collection.SingularName,
				},
			})
		}
		progress(fmt.Sprintf("Found %d collection(s) in '%s'", len(collections), site.DisplayName))
	}

	progress(fmt.Sprintf("Total: %d table(s) available", len(tables)))
	return tables, nil
}

func (w *WebflowProvider) listSites(apiKey string) ([]webflowSite, error) {
	req, err := http.NewRequest("GET", "https://api.webflow.com/v2/sites", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result webflowSitesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Sites, nil
}

func (w *WebflowProvider) listCollections(apiKey, siteID string) ([]webflowCollection, error) {
	url := fmt.Sprintf("https://api.webflow.com/v2/sites/%s/collections", siteID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result webflowCollectionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Collections, nil
}

// getCollection fetches a single collection with its fields schema
func (w *WebflowProvider) getCollection(apiKey, collectionID string) (*webflowCollection, error) {
	url := fmt.Sprintf("https://api.webflow.com/v2/collections/%s", collectionID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result webflowCollection
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func isEcommerceCollection(slug string) bool {
	for _, s := range ecommerceCollectionSlugs {
		if slug == s {
			return true
		}
	}
	return false
}

// Webflow items response types
type webflowItemsResponse struct {
	Items      []map[string]interface{} `json:"items"`
	Pagination *webflowPagination       `json:"pagination"`
}

type webflowPagination struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

const webflowBatchSize = 100

// DownloadRecords fetches all items from a Webflow collection
func (w *WebflowProvider) DownloadRecords(apiKey string, collectionID string, progress ProgressCallback, callback func(records []Record) error) error {
	offset := 0
	totalFetched := 0

	for {
		progress(fmt.Sprintf("Fetching records (offset %d)...", offset))

		items, pagination, err := w.listItems(apiKey, collectionID, offset, webflowBatchSize)
		if err != nil {
			return fmt.Errorf("failed to fetch items: %w", err)
		}

		if len(items) == 0 {
			break
		}

		// Convert to Record structs
		records := make([]Record, 0, len(items))
		for _, item := range items {
			record := Record{
				RawData: item,
			}

			// Extract ID
			if id, ok := item["id"].(string); ok {
				record.ID = id
			}

			// Extract slug from fieldData
			if fieldData, ok := item["fieldData"].(map[string]interface{}); ok {
				if slug, ok := fieldData["slug"].(string); ok {
					record.Slug = slug
				}
			}

			// Fallback to ID if no slug
			if record.Slug == "" {
				record.Slug = record.ID
			}

			records = append(records, record)
		}

		totalFetched += len(records)
		progress(fmt.Sprintf("Downloaded %d record(s) so far...", totalFetched))

		// Call the callback with this batch
		if err := callback(records); err != nil {
			return err
		}

		// Check if there are more items
		if pagination == nil {
			// No pagination info, assume done if we got less than limit
			if len(items) < webflowBatchSize {
				break
			}
			offset += len(items)
		} else {
			offset += len(items)
			if offset >= pagination.Total {
				break
			}
		}
	}

	progress(fmt.Sprintf("Download complete: %d record(s)", totalFetched))
	return nil
}

func (w *WebflowProvider) listItems(apiKey, collectionID string, offset, limit int) ([]map[string]interface{}, *webflowPagination, error) {
	url := fmt.Sprintf("https://api.webflow.com/v2/collections/%s/items?offset=%d&limit=%d", collectionID, offset, limit)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := HTTPClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result webflowItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, nil, err
	}

	return result.Items, result.Pagination, nil
}
