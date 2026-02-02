package merge

import (
	"bytes"
	"encoding/json"

	"github.com/iancoleman/orderedmap"
)

// MaxMergeDepth is the maximum depth for field-level JSON merging.
// Beyond this depth, nested objects are treated as atomic values (local wins entirely).
const MaxMergeDepth = 5

// marshalJSONNoEscape marshals to JSON with indentation but without HTML escaping.
// This preserves characters like & instead of encoding them as \u0026.
// It handles orderedmap.OrderedMap specially to avoid the library's internal escaping.
func marshalJSONNoEscape(v interface{}) ([]byte, error) {
	// Convert orderedmap to a structure we can marshal without HTML escaping
	converted := convertForMarshal(v)

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(converted); err != nil {
		return nil, err
	}
	// Encode adds a trailing newline, remove it to match MarshalIndent behavior
	result := buf.Bytes()
	if len(result) > 0 && result[len(result)-1] == '\n' {
		result = result[:len(result)-1]
	}
	return result, nil
}

// convertForMarshal recursively converts orderedmap.OrderedMap to a structure
// that can be marshaled with SetEscapeHTML(false) working properly.
// The orderedmap library's MarshalJSON uses standard json.Marshal internally,
// which escapes HTML characters. We convert to json.RawMessage to bypass this.
func convertForMarshal(v interface{}) interface{} {
	switch val := v.(type) {
	case *orderedmap.OrderedMap:
		// Build JSON manually to preserve key order and avoid HTML escaping
		var buf bytes.Buffer
		buf.WriteByte('{')
		keys := val.Keys()
		for i, key := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			// Marshal the key (always a string)
			keyBytes, _ := marshalValueNoEscape(key)
			buf.Write(keyBytes)
			buf.WriteByte(':')
			// Recursively convert and marshal the value
			value, _ := val.Get(key)
			valueBytes, _ := marshalValueNoEscape(convertForMarshal(value))
			buf.Write(valueBytes)
		}
		buf.WriteByte('}')
		return json.RawMessage(buf.Bytes())

	case []interface{}:
		// Convert slice elements recursively
		result := make([]interface{}, len(val))
		for i, item := range val {
			result[i] = convertForMarshal(item)
		}
		return result

	default:
		return v
	}
}

// marshalValueNoEscape marshals a single value without HTML escaping.
func marshalValueNoEscape(v interface{}) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(v); err != nil {
		return nil, err
	}
	// Remove trailing newline
	result := buf.Bytes()
	if len(result) > 0 && result[len(result)-1] == '\n' {
		result = result[:len(result)-1]
	}
	return result, nil
}

// mergeJSONContent performs JSON-aware three-way merge at the field level.
//
// When originalContent is available, does true three-way merge:
// - Field changed only by local -> keep local value
// - Field changed only by server -> keep server value
// - Field changed by both to same value -> keep that value (no conflict)
// - Field changed by both to different values -> local wins (log conflict)
//
// When originalContent is not available, falls back to two-way merge
// where local wins on any differing field.
//
// Key order is preserved from the dirty (server) content to maintain consistency.
func mergeJSONContent(
	fileName string,
	originalContent string,
	localContent string,
	dirtyContent string,
) (*FileMergeResult, error) {
	var localObj orderedmap.OrderedMap
	var dirtyObj orderedmap.OrderedMap

	if err := json.Unmarshal([]byte(localContent), &localObj); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(dirtyContent), &dirtyObj); err != nil {
		return nil, err
	}

	conflicts := []ConflictInfo{}

	// If we have original content, do true three-way merge
	if originalContent != "" {
		var baseObj orderedmap.OrderedMap
		if err := json.Unmarshal([]byte(originalContent), &baseObj); err == nil {
			result := mergeObjectsThreeWay(fileName, "", &baseObj, &localObj, &dirtyObj, &conflicts, 0)
			content, err := marshalJSONNoEscape(result)
			if err != nil {
				return nil, err
			}
			contentStr := string(content)
			return &FileMergeResult{
				Content:   &contentStr,
				Deleted:   false,
				Conflicts: conflicts,
			}, nil
		}
		// If original content is not valid JSON, fall through to two-way merge
	}

	// Fallback: two-way merge where local wins on any differing field
	result := mergeObjects(fileName, "", &localObj, &dirtyObj, &conflicts, 0)
	content, err := marshalJSONNoEscape(result)
	if err != nil {
		return nil, err
	}
	contentStr := string(content)
	return &FileMergeResult{
		Content:   &contentStr,
		Deleted:   false,
		Conflicts: conflicts,
	}, nil
}

// mergeObjectsThreeWay performs true three-way merge for JSON objects.
// Compares each field against the base to determine who changed what.
// Key order is preserved from dirty (server) with local additions appended.
// The depth parameter tracks nesting level; beyond MaxMergeDepth, objects are treated as atomic.
func mergeObjectsThreeWay(
	fileName string,
	path string,
	base *orderedmap.OrderedMap,
	local *orderedmap.OrderedMap,
	dirty *orderedmap.OrderedMap,
	conflicts *[]ConflictInfo,
	depth int,
) *orderedmap.OrderedMap {
	result := orderedmap.New()

	// First, iterate through dirty keys to preserve server order
	for _, key := range dirty.Keys() {
		fieldPath := key
		if path != "" {
			fieldPath = path + "." + key
		}

		baseVal, baseHasKey := base.Get(key)
		localVal, localHasKey := local.Get(key)
		dirtyVal, _ := dirty.Get(key)

		localChanged := !deepEqualOrdered(baseVal, localVal) || (baseHasKey != localHasKey)
		dirtyChanged := !deepEqualOrdered(baseVal, dirtyVal)

		// Neither changed - keep base value (use dirty since it has the order we want)
		if !localChanged && !dirtyChanged {
			result.Set(key, dirtyVal)
			continue
		}

		// Only local changed - take local
		if localChanged && !dirtyChanged {
			if localHasKey {
				result.Set(key, localVal)
			}
			// If local deleted the key, don't include it
			continue
		}

		// Only dirty changed - take dirty
		if !localChanged && dirtyChanged {
			result.Set(key, dirtyVal)
			continue
		}

		// Both changed - check if they changed to the same value
		if deepEqualOrdered(localVal, dirtyVal) {
			result.Set(key, dirtyVal)
			continue
		}

		// Both changed to different values - need to resolve
		// If both are objects and we haven't exceeded max depth, recurse for finer-grained merge
		if isOrderedMap(baseVal) && isOrderedMap(localVal) && isOrderedMap(dirtyVal) && depth < MaxMergeDepth {
			result.Set(key, mergeObjectsThreeWay(
				fileName,
				fieldPath,
				asOrderedMap(baseVal),
				asOrderedMap(localVal),
				asOrderedMap(dirtyVal),
				conflicts,
				depth+1,
			))
			continue
		}

		// Different values, can't recurse -> LOCAL WINS
		if localHasKey {
			result.Set(key, localVal)
		}

		localValJSON, _ := json.Marshal(localVal)
		dirtyValJSON, _ := json.Marshal(dirtyVal)

		*conflicts = append(*conflicts, ConflictInfo{
			File:        fileName,
			Field:       fieldPath,
			Resolution:  "local_wins",
			LocalValue:  truncate(string(localValJSON), 50),
			ServerValue: truncate(string(dirtyValJSON), 50),
		})
	}

	// Add any keys that exist only in local (appended at end)
	for _, key := range local.Keys() {
		if _, exists := dirty.Get(key); exists {
			continue // Already handled
		}

		fieldPath := key
		if path != "" {
			fieldPath = path + "." + key
		}

		localVal, _ := local.Get(key)
		baseVal, baseHasKey := base.Get(key)

		// If local added a new key (not in base), include it
		if !baseHasKey {
			result.Set(key, localVal)
			continue
		}

		// If base had it but dirty deleted it, check if local changed it
		localChanged := !deepEqualOrdered(baseVal, localVal)
		if localChanged {
			// Local modified a field that server deleted -> local wins
			result.Set(key, localVal)

			localValJSON, _ := json.Marshal(localVal)

			*conflicts = append(*conflicts, ConflictInfo{
				File:        fileName,
				Field:       fieldPath,
				Resolution:  "local_wins",
				LocalValue:  truncate(string(localValJSON), 50),
				ServerValue: "(deleted)",
			})
		}
		// If local didn't change it, respect server's deletion
	}

	return result
}

// mergeObjects recursively merges two JSON objects.
// When both have different values for the same field, local wins.
// Key order is preserved from dirty (server) with local additions appended.
// The depth parameter tracks nesting level; beyond MaxMergeDepth, objects are treated as atomic.
func mergeObjects(
	fileName string,
	path string,
	local *orderedmap.OrderedMap,
	dirty *orderedmap.OrderedMap,
	conflicts *[]ConflictInfo,
	depth int,
) *orderedmap.OrderedMap {
	result := orderedmap.New()

	// First, iterate through dirty keys to preserve server order
	for _, key := range dirty.Keys() {
		fieldPath := key
		if path != "" {
			fieldPath = path + "." + key
		}

		localVal, localHasKey := local.Get(key)
		dirtyVal, _ := dirty.Get(key)

		// Field only in dirty
		if !localHasKey {
			result.Set(key, dirtyVal)
			continue
		}

		// Both have the field - check if equal
		if deepEqualOrdered(localVal, dirtyVal) {
			result.Set(key, dirtyVal)
			continue
		}

		// Both have different values
		// If both are objects and we haven't exceeded max depth, recurse
		if isOrderedMap(localVal) && isOrderedMap(dirtyVal) && depth < MaxMergeDepth {
			result.Set(key, mergeObjects(
				fileName,
				fieldPath,
				asOrderedMap(localVal),
				asOrderedMap(dirtyVal),
				conflicts,
				depth+1,
			))
			continue
		}

		// Different values, not both objects -> LOCAL WINS
		result.Set(key, localVal)

		localValJSON, _ := json.Marshal(localVal)
		dirtyValJSON, _ := json.Marshal(dirtyVal)

		*conflicts = append(*conflicts, ConflictInfo{
			File:        fileName,
			Field:       fieldPath,
			Resolution:  "local_wins",
			LocalValue:  truncate(string(localValJSON), 50),
			ServerValue: truncate(string(dirtyValJSON), 50),
		})
	}

	// Add any keys that exist only in local (appended at end)
	for _, key := range local.Keys() {
		if _, exists := dirty.Get(key); exists {
			continue // Already handled
		}
		localVal, _ := local.Get(key)
		result.Set(key, localVal)
	}

	return result
}

// isOrderedMap checks if a value is an orderedmap.OrderedMap (pointer or value)
func isOrderedMap(v interface{}) bool {
	switch v.(type) {
	case *orderedmap.OrderedMap:
		return true
	case orderedmap.OrderedMap:
		return true
	}
	return false
}

// asOrderedMap casts a value to *orderedmap.OrderedMap
func asOrderedMap(v interface{}) *orderedmap.OrderedMap {
	switch om := v.(type) {
	case *orderedmap.OrderedMap:
		return om
	case orderedmap.OrderedMap:
		return &om
	}
	return orderedmap.New()
}

// deepEqualOrdered compares two values for deep equality, handling orderedmap
func deepEqualOrdered(a, b interface{}) bool {
	// Handle nil cases
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Handle orderedmap comparison (both pointer and value types)
	aIsMap := isOrderedMap(a)
	bIsMap := isOrderedMap(b)
	if aIsMap && bIsMap {
		aMap := asOrderedMap(a)
		bMap := asOrderedMap(b)
		if len(aMap.Keys()) != len(bMap.Keys()) {
			return false
		}
		for _, key := range aMap.Keys() {
			aVal, _ := aMap.Get(key)
			bVal, bHas := bMap.Get(key)
			if !bHas || !deepEqualOrdered(aVal, bVal) {
				return false
			}
		}
		return true
	}

	// Handle slice comparison
	aSlice, aIsSlice := a.([]interface{})
	bSlice, bIsSlice := b.([]interface{})
	if aIsSlice && bIsSlice {
		if len(aSlice) != len(bSlice) {
			return false
		}
		for i := range aSlice {
			if !deepEqualOrdered(aSlice[i], bSlice[i]) {
				return false
			}
		}
		return true
	}

	// Use JSON marshaling for other types to handle numeric precision
	aJSON, errA := json.Marshal(a)
	bJSON, errB := json.Marshal(b)
	if errA != nil || errB != nil {
		return false
	}
	return string(aJSON) == string(bJSON)
}
