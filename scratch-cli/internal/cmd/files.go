package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	gitconfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/config"
	"github.com/whalesync/scratch-cli/internal/merge"
	"golang.org/x/term"
	"gopkg.in/yaml.v3"
)

// ANSI color codes
const (
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
)

// fileChangeType represents the type of change made to a file
type fileChangeType int

const (
	fileAdded fileChangeType = iota
	fileModified
	fileDeleted
)

// printFileChange prints a color-coded file change line
func printFileChange(path string, changeType fileChangeType) {
	// Check if stdout is a terminal for color support
	useColor := term.IsTerminal(int(os.Stdout.Fd()))

	var label, color string
	switch changeType {
	case fileAdded:
		label = "added"
		color = colorGreen
	case fileModified:
		label = "modified"
		color = colorYellow
	case fileDeleted:
		label = "deleted"
		color = colorRed
	}

	if useColor {
		fmt.Printf("  %s  %s%s%s\n", path, color, label, colorReset)
	} else {
		fmt.Printf("  %s  %s\n", path, label)
	}
}

var filesCmd = &cobra.Command{
	Use:   "files",
	Short: "Manage workbook files",
	Long: `Manage files in a workbook.

Commands:
  files download    Fetch remote changes and merge with local edits
  files upload      Push local changes to the server`,
}

var filesDownloadCmd = &cobra.Command{
	Use:   "download [workbook-id]",
	Short: "Download remote changes and merge with local edits",
	Long: `Fetch the latest changes from the server's dirty branch and three-way
merge them with any local edits.

If run inside a workbook directory (contains .scratchmd marker), the workbook
is detected automatically. Otherwise, pass the workbook ID as an argument.

Examples:
  scratchmd files download
  scratchmd files download abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runFilesDownload,
}

var filesUploadCmd = &cobra.Command{
	Use:   "upload [workbook-id]",
	Short: "Push local changes to the server",
	Long: `Upload local changes to the server's dirty branch using three-way merge
with optimistic concurrency. If the remote branch changes during upload, the
operation is retried automatically.

If run inside a workbook directory (contains .scratchmd marker), the workbook
is detected automatically. Otherwise, pass the workbook ID as an argument.

Examples:
  scratchmd files upload
  scratchmd files upload abc123`,
	Args: cobra.MaximumNArgs(1),
	RunE: runFilesUpload,
}

func init() {
	rootCmd.AddCommand(filesCmd)
	filesCmd.AddCommand(filesDownloadCmd)
	filesCmd.AddCommand(filesUploadCmd)

	filesDownloadCmd.Flags().Bool("json", false, "Output as JSON")
	filesUploadCmd.Flags().Bool("json", false, "Output as JSON")
}

// DownloadResult is the JSON output for files download.
type DownloadResult struct {
	Status                string   `json:"status"`
	FilesUpdated          int      `json:"filesUpdated"`
	FilesCreated          int      `json:"filesCreated"`
	FilesDeleted          int      `json:"filesDeleted"`
	FilesMerged           int      `json:"filesMerged"`
	ConflictsAutoResolved int      `json:"conflictsAutoResolved"`
	Messages              []string `json:"messages"`
}

func runFilesDownload(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	// 1. Find the workbook directory.
	var workbookDir string
	var marker WorkbookMarker

	// Determine workbook ID from args or --workbook flag (set by linked parent command).
	var workbookID string
	if len(args) > 0 {
		workbookID = args[0]
	} else if flag := cmd.Flags().Lookup("workbook"); flag != nil && flag.Value.String() != "" {
		workbookID = flag.Value.String()
	}

	if workbookID != "" {
		// Check if we're already inside this workbook directory.
		dir, m, err := findWorkbookMarkerUpward(".")
		if err == nil && dir != "" && m.Workbook.ID == workbookID {
			workbookDir = dir
			marker = *m
		} else {
			// Scan current directory children.
			dir, err := findExistingWorkbookMarker(".", workbookID)
			if err != nil {
				return fmt.Errorf("failed to find workbook: %w", err)
			}
			if dir == "" {
				return fmt.Errorf("workbook %s not found in current directory. Run 'scratchmd workbooks init %s' first", workbookID, workbookID)
			}
			workbookDir = dir
			m, err := loadWorkbookMarker(workbookDir)
			if err != nil {
				return fmt.Errorf("failed to read marker: %w", err)
			}
			marker = *m
		}
	} else {
		// Auto-detect from current directory upward.
		dir, m, err := findWorkbookMarkerUpward(".")
		if err != nil {
			return fmt.Errorf("failed to detect workbook: %w", err)
		}
		if dir == "" {
			return fmt.Errorf("not inside a workbook directory. Run from a workbook directory or pass a workbook ID")
		}
		workbookDir = dir
		marker = *m
	}

	serverURL := marker.Workbook.ServerURL
	if serverURL == "" {
		serverURL = getServerURL()
	}

	if !config.IsLoggedIn(serverURL) {
		return fmt.Errorf("not logged in. Run 'scratchmd auth login' first")
	}

	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return fmt.Errorf("failed to load credentials: %w", err)
	}

	// 2. Open the local git repo.
	repo, err := git.PlainOpen(workbookDir)
	if err != nil {
		return fmt.Errorf("failed to open git repository at %s: %w", workbookDir, err)
	}

	// 3. Get HEAD hash (= base state from last sync).
	headRef, err := repo.Head()
	if err != nil {
		return fmt.Errorf("failed to get HEAD: %w", err)
	}
	baseHash := headRef.Hash()

	// 4. Fetch remote dirty branch.
	gitAuth := &APITokenAuth{Token: creds.APIToken}

	err = repo.Fetch(&git.FetchOptions{
		RemoteName: "origin",
		RefSpecs: []gitconfig.RefSpec{
			"refs/heads/dirty:refs/remotes/origin/dirty",
		},
		Auth:  gitAuth,
		Depth: 0,
		Force: true,
	})
	if err != nil && err != git.NoErrAlreadyUpToDate {
		return fmt.Errorf("failed to fetch remote changes: %w", err)
	}

	// 5. Resolve remote tip.
	remoteRef, err := repo.Reference(plumbing.NewRemoteReferenceName("origin", "dirty"), true)
	if err != nil {
		return fmt.Errorf("failed to resolve remote dirty branch: %w", err)
	}
	remoteHash := remoteRef.Hash()

	// Already up to date?
	if baseHash == remoteHash {
		if jsonOutput {
			result := DownloadResult{Status: "up_to_date"}
			encoder := json.NewEncoder(os.Stdout)
			encoder.SetIndent("", "  ")
			return encoder.Encode(result)
		}
		fmt.Println("Already up to date.")
		return nil
	}

	// 6. Build three file maps.
	baseMap, err := treeToFileMap(repo, baseHash)
	if err != nil {
		return fmt.Errorf("failed to read base tree: %w", err)
	}

	remoteMap, err := treeToFileMap(repo, remoteHash)
	if err != nil {
		return fmt.Errorf("failed to read remote tree: %w", err)
	}

	localMap, err := diskToFileMap(workbookDir)
	if err != nil {
		return fmt.Errorf("failed to read local files: %w", err)
	}

	// 7. Compute merge actions.
	actions := merge.ComputeMergeActions(baseMap, localMap, remoteMap)

	// 8. Resolve merges and collect files to stash.
	//    stash = files that need to be written back after hard reset.
	stash := make(map[string][]byte)
	var deletions []string
	var messages []string
	result := DownloadResult{Status: "downloaded"}

	// Track file changes for output
	type fileChange struct {
		path       string
		changeType fileChangeType
	}
	var changes []fileChange

	for _, act := range actions {
		switch act.Action {
		case merge.ActionKeepLocal:
			if act.Local != nil {
				stash[act.Path] = act.Local
			}

		case merge.ActionWriteRemote:
			if act.Base == nil {
				result.FilesCreated++
				changes = append(changes, fileChange{act.Path, fileAdded})
			} else {
				result.FilesUpdated++
				changes = append(changes, fileChange{act.Path, fileModified})
			}
			// Remote content will be on disk after hard reset — no stash needed.

		case merge.ActionDelete:
			result.FilesDeleted++
			deletions = append(deletions, act.Path)
			changes = append(changes, fileChange{act.Path, fileDeleted})
			if act.WarningMsg != "" {
				messages = append(messages, act.WarningMsg)
			}

		case merge.ActionMerge:
			merged := mergeFileContent(act.Path, act.Base, act.Local, act.Remote)
			stash[act.Path] = merged
			result.FilesMerged++
			changes = append(changes, fileChange{act.Path, fileModified})
			// If both sides changed, count as auto-resolved conflict.
			if act.Base != nil {
				result.ConflictsAutoResolved++
			}
		}
	}

	// Stash the .scratchmd marker as a safety net (not tracked in git).
	markerPath := filepath.Join(workbookDir, ".scratchmd")
	markerData, err := os.ReadFile(markerPath)
	if err == nil {
		stash[".scratchmd"] = markerData
	}

	// Also stash any data-folder .scratchmd markers.
	stashDataFolderMarkers(workbookDir, stash)

	// 9. Hard reset worktree to remote commit.
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree: %w", err)
	}

	err = wt.Reset(&git.ResetOptions{
		Commit: remoteHash,
		Mode:   git.HardReset,
	})
	if err != nil {
		return fmt.Errorf("failed to reset to remote state: %w", err)
	}

	// 10. Write back stashed files.
	for relPath, content := range stash {
		fullPath := filepath.Join(workbookDir, filepath.FromSlash(relPath))

		// Ensure parent directory exists.
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return fmt.Errorf("failed to create directory for %s: %w", relPath, err)
		}

		if err := os.WriteFile(fullPath, content, 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", relPath, err)
		}
	}

	// 11. Apply deletions.
	for _, relPath := range deletions {
		fullPath := filepath.Join(workbookDir, filepath.FromSlash(relPath))
		_ = os.Remove(fullPath) // Ignore error if already gone.
	}

	if messages == nil {
		messages = []string{}
	}
	result.Messages = messages

	// 12. Print file changes.
	if jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(result)
	}

	if len(changes) == 0 {
		fmt.Println("No changes.")
		return nil
	}

	for _, change := range changes {
		printFileChange(change.path, change.changeType)
	}

	// Print summary
	fmt.Println()
	var summary []string
	if result.FilesCreated > 0 {
		summary = append(summary, fmt.Sprintf("%d added", result.FilesCreated))
	}
	if result.FilesUpdated > 0 {
		summary = append(summary, fmt.Sprintf("%d modified", result.FilesUpdated))
	}
	if result.FilesMerged > 0 {
		summary = append(summary, fmt.Sprintf("%d merged", result.FilesMerged))
	}
	if result.FilesDeleted > 0 {
		summary = append(summary, fmt.Sprintf("%d deleted", result.FilesDeleted))
	}
	if len(summary) > 0 {
		fmt.Println(strings.Join(summary, ", "))
	}

	for _, msg := range messages {
		fmt.Printf("Warning: %s\n", msg)
	}

	return nil
}

// UploadResult is the JSON output for files upload.
type UploadResult struct {
	Status                string   `json:"status"` // "uploaded" | "no_changes" | "up_to_date"
	FilesUploaded         int      `json:"filesUploaded"`
	FilesMerged           int      `json:"filesMerged"`
	FilesDeleted          int      `json:"filesDeleted"`
	ConflictsAutoResolved int      `json:"conflictsAutoResolved"`
	Retries               int      `json:"retries"`
	Messages              []string `json:"messages"`
}

// fileMapEqual returns true if two FileMaps have identical keys and content.
func fileMapEqual(a, b merge.FileMap) bool {
	if len(a) != len(b) {
		return false
	}
	for k, av := range a {
		bv, ok := b[k]
		if !ok || !bytes.Equal(av, bv) {
			return false
		}
	}
	return true
}

func runFilesUpload(cmd *cobra.Command, args []string) error {
	jsonOutput, _ := cmd.Flags().GetBool("json")

	// 1. Find the workbook directory.
	var workbookDir string
	var marker WorkbookMarker

	if len(args) > 0 {
		dir, err := findExistingWorkbookMarker(".", args[0])
		if err != nil {
			return fmt.Errorf("failed to find workbook: %w", err)
		}
		if dir == "" {
			return fmt.Errorf("workbook %s not found in current directory. Run 'scratchmd workbooks init %s' first", args[0], args[0])
		}
		workbookDir = dir
		m, err := loadWorkbookMarker(workbookDir)
		if err != nil {
			return fmt.Errorf("failed to read marker: %w", err)
		}
		marker = *m
	} else {
		dir, m, err := findWorkbookMarkerUpward(".")
		if err != nil {
			return fmt.Errorf("failed to detect workbook: %w", err)
		}
		if dir == "" {
			return fmt.Errorf("not inside a workbook directory. Run from a workbook directory or pass a workbook ID")
		}
		workbookDir = dir
		marker = *m
	}

	serverURL := marker.Workbook.ServerURL
	if serverURL == "" {
		serverURL = getServerURL()
	}

	if !config.IsLoggedIn(serverURL) {
		return fmt.Errorf("not logged in. Run 'scratchmd auth login' first")
	}

	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return fmt.Errorf("failed to load credentials: %w", err)
	}

	// 2. Open the local git repo and save base hash.
	repo, err := git.PlainOpen(workbookDir)
	if err != nil {
		return fmt.Errorf("failed to open git repository at %s: %w", workbookDir, err)
	}

	headRef, err := repo.Head()
	if err != nil {
		return fmt.Errorf("failed to get HEAD: %w", err)
	}
	originalBaseHash := headRef.Hash()

	// 3. Read base and local maps (computed once, they don't change across retries).
	baseMap, err := treeToFileMap(repo, originalBaseHash)
	if err != nil {
		return fmt.Errorf("failed to read base tree: %w", err)
	}

	localMap, err := diskToFileMap(workbookDir)
	if err != nil {
		return fmt.Errorf("failed to read local files: %w", err)
	}

	// 4. Early exit if no local changes.
	if fileMapEqual(baseMap, localMap) {
		if jsonOutput {
			result := UploadResult{Status: "no_changes", Messages: []string{}}
			encoder := json.NewEncoder(os.Stdout)
			encoder.SetIndent("", "  ")
			return encoder.Encode(result)
		}
		fmt.Println("No local changes to upload.")
		return nil
	}

	gitAuth := &APITokenAuth{Token: creds.APIToken}
	authorEmail := creds.Email
	if authorEmail == "" {
		authorEmail = "cli@scratch.md"
	}

	const maxRetries = 5

	// 5. Retry loop with optimistic concurrency.
	for attempt := 0; attempt < maxRetries; attempt++ {
		// a. Fetch remote dirty branch.
		err = repo.Fetch(&git.FetchOptions{
			RemoteName: "origin",
			RefSpecs: []gitconfig.RefSpec{
				"refs/heads/dirty:refs/remotes/origin/dirty",
			},
			Auth:  gitAuth,
			Depth: 0,
			Force: true,
		})
		if err != nil && err != git.NoErrAlreadyUpToDate {
			return fmt.Errorf("failed to fetch remote changes: %w", err)
		}

		remoteRef, err := repo.Reference(plumbing.NewRemoteReferenceName("origin", "dirty"), true)
		if err != nil {
			return fmt.Errorf("failed to resolve remote dirty branch: %w", err)
		}
		remoteHash := remoteRef.Hash()

		// b. Build remote map.
		remoteMap, err := treeToFileMap(repo, remoteHash)
		if err != nil {
			return fmt.Errorf("failed to read remote tree: %w", err)
		}

		// c. Compute merge actions.
		actions := merge.ComputeMergeActions(baseMap, localMap, remoteMap)

		// d. Build merged map from actions.
		mergedMap := make(merge.FileMap)
		var messages []string
		result := UploadResult{Status: "uploaded", Retries: attempt, Messages: []string{}}

		// Track file changes for output
		type fileChange struct {
			path       string
			changeType fileChangeType
		}
		var changes []fileChange

		for _, act := range actions {
			switch act.Action {
			case merge.ActionKeepLocal:
				if act.Local != nil {
					mergedMap[act.Path] = act.Local
					// Count as uploaded if content differs from remote.
					remoteContent, inRemote := remoteMap[act.Path]
					if !inRemote {
						result.FilesUploaded++
						changes = append(changes, fileChange{act.Path, fileAdded})
					} else if !bytes.Equal(act.Local, remoteContent) {
						result.FilesUploaded++
						changes = append(changes, fileChange{act.Path, fileModified})
					}
				}

			case merge.ActionWriteRemote:
				if act.Remote != nil {
					mergedMap[act.Path] = act.Remote
				}

			case merge.ActionDelete:
				// File excluded from mergedMap = deleted.
				_, inRemote := remoteMap[act.Path]
				if inRemote {
					result.FilesDeleted++
					changes = append(changes, fileChange{act.Path, fileDeleted})
				}
				if act.WarningMsg != "" {
					messages = append(messages, act.WarningMsg)
				}

			case merge.ActionMerge:
				merged := mergeFileContent(act.Path, act.Base, act.Local, act.Remote)
				mergedMap[act.Path] = merged
				result.FilesMerged++
				changes = append(changes, fileChange{act.Path, fileModified})
				if act.Base != nil {
					result.ConflictsAutoResolved++
				}
			}
		}

		if messages != nil {
			result.Messages = messages
		}

		// e. If merged == remote, nothing to push.
		if fileMapEqual(mergedMap, remoteMap) {
			if jsonOutput {
				result.Status = "up_to_date"
				result.FilesUploaded = 0
				result.FilesMerged = 0
				result.FilesDeleted = 0
				result.ConflictsAutoResolved = 0
				encoder := json.NewEncoder(os.Stdout)
				encoder.SetIndent("", "  ")
				return encoder.Encode(result)
			}
			fmt.Println("Remote already has all local changes.")
			return nil
		}

		// f. Stash .scratchmd markers.
		markerStash := make(map[string][]byte)
		markerPath := filepath.Join(workbookDir, ".scratchmd")
		markerData, readErr := os.ReadFile(markerPath)
		if readErr == nil {
			markerStash[".scratchmd"] = markerData
		}
		stashDataFolderMarkers(workbookDir, markerStash)

		// g. Hard reset to remote hash.
		wt, err := repo.Worktree()
		if err != nil {
			restoreMarkers(workbookDir, markerStash)
			return fmt.Errorf("failed to get worktree: %w", err)
		}

		err = wt.Reset(&git.ResetOptions{
			Commit: remoteHash,
			Mode:   git.HardReset,
		})
		if err != nil {
			restoreMarkers(workbookDir, markerStash)
			return fmt.Errorf("failed to reset to remote state: %w", err)
		}

		// h. Write merged files that differ from remote to disk.
		for relPath, content := range mergedMap {
			remoteContent, inRemote := remoteMap[relPath]
			if inRemote && bytes.Equal(content, remoteContent) {
				continue // Already on disk after hard reset.
			}
			fullPath := filepath.Join(workbookDir, filepath.FromSlash(relPath))
			if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
				restoreMarkers(workbookDir, markerStash)
				return fmt.Errorf("failed to create directory for %s: %w", relPath, err)
			}
			if err := os.WriteFile(fullPath, content, 0644); err != nil {
				restoreMarkers(workbookDir, markerStash)
				return fmt.Errorf("failed to write %s: %w", relPath, err)
			}
		}

		// i. Delete files in remote but not in merged.
		for relPath := range remoteMap {
			if _, inMerged := mergedMap[relPath]; !inMerged {
				fullPath := filepath.Join(workbookDir, filepath.FromSlash(relPath))
				_ = os.Remove(fullPath)
			}
		}

		// j. Stage all changes in bulk (index is read/written once instead of per-file).
		if err := wt.AddWithOptions(&git.AddOptions{All: true}); err != nil {
			restoreMarkers(workbookDir, markerStash)
			return fmt.Errorf("failed to stage changes: %w", err)
		}

		// k. Commit.
		commitTime := time.Now()
		_, err = wt.Commit("Upload from Scratch CLI", &git.CommitOptions{
			Author: &object.Signature{
				Name:  "Scratch CLI",
				Email: authorEmail,
				When:  commitTime,
			},
		})
		if err != nil {
			restoreMarkers(workbookDir, markerStash)
			return fmt.Errorf("failed to commit: %w", err)
		}

		// l. Push to remote dirty branch.
		err = repo.Push(&git.PushOptions{
			RemoteName: "origin",
			RefSpecs: []gitconfig.RefSpec{
				"refs/heads/dirty:refs/heads/dirty",
			},
			Auth: gitAuth,
		})

		if err == nil {
			// m. Success — restore markers and output results.
			restoreMarkers(workbookDir, markerStash)

			if jsonOutput {
				encoder := json.NewEncoder(os.Stdout)
				encoder.SetIndent("", "  ")
				return encoder.Encode(result)
			}

			if len(changes) == 0 {
				fmt.Println("No changes.")
				return nil
			}

			for _, change := range changes {
				printFileChange(change.path, change.changeType)
			}

			// Print summary
			fmt.Println()
			var summary []string
			if result.FilesUploaded > 0 {
				summary = append(summary, fmt.Sprintf("%d uploaded", result.FilesUploaded))
			}
			if result.FilesMerged > 0 {
				summary = append(summary, fmt.Sprintf("%d merged", result.FilesMerged))
			}
			if result.FilesDeleted > 0 {
				summary = append(summary, fmt.Sprintf("%d deleted", result.FilesDeleted))
			}
			if len(summary) > 0 {
				fmt.Println(strings.Join(summary, ", "))
			}

			for _, msg := range result.Messages {
				fmt.Printf("Warning: %s\n", msg)
			}

			return nil
		}

		// n. Non-fast-forward → restore markers and retry.
		if err == git.ErrNonFastForwardUpdate {
			restoreMarkers(workbookDir, markerStash)
			continue
		}

		// o. Other error → restore markers and return.
		restoreMarkers(workbookDir, markerStash)
		return fmt.Errorf("failed to push: %w", err)
	}

	// 6. Max retries exhausted.
	return fmt.Errorf("upload failed after %d attempts due to concurrent changes on the server", maxRetries)
}

// restoreMarkers writes back stashed .scratchmd marker files.
func restoreMarkers(workbookDir string, stash map[string][]byte) {
	for relPath, content := range stash {
		fullPath := filepath.Join(workbookDir, filepath.FromSlash(relPath))
		_ = os.MkdirAll(filepath.Dir(fullPath), 0755)
		_ = os.WriteFile(fullPath, content, 0644)
	}
}

// findWorkbookMarkerUpward walks the current directory and parents looking for
// a .scratchmd marker file. Returns the directory path and parsed marker.
func findWorkbookMarkerUpward(startDir string) (string, *WorkbookMarker, error) {
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return "", nil, err
	}

	for {
		m, err := loadWorkbookMarker(dir)
		if err == nil && m != nil {
			return dir, m, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break // Reached filesystem root.
		}
		dir = parent
	}

	return "", nil, nil
}

// loadWorkbookMarker reads and parses the .scratchmd marker in a directory.
func loadWorkbookMarker(dir string) (*WorkbookMarker, error) {
	data, err := os.ReadFile(filepath.Join(dir, ".scratchmd"))
	if err != nil {
		return nil, err
	}

	var marker WorkbookMarker
	if err := yaml.Unmarshal(data, &marker); err != nil {
		return nil, err
	}

	if marker.Workbook.ID == "" {
		return nil, fmt.Errorf("marker missing workbook ID")
	}

	return &marker, nil
}

// treeToFileMap reads all files from a commit's tree into a FileMap.
func treeToFileMap(repo *git.Repository, commitHash plumbing.Hash) (merge.FileMap, error) {
	commitObj, err := repo.CommitObject(commitHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get commit %s: %w", commitHash, err)
	}

	tree, err := commitObj.Tree()
	if err != nil {
		return nil, fmt.Errorf("failed to get tree: %w", err)
	}

	fm := make(merge.FileMap)
	err = tree.Files().ForEach(func(f *object.File) error {
		content, err := f.Contents()
		if err != nil {
			return err
		}
		data := []byte(content)
		// Normalize CRLF to LF so git tree content matches disk content.
		if !merge.IsBinary(data) {
			data = merge.NormalizeCRLF(data)
		}
		fm[filepath.ToSlash(f.Name)] = data
		return nil
	})
	if err != nil {
		return nil, err
	}

	return fm, nil
}

// diskToFileMap reads all files from a directory into a FileMap, skipping
// .git and .scratchmd entries. Files are read in parallel for performance.
func diskToFileMap(rootDir string) (merge.FileMap, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, err
	}

	// Pass 1: collect file paths (fast, minimal I/O).
	type fileEntry struct {
		absPath string
		relPath string
	}
	var files []fileEntry

	err = filepath.Walk(absRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		name := info.Name()
		if info.IsDir() && name == ".git" {
			return filepath.SkipDir
		}
		if name == ".scratchmd" || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(absRoot, path)
		if err != nil {
			return err
		}
		files = append(files, fileEntry{absPath: path, relPath: filepath.ToSlash(rel)})
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Pass 2: read files in parallel using a worker pool.
	type readResult struct {
		relPath string
		data    []byte
		err     error
	}

	numWorkers := runtime.NumCPU()
	if numWorkers > len(files) {
		numWorkers = len(files)
	}
	if numWorkers < 1 {
		numWorkers = 1
	}

	jobs := make(chan fileEntry, len(files))
	results := make(chan readResult, len(files))

	for w := 0; w < numWorkers; w++ {
		go func() {
			for f := range jobs {
				data, err := os.ReadFile(f.absPath)
				if err != nil {
					results <- readResult{err: err}
					continue
				}
				// Normalize CRLF to LF for text files so disk content on Windows
				// matches LF-only content from git objects.
				if !merge.IsBinary(data) {
					data = merge.NormalizeCRLF(data)
				}
				results <- readResult{relPath: f.relPath, data: data}
			}
		}()
	}

	for _, f := range files {
		jobs <- f
	}
	close(jobs)

	fm := make(merge.FileMap, len(files))
	for range files {
		r := <-results
		if r.err != nil {
			return nil, r.err
		}
		fm[r.relPath] = r.data
	}

	return fm, nil
}

// mergeFileContent picks the right merge strategy based on file type.
func mergeFileContent(path string, base, local, remote []byte) []byte {
	// Binary files — local wins atomically.
	if (local != nil && merge.IsBinary(local)) || (remote != nil && merge.IsBinary(remote)) {
		if local != nil {
			return local
		}
		return remote
	}

	// Text files (including JSON) — line-level merge preserves formatting.
	return merge.MergeText(base, local, remote)
}

// stashDataFolderMarkers finds and stashes .scratchmd markers in subdirectories.
func stashDataFolderMarkers(rootDir string, stash map[string][]byte) {
	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == ".git" {
			continue
		}

		markerPath := filepath.Join(rootDir, entry.Name(), ".scratchmd")
		data, err := os.ReadFile(markerPath)
		if err != nil {
			continue
		}

		relPath := filepath.ToSlash(filepath.Join(entry.Name(), ".scratchmd"))
		stash[relPath] = data
	}
}
