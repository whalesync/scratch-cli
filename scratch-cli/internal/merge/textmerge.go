package merge

import (
	"strings"

	difflib "github.com/sergi/go-diff/diffmatchpatch"
)

// MergeText performs a three-way line-level merge of base, local, and remote
// text content. On conflict (overlapping changes from both sides), the local
// version wins.
//
// If base is nil both sides created the file independently — local wins for
// conflicting regions, remote additions are appended where possible.
func MergeText(base, local, remote []byte) []byte {
	if base == nil {
		// No common ancestor — local wins entirely when both sides created.
		return local
	}

	baseLines := splitLines(string(base))
	localLines := splitLines(string(local))
	remoteLines := splitLines(string(remote))

	localEdits := computeEdits(baseLines, localLines)
	remoteEdits := computeEdits(baseLines, remoteLines)

	return []byte(applyEdits(baseLines, localEdits, remoteEdits))
}

// edit represents a replacement of base lines [start, end) with new lines.
type edit struct {
	start int      // inclusive index in base
	end   int      // exclusive index in base
	lines []string // replacement lines
}

// computeEdits returns the set of edit regions that transform base into target.
func computeEdits(base, target []string) []edit {
	dmp := difflib.New()

	baseText := strings.Join(base, "\n")
	targetText := strings.Join(target, "\n")

	// Use line-level diffing for efficiency.
	chars1, chars2, lineArray := dmp.DiffLinesToChars(baseText, targetText)
	diffs := dmp.DiffMain(chars1, chars2, false)
	diffs = dmp.DiffCharsToLines(diffs, lineArray)
	diffs = dmp.DiffCleanupSemantic(diffs)

	var edits []edit
	baseLine := 0

	for _, d := range diffs {
		lines := splitDiffLines(d.Text)
		n := len(lines)

		switch d.Type {
		case difflib.DiffEqual:
			baseLine += n
		case difflib.DiffDelete:
			// Mark the region for deletion; a following Insert will fill it.
			edits = append(edits, edit{start: baseLine, end: baseLine + n, lines: nil})
			baseLine += n
		case difflib.DiffInsert:
			// If the last edit was a delete ending at this position, merge into replace.
			if len(edits) > 0 && edits[len(edits)-1].end == baseLine && edits[len(edits)-1].lines == nil {
				edits[len(edits)-1].lines = lines
			} else {
				edits = append(edits, edit{start: baseLine, end: baseLine, lines: lines})
			}
		}
	}

	return edits
}

// applyEdits walks through base lines and applies non-overlapping edits from
// both local and remote. When edits overlap, local wins.
func applyEdits(base []string, localEdits, remoteEdits []edit) string {
	var result []string
	li, ri := 0, 0
	baseLine := 0

	for baseLine <= len(base) {
		var le, re *edit

		if li < len(localEdits) {
			le = &localEdits[li]
		}
		if ri < len(remoteEdits) {
			re = &remoteEdits[ri]
		}

		// No more edits — append remaining base lines and break.
		if le == nil && re == nil {
			if baseLine < len(base) {
				result = append(result, base[baseLine:]...)
			}
			break
		}

		// Determine the next edit to consider.
		nextStart := len(base)
		if le != nil && le.start < nextStart {
			nextStart = le.start
		}
		if re != nil && re.start < nextStart {
			nextStart = re.start
		}

		// Copy unchanged base lines up to the next edit.
		if baseLine < nextStart {
			result = append(result, base[baseLine:nextStart]...)
			baseLine = nextStart
		}

		// Check for overlapping edits.
		if le != nil && re != nil && le.start < re.end && re.start < le.end {
			// Overlap — local wins.
			if le.lines != nil {
				result = append(result, le.lines...)
			}
			// Advance past both edits.
			advanceTo := le.end
			if re.end > advanceTo {
				advanceTo = re.end
			}
			baseLine = advanceTo
			li++
			// Skip all remote edits consumed by this overlap.
			for ri < len(remoteEdits) && remoteEdits[ri].start < advanceTo {
				ri++
			}
			continue
		}

		// Non-overlapping: apply whichever edit comes first.
		if le != nil && (re == nil || le.start <= re.start) {
			if le.lines != nil {
				result = append(result, le.lines...)
			}
			baseLine = le.end
			li++
		} else if re != nil {
			if re.lines != nil {
				result = append(result, re.lines...)
			}
			baseLine = re.end
			ri++
		}
	}

	return strings.Join(result, "\n")
}

// splitLines splits text into lines, stripping any \r for cross-platform safety.
func splitLines(s string) []string {
	if s == "" {
		return []string{}
	}
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.Split(s, "\n")
}

// splitDiffLines splits diff text into lines, matching the line-array encoding
// from DiffLinesToChars where each line includes its newline.
func splitDiffLines(s string) []string {
	if s == "" {
		return nil
	}
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	// The diff text uses real newlines as separators.
	lines := strings.Split(s, "\n")
	// A trailing empty element from a final newline should be dropped.
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}
