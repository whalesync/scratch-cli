package api

import "net/http"

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

// InitiateAuth starts the authorization flow.
// Returns a user code (for display) and polling code (for polling).
func (c *Client) InitiateAuth() (*AuthInitiateResponse, error) {
	var result AuthInitiateResponse
	if err := c.doRequest(http.MethodPost, "auth/initiate", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PollAuth checks the authorization status for a polling code.
// Returns the API token when the user has approved the authorization.
func (c *Client) PollAuth(pollingCode string) (*AuthPollResponse, error) {
	body := map[string]string{"pollingCode": pollingCode}
	var result AuthPollResponse
	if err := c.doRequest(http.MethodPost, "auth/poll", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
