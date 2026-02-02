// Package merge provides three-way merge functionality for JSON files.
package merge

// LocalFile represents a file from the CLI (user's local state).
type LocalFile struct {
	Name            string `json:"name"`
	Content         string `json:"content"`
	OriginalHash    string `json:"originalHash"`
	OriginalContent string `json:"originalContent,omitempty"`
	Deleted         bool   `json:"deleted,omitempty"`
}

// DirtyFile represents a file from the dirty branch (server state).
type DirtyFile struct {
	Name    string `json:"name"`
	Path    string `json:"path,omitempty"`
	Content string `json:"content"`
}

// SyncedFile represents a merged file ready to be written.
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

// ConflictInfo represents a resolved conflict.
type ConflictInfo struct {
	File        string `json:"file"`
	Field       string `json:"field,omitempty"`
	Resolution  string `json:"resolution"` // Always "local_wins"
	LocalValue  string `json:"localValue,omitempty"`
	ServerValue string `json:"serverValue,omitempty"`
}

// FileMergeResult is the result of merging a single file.
type FileMergeResult struct {
	Content     *string          // nil means file should be deleted
	Deleted     bool             // true if file should be deleted
	DeletedInfo *DeletedFileInfo // info about deletion (if deleted)
	Conflicts   []ConflictInfo   // conflicts encountered during merge
}

// FolderMergeResult is the result of merging an entire folder.
type FolderMergeResult struct {
	Files        []SyncedFile      `json:"files"`
	DeletedFiles []DeletedFileInfo `json:"deletedFiles"`
	Conflicts    []ConflictInfo    `json:"conflicts"`
}
