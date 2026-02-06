package api

import "net/http"

// JobProgress represents the progress/state of a server-side job.
type JobProgress struct {
	BullJobID    string  `json:"bullJobId"`
	State        string  `json:"state"` // "waiting", "active", "completed", "failed", "unknown", "canceled"
	Type         string  `json:"type"`
	FailedReason *string `json:"failedReason"`
	FinishedOn   *string `json:"finishedOn"`
}

// GetJobProgress retrieves the progress/state of a job by ID.
func (c *Client) GetJobProgress(jobID string) (*JobProgress, error) {
	var result JobProgress
	if err := c.doRequest(http.MethodGet, "jobs/"+jobID+"/progress", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
