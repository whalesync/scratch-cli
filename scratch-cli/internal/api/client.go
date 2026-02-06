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
)

// DefaultScratchServerURL is the default base URL for the scratch API
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

// Client represents a client for the Scratch CLI API.
type Client struct {
	baseURL    string
	httpClient *http.Client
	apiToken   string // API token for authenticated requests
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

// doRequest performs an HTTP request and decodes the JSON response.
func (c *Client) doRequest(method, path string, body interface{}, result interface{}) error {
	return c.doRequestWithQuery(method, path, nil, body, result)
}

// doRequestWithQuery performs an HTTP request with query parameters and decodes the JSON response.
func (c *Client) doRequestWithQuery(method, path string, query url.Values, body interface{}, result interface{}) error {
	u, err := url.JoinPath(c.baseURL, "cli/v1", path)
	if err != nil {
		return fmt.Errorf("failed to build URL: %w", err)
	}

	if len(query) > 0 {
		u += "?" + query.Encode()
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
