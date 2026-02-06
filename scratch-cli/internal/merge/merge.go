// Package merge provides three-way merge logic for syncing files between
// local disk and a remote git branch.
package merge

import (
	"bytes"
	"path/filepath"
	"strings"
)

// ActionType describes what to do with a file after three-way comparison.
type ActionType int

const (
	// ActionKeepLocal means no disk write needed — local version is correct.
	ActionKeepLocal ActionType = iota
	// ActionWriteRemote means overwrite disk with the remote version.
	ActionWriteRemote
	// ActionDelete means remove the file from disk.
	ActionDelete
	// ActionMerge means base, local, and remote all differ — needs content merge.
	ActionMerge
)

// MergeAction describes the resolved action for a single file path.
type MergeAction struct {
	Path   string
	Action ActionType

	// Content from each state (nil means file did not exist in that state).
	Base   []byte
	Local  []byte
	Remote []byte

	// WarningMsg is set when the action discards local changes.
	WarningMsg string
}

// FileMap maps slash-normalised relative paths to file contents.
type FileMap map[string][]byte

// ComputeMergeActions compares base, local, and remote file maps and returns
// the list of actions needed to reconcile the working tree.
//
// Rules (base=B, local=L, remote=R):
//
//	-/-/- impossible (file wouldn't be in any map)
//	-/L/- keep local  (created locally)
//	-/-/R write remote (created on server)
//	-/L/R merge with nil base (both sides created)
//	B/-/- no action   (both deleted)
//	B/L/- delete      (server deleted; warn if L!=B)
//	B/-/R delete      (local deletion wins)
//	B/L=B/R write remote (only server changed)
//	B/L/R=B keep local   (only local changed)
//	B/L=R/R keep local   (same change on both sides)
//	B/L/R   merge        (both sides changed differently)
func ComputeMergeActions(base, local, remote FileMap) []MergeAction {
	// Collect the union of all paths.
	seen := make(map[string]struct{})
	for p := range base {
		seen[normalize(p)] = struct{}{}
	}
	for p := range local {
		seen[normalize(p)] = struct{}{}
	}
	for p := range remote {
		seen[normalize(p)] = struct{}{}
	}

	actions := make([]MergeAction, 0, len(seen))

	for p := range seen {
		b, bOk := base[p]
		l, lOk := local[p]
		r, rOk := remote[p]

		act := MergeAction{
			Path:   p,
			Base:   nilIfMissing(b, bOk),
			Local:  nilIfMissing(l, lOk),
			Remote: nilIfMissing(r, rOk),
		}

		switch {
		// Only local has it — keep local.
		case !bOk && lOk && !rOk:
			act.Action = ActionKeepLocal

		// Only remote has it — write remote.
		case !bOk && !lOk && rOk:
			act.Action = ActionWriteRemote

		// Both sides created (no base) — merge.
		case !bOk && lOk && rOk:
			if bytesEqual(l, r) {
				act.Action = ActionKeepLocal
			} else {
				act.Action = ActionMerge
			}

		// Both deleted — nothing to do (skip).
		case bOk && !lOk && !rOk:
			continue

		// Server deleted, local still exists.
		case bOk && lOk && !rOk:
			act.Action = ActionDelete
			if !bytesEqual(l, b) {
				act.WarningMsg = "'" + p + "' deleted on server but had local changes"
			}

		// Local deleted, server still has it — respect local deletion.
		case bOk && !lOk && rOk:
			act.Action = ActionDelete

		// All three exist.
		case bOk && lOk && rOk:
			localChanged := !bytesEqual(l, b)
			remoteChanged := !bytesEqual(r, b)
			sameChange := bytesEqual(l, r)

			switch {
			case sameChange:
				// Identical content — keep local (no disk write needed).
				act.Action = ActionKeepLocal
			case !localChanged:
				// Only remote changed.
				act.Action = ActionWriteRemote
			case !remoteChanged:
				// Only local changed.
				act.Action = ActionKeepLocal
			default:
				// Both changed differently — merge.
				act.Action = ActionMerge
			}
		}

		actions = append(actions, act)
	}

	return actions
}

// normalize converts a path to use forward slashes.
func normalize(p string) string {
	return filepath.ToSlash(strings.TrimPrefix(p, "./"))
}

func nilIfMissing(data []byte, ok bool) []byte {
	if !ok {
		return nil
	}
	return data
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// NormalizeCRLF replaces all \r\n sequences with \n so that content read from
// disk on Windows can be compared byte-for-byte with LF-only content from git.
func NormalizeCRLF(data []byte) []byte {
	return bytes.ReplaceAll(data, []byte("\r\n"), []byte("\n"))
}

// IsBinary returns true if data looks like a binary file (contains null bytes
// in the first 8 KB).
func IsBinary(data []byte) bool {
	limit := 8192
	if len(data) < limit {
		limit = len(data)
	}
	for i := 0; i < limit; i++ {
		if data[i] == 0 {
			return true
		}
	}
	return false
}
