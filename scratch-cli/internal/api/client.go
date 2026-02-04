// Package api provides a client for interacting with the Scratch CLI server API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"
)

// DefaultScratchURL is the default base URL for the scratch API
// This can be overridden at build time using:
// go build -ldflags "-X github.com/whalesync/scratch-cli/internal/config.DefaultScratchURL=https://api.example.com"
var DefaultScratchServerURL = "http://localhost:3010"

// DefaultTimeout is the default timeout for API requests.
const DefaultTimeout = 120 * time.Second

// DefaultUserAgent is the default User-Agent header for API requests.
const DefaultUserAgent = "Scratch-CLI"

// Version is the CLI version sent to the server.
// This should be set by the main package at startup.
var Version = "dev"

// SupportedProviders returns the list of supported provider names
func SupportedDataSources() []string {
	return []string{"webflow", "wordpress", "airtable", "notion"}
}

// Client represents a client for the Scratch CLI API.
type Client struct {
	baseURL    string
	httpClient *http.Client
	apiToken   string // API token for authenticated requests
}

// ConnectorCredentials represents the credentials for a connector.
// These are sent via the X-Scratch-Connector header.
type ConnectorCredentials struct {
	Service string            `json:"service"`
	Params  map[string]string `json:"params,omitempty"`
}

// TestConnectionResponse represents the response from the test-credentials endpoint.
type TestConnectionResponse struct {
	Success bool   `json:"success"`
	Service string `json:"service,omitempty"`
	Error   string `json:"error,omitempty"`
}

// TableInfo represents a table with its JSON Schema.
type TableInfo struct {
	ID       string                 `json:"id,omitempty"`
	SiteID   string                 `json:"siteId,omitempty"`
	SiteName string                 `json:"siteName,omitempty"`
	Name     string                 `json:"name,omitempty"`
	Slug     string                 `json:"slug,omitempty"`
	Schema   map[string]interface{} `json:"schema,omitempty"`
	IdField  string                 `json:"idField,omitempty"` // The field name to use as the unique identifier (e.g., 'id', 'uid')
}

// ListTablesResponse represents the response from the list-tables endpoint.
type ListTablesResponse struct {
	Error  string      `json:"error,omitempty"`
	Tables []TableInfo `json:"tables,omitempty"`
}

// DownloadRequest represents the request body for the download endpoint.
type DownloadRequest struct {
	TableID         []string `json:"tableId"`
	FilenameFieldID string   `json:"filenameFieldId,omitempty"`
	ContentFieldID  string   `json:"contentFieldId,omitempty"`
	Offset          int      `json:"offset,omitempty"`
	Limit           int      `json:"limit,omitempty"`
}

// FileContent represents a downloaded file with its metadata.
type FileContent struct {
	Slug    string `json:"slug"`    // A file name slug, should be URL-friendly and unique
	ID      string `json:"id"`      // The remote ID of remote record that this file was generated from
	Content string `json:"content"` // The content of the file in Frontmatter YAML format
}

// DownloadResponse represents the response from the download endpoint.
type DownloadResponse struct {
	Error string        `json:"error,omitempty"`
	Files []FileContent `json:"files,omitempty"`
}

// UploadOpType represents the type of upload operation.
type UploadOpType string

const (
	OpCreate UploadOpType = "create"
	OpUpdate UploadOpType = "update"
	OpDelete UploadOpType = "delete"
)

// UploadOperation represents a single file operation (create, update, or delete) for upload.
type UploadOperation struct {
	Op       UploadOpType           `json:"op"`       // OpCreate, OpUpdate, or OpDelete
	ID       string                 `json:"id"`       // Required for update and delete operations
	Filename string                 `json:"filename"` // The filename this operation originated from
	Data     map[string]interface{} `json:"data"`     // The content as key-value pairs (not used for delete)
}

// uploadRequest represents the request body for the upload endpoint (internal use).
type uploadRequest struct {
	TableID []string                 `json:"tableId,omitempty"`
	Creates []map[string]interface{} `json:"creates,omitempty"`
	Updates []map[string]interface{} `json:"updates,omitempty"`
	Deletes []map[string]interface{} `json:"deletes,omitempty"`
}

// UploadResult represents the result of a single upload operation.
type UploadResult struct {
	Op       string `json:"op"`
	ID       string `json:"id"`
	Filename string `json:"filename"`
	Error    string `json:"error,omitempty"`
}

// UploadResponse represents the response from the upload endpoint.
type UploadResponse struct {
	Results []UploadResult `json:"results"`
}

// AuthInitiateResponse represents the response from the auth initiate endpoint.
type AuthInitiateResponse struct {
	UserCode        string `json:"userCode,omitempty"`
	PollingCode     string `json:"pollingCode,omitempty"`
	VerificationURL string `json:"verificationUrl,omitempty"`
	ExpiresIn       int    `json:"expiresIn,omitempty"`
	Interval        int    `json:"interval,omitempty"`
	Error           string `json:"error,omitempty"`
}

// AuthPollResponse represents the response from the auth poll endpoint.
type AuthPollResponse struct {
	Status         string `json:"status,omitempty"`         // "pending", "approved", "denied", "expired"
	APIToken       string `json:"apiToken,omitempty"`       // Only set when status is "approved"
	UserEmail      string `json:"userEmail,omitempty"`      // Only set when status is "approved"
	TokenExpiresAt string `json:"tokenExpiresAt,omitempty"` // Only set when status is "approved"
	Error          string `json:"error,omitempty"`
}

// FileToValidate represents a file to be validated against the table schema.
type FileToValidate struct {
	ID       string                 `json:"id,omitempty"` // The remote ID of the record (optional for new files)
	Filename string                 `json:"filename"`     // The filename of the file
	Data     map[string]interface{} `json:"data"`         // The content as key-value pairs (parsed frontmatter)
}

// ValidateFilesRequest represents the request body for the validate-files endpoint.
type ValidateFilesRequest struct {
	TableID []string         `json:"tableId"`
	Files   []FileToValidate `json:"files"`
}

// ValidatedFileResult represents the validation result for a single file.
type ValidatedFileResult struct {
	ID          string                 `json:"id,omitempty"` // The remote ID of the record (if provided)
	Filename    string                 `json:"filename"`     // The filename of the file
	Data        map[string]interface{} `json:"data"`         // The content as key-value pairs
	Publishable bool                   `json:"publishable"`  // Whether the file passed validation
	Errors      []string               `json:"errors,omitempty"`
}

// ValidateFilesResponse represents the response from the validate-files endpoint.
type ValidateFilesResponse struct {
	Error string                `json:"error,omitempty"`
	Files []ValidatedFileResult `json:"files,omitempty"`
}

// Workbook represents a workbook returned by the API.
type Workbook struct {
	ID             string       `json:"id,omitempty"`
	Name           string       `json:"name,omitempty"`
	CreatedAt      string       `json:"createdAt,omitempty"`
	UpdatedAt      string       `json:"updatedAt,omitempty"`
	UserId         string       `json:"userId,omitempty"`
	OrganizationId string       `json:"organizationId,omitempty"`
	DataFolders    []DataFolder `json:"dataFolders,omitempty"`
}

// DataFolder represents a data folder within a workbook.
type DataFolder struct {
	ID                   string   `json:"id,omitempty"`
	Name                 string   `json:"name,omitempty"`
	CreatedAt            string   `json:"createdAt,omitempty"`
	UpdatedAt            string   `json:"updatedAt,omitempty"`
	WorkbookId           string   `json:"workbookId,omitempty"`
	ConnectorAccountId   string   `json:"connectorAccountId,omitempty"`
	ConnectorService     string   `json:"connectorService,omitempty"`
	ConnectorDisplayName string   `json:"connectorDisplayName,omitempty"`
	ParentId             string   `json:"parentId,omitempty"`
	Path                 string   `json:"path,omitempty"`
	Lock                 string   `json:"lock,omitempty"`
	LastSyncTime         string   `json:"lastSyncTime,omitempty"`
	TableId              []string `json:"tableId,omitempty"`
}

// FolderMetadata represents metadata about a downloaded folder.
type FolderMetadata struct {
	ID                   string                 `json:"id"`
	Name                 string                 `json:"name"`
	WorkbookID           string                 `json:"workbookId"`
	ConnectorService     string                 `json:"connectorService,omitempty"`
	ConnectorDisplayName string                 `json:"connectorDisplayName,omitempty"`
	TableID              []string               `json:"tableId,omitempty"`
	Path                 string                 `json:"path,omitempty"`
	Schema               map[string]interface{} `json:"schema,omitempty"`
	LastSyncTime         string                 `json:"lastSyncTime,omitempty"`
}

// SyncOperation represents the type of sync operation.
type SyncOperation string

const (
	SyncOperationDownload SyncOperation = "download"
	SyncOperationUpload   SyncOperation = "upload"
)

// LocalFile represents a file from the CLI's local filesystem.
type LocalFile struct {
	Name            string `json:"name"`
	Content         string `json:"content"`
	OriginalHash    string `json:"originalHash"`
	OriginalContent string `json:"originalContent,omitempty"` // For three-way merge
	Deleted         bool   `json:"deleted,omitempty"`
}

// SyncFolderRequest represents the request body for the sync endpoint.
type SyncFolderRequest struct {
	Operation  SyncOperation `json:"operation"`
	LocalFiles []LocalFile   `json:"localFiles"`
}

// SyncedFile represents a file returned from the sync endpoint.
type SyncedFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Hash    string `json:"hash"`
}

// DeletedFileInfo represents information about a deleted file.
type DeletedFileInfo struct {
	Name            string `json:"name"`
	DeletedBy       string `json:"deletedBy"` // "local" or "server"
	HadLocalChanges bool   `json:"hadLocalChanges"`
}

// ConflictInfo represents information about a resolved conflict.
type ConflictInfo struct {
	File        string `json:"file"`
	Field       string `json:"field,omitempty"`
	Resolution  string `json:"resolution"`
	LocalValue  string `json:"localValue,omitempty"`
	ServerValue string `json:"serverValue,omitempty"`
}

// SyncFolderResponse represents the response from the sync endpoint.
type SyncFolderResponse struct {
	Success      bool              `json:"success"`
	Error        string            `json:"error,omitempty"`
	Folder       *FolderMetadata   `json:"folder,omitempty"`
	Files        []SyncedFile      `json:"files,omitempty"`
	DeletedFiles []DeletedFileInfo `json:"deletedFiles,omitempty"`
	Conflicts    []ConflictInfo    `json:"conflicts,omitempty"`
	SyncHash     string            `json:"syncHash,omitempty"`
}

// ClientOption is a function that configures a Client.
type ClientOption func(*Client)

// WithBaseURL sets the base URL for the client.
// If not provided, the default from config.DefaultScratchURL will be used.
func WithBaseURL(baseURL string) ClientOption {
	return func(c *Client) {
		c.baseURL = baseURL
	}
}

// WithTimeout sets the timeout for the HTTP client.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = timeout
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = httpClient
	}
}

// WithAPIToken sets the API token for authenticated requests.
// When set, requests will include an Authorization header with the format "API-Token <token>".
func WithAPIToken(token string) ClientOption {
	return func(c *Client) {
		c.apiToken = token
	}
}

// NewClient creates a new API client with the given options.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		baseURL: DefaultScratchServerURL,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// buildConnectorHeader builds the X-Scratch-Connector header value from credentials.
func buildConnectorHeader(creds *ConnectorCredentials) (string, error) {
	if creds == nil {
		return "", nil
	}
	data, err := json.Marshal(creds)
	if err != nil {
		return "", fmt.Errorf("failed to marshal connector credentials: %w", err)
	}
	return string(data), nil
}

// doRequest performs an HTTP request and decodes the JSON response.
func (c *Client) doRequest(method, path string, creds *ConnectorCredentials, body interface{}, result interface{}) error {
	u, err := url.JoinPath(c.baseURL, "cli/v1", path)
	if err != nil {
		return fmt.Errorf("failed to build URL: %w", err)
	}

	var bodyReader io.Reader
	if body != nil {
		// Use encoder with SetEscapeHTML(false) to preserve characters like & without escaping to \u0026
		var buf bytes.Buffer
		encoder := json.NewEncoder(&buf)
		encoder.SetEscapeHTML(false)
		if err := encoder.Encode(body); err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = &buf
	}

	req, err := http.NewRequest(method, u, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", DefaultUserAgent+"/"+Version)
	req.Header.Set("X-Scratch-CLI-Version", Version)

	// Add Authorization header if API token is set
	if c.apiToken != "" {
		req.Header.Set("Authorization", "API-Token "+c.apiToken)
	}

	if creds != nil {
		headerValue, err := buildConnectorHeader(creds)
		if err != nil {
			return err
		}
		req.Header.Set("X-Scratch-Connector", headerValue)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// TestConnection tests the provided connector credentials.
func (c *Client) TestConnection(creds *ConnectorCredentials) (*TestConnectionResponse, error) {
	var result TestConnectionResponse
	if err := c.doRequest(http.MethodGet, "test-connection", creds, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListTables retrieves the list of available tables with their JSON Schema specs.
func (c *Client) ListTables(creds *ConnectorCredentials) (*ListTablesResponse, error) {
	var result ListTablesResponse
	if err := c.doRequest(http.MethodGet, "list-tables", creds, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Download downloads files from the specified table using the download endpoint.
func (c *Client) Download(creds *ConnectorCredentials, req *DownloadRequest) (*DownloadResponse, error) {
	var result DownloadResponse
	if err := c.doRequest(http.MethodPost, "download", creds, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Upload uploads file changes (creates, updates, deletes) to the specified table.
func (c *Client) Upload(creds *ConnectorCredentials, tableID []string, operations []UploadOperation) (*UploadResponse, error) {
	// Build the request by separating operations into creates, updates, and deletes
	req := uploadRequest{
		TableID: tableID,
	}

	for _, op := range operations {
		switch op.Op {
		case OpCreate:
			req.Creates = append(req.Creates, map[string]interface{}{
				"op":       op.Op,
				"filename": op.Filename,
				"data":     op.Data,
			})
		case OpUpdate:
			req.Updates = append(req.Updates, map[string]interface{}{
				"op":       op.Op,
				"id":       op.ID,
				"filename": op.Filename,
				"data":     op.Data,
			})
		case OpDelete:
			req.Deletes = append(req.Deletes, map[string]interface{}{
				"op":       op.Op,
				"id":       op.ID,
				"filename": op.Filename,
			})
		default:
			return nil, fmt.Errorf("invalid operation type %q for file %q: must be create, update, or delete", op.Op, op.Filename)
		}
	}

	var result UploadResponse
	if err := c.doRequest(http.MethodPost, "upload", creds, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckHealth performs a health check against the server's /health endpoint.
// This is used to verify the server URL is valid and reachable.
func (c *Client) CheckHealth() error {
	u, err := url.JoinPath(c.baseURL, "health")
	if err != nil {
		return fmt.Errorf("failed to build URL: %w", err)
	}

	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", DefaultUserAgent)
	req.Header.Set("X-Scratch-CLI-Version", Version)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	return nil
}

// InitiateAuth starts the authorization flow.
// Returns a user code (for display) and polling code (for polling).
func (c *Client) InitiateAuth() (*AuthInitiateResponse, error) {
	var result AuthInitiateResponse
	if err := c.doRequest(http.MethodPost, "auth/initiate", nil, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PollAuth checks the authorization status for a polling code.
// Returns the API token when the user has approved the authorization.
func (c *Client) PollAuth(pollingCode string) (*AuthPollResponse, error) {
	body := map[string]string{"pollingCode": pollingCode}
	var result AuthPollResponse
	if err := c.doRequest(http.MethodPost, "auth/poll", nil, body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ValidateFiles validates files against the table schema before publishing.
func (c *Client) ValidateFiles(creds *ConnectorCredentials, req *ValidateFilesRequest) (*ValidateFilesResponse, error) {
	var result ValidateFilesResponse
	if err := c.doRequest(http.MethodPost, "validate-files", creds, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListWorkbooks retrieves the list of workbooks available for the authenticated user.
func (c *Client) ListWorkbooks() ([]Workbook, error) {
	var result []Workbook
	if err := c.doRequest(http.MethodGet, "workbooks", nil, nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ListDataFolders retrieves the list of data folders in a workbook.
func (c *Client) ListDataFolders(workbookId string) ([]DataFolder, error) {
	var result []DataFolder
	path := fmt.Sprintf("workbooks/%s/folders", workbookId)
	if err := c.doRequest(http.MethodGet, path, nil, nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// SyncFolder syncs a folder between local and server state.
// For download: merges server state with local files, local wins on conflict.
// For upload: merges local files with server state and commits to dirty branch.
// Deprecated: Use GetFolderFiles + local merge + PutFolderFiles instead.
func (c *Client) SyncFolder(folderId string, req *SyncFolderRequest) (*SyncFolderResponse, error) {
	var result SyncFolderResponse
	path := fmt.Sprintf("folders/%s/sync", folderId)
	if err := c.doRequest(http.MethodPost, path, nil, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ServerFile represents a file from the server's dirty branch.
type ServerFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Hash    string `json:"hash"`
}

// GetFolderFilesResponse represents the response from the get folder files endpoint.
type GetFolderFilesResponse struct {
	Success bool            `json:"success"`
	Error   string          `json:"error,omitempty"`
	Folder  *FolderMetadata `json:"folder,omitempty"`
	Files   []ServerFile    `json:"files,omitempty"`
}

// FileToWrite represents a file to write to the server.
type FileToWrite struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// PutFolderFilesRequest represents the request body for the put folder files endpoint.
type PutFolderFilesRequest struct {
	Files        []FileToWrite `json:"files"`
	DeletedFiles []string      `json:"deletedFiles"`
}

// PutFolderFilesResponse represents the response from the put folder files endpoint.
type PutFolderFilesResponse struct {
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
	SyncHash string `json:"syncHash,omitempty"`
}

// GetFolderFiles retrieves all files from a folder on the server's dirty branch.
// This is a simple storage layer operation - no merge logic.
func (c *Client) GetFolderFiles(folderId string) (*GetFolderFilesResponse, error) {
	var result GetFolderFilesResponse
	path := fmt.Sprintf("folders/%s/files", folderId)
	if err := c.doRequest(http.MethodGet, path, nil, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PutFolderFiles writes pre-merged files to a folder on the server's dirty branch.
// Uses multipart/form-data to send raw file content without JSON encoding.
func (c *Client) PutFolderFiles(folderId string, req *PutFolderFilesRequest) (*PutFolderFilesResponse, error) {
	u, err := url.JoinPath(c.baseURL, "cli/v1", fmt.Sprintf("folders/%s/files", folderId))
	if err != nil {
		return nil, fmt.Errorf("failed to build URL: %w", err)
	}

	// Create multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add each file as a form file part with raw content
	for _, file := range req.Files {
		part, err := writer.CreateFormFile("files", file.Name)
		if err != nil {
			return nil, fmt.Errorf("failed to create form file: %w", err)
		}
		if _, err := part.Write([]byte(file.Content)); err != nil {
			return nil, fmt.Errorf("failed to write file content: %w", err)
		}
	}

	// Add deleted files as a JSON field
	if len(req.DeletedFiles) > 0 {
		deletedJSON, _ := json.Marshal(req.DeletedFiles)
		if err := writer.WriteField("deletedFiles", string(deletedJSON)); err != nil {
			return nil, fmt.Errorf("failed to write deleted files: %w", err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	httpReq, err := http.NewRequest(http.MethodPut, u, &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", DefaultUserAgent+"/"+Version)
	httpReq.Header.Set("X-Scratch-CLI-Version", Version)

	// Add auth token (same as doRequest)
	if c.apiToken != "" {
		httpReq.Header.Set("Authorization", "API-Token "+c.apiToken)
	}

	// Send request
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	var result PutFolderFilesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// TriggerPullRequest represents the request body for triggering a pull job.
type TriggerPullRequest struct {
	DataFolderID string `json:"dataFolderId"`
}

// TriggerPullResponse represents the response from the trigger pull endpoint.
type TriggerPullResponse struct {
	JobID string `json:"jobId,omitempty"`
	Error string `json:"error,omitempty"`
}

// FolderProgress represents the progress of a single folder in a download job.
type FolderProgress struct {
	ID        string `json:"id,omitempty"`
	Name      string `json:"name,omitempty"`
	Connector string `json:"connector,omitempty"`
	Files     int    `json:"files,omitempty"`
	Status    string `json:"status,omitempty"`
}

// JobStatusProgress represents the progress information of a job.
type JobStatusProgress struct {
	TotalFiles int              `json:"totalFiles,omitempty"`
	Folders    []FolderProgress `json:"folders,omitempty"`
}

// JobStatusResponse represents the response from the job status endpoint.
type JobStatusResponse struct {
	JobID        string             `json:"jobId,omitempty"`
	State        string             `json:"state,omitempty"`
	Progress     *JobStatusProgress `json:"progress,omitempty"`
	Error        string             `json:"error,omitempty"`
	FailedReason string             `json:"failedReason,omitempty"`
}

// TriggerWorkbookPull starts a pull job for a data folder in a workbook.
func (c *Client) TriggerWorkbookPull(workbookID string, req *TriggerPullRequest) (*TriggerPullResponse, error) {
	var result TriggerPullResponse
	path := fmt.Sprintf("workbooks/%s/pull", workbookID)
	if err := c.doRequest(http.MethodPost, path, nil, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetJobStatus retrieves the status of a job by its ID.
func (c *Client) GetJobStatus(jobID string) (*JobStatusResponse, error) {
	var result JobStatusResponse
	path := fmt.Sprintf("jobs/%s/status", jobID)
	if err := c.doRequest(http.MethodGet, path, nil, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
