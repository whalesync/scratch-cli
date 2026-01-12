package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// WordPressProvider implements the Provider interface for WordPress
type WordPressProvider struct{}

func (w *WordPressProvider) Name() string {
	return "wordpress"
}

func (w *WordPressProvider) DisplayName() string {
	return "WordPress"
}

// TestConnection tests the WordPress API key
// Note: WordPress.com uses OAuth, self-hosted uses application passwords
// For now, we test against WordPress.com REST API
func (w *WordPressProvider) TestConnection(apiKey string) error {
	// WordPress.com REST API: Get current user
	// https://developer.wordpress.com/docs/api/1.1/get/me/
	req, err := http.NewRequest("GET", "https://public-api.wordpress.com/rest/v1.1/me", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return fmt.Errorf("invalid API key or token (unauthorized)")
	}

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response to confirm it's valid
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("invalid API response: %w", err)
	}

	return nil
}
