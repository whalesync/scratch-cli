// Package api provides a client for interacting with the Scratch CLI server API.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/whalesync/scratch-cli/internal/providers"
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

// ListTablesResponse represents the response from the list-tables endpoint.
type ListTablesResponse struct {
	Error  string                `json:"error,omitempty"`
	Tables []providers.TableInfo `json:"tables,omitempty"`
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
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
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

// ListTables retrieves the list of available tables/collections from the server.
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
