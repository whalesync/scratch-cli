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

// DefaultBaseURL is the default server URL for the Scratch API.
const DefaultBaseURL = "http://localhost:3010"

// DefaultTimeout is the default timeout for API requests.
const DefaultTimeout = 30 * time.Second

// DefaultUserAgent is the default User-Agent header for API requests.
const DefaultUserAgent = "Scratch-CLI/1.0"

// Client represents a client for the Scratch CLI API.
type Client struct {
	baseURL    string
	httpClient *http.Client
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

// ClientOption is a function that configures a Client.
type ClientOption func(*Client)

// WithBaseURL sets the base URL for the client.
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

// NewClient creates a new API client with the given options.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		baseURL: DefaultBaseURL,
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
	req.Header.Set("User-Agent", DefaultUserAgent)

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
