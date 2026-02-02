package merge

import (
	"crypto/sha256"
	"encoding/hex"
	"reflect"
	"strings"
)

// Hash computes SHA256 hash of content and returns it as a hex string.
func Hash(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:])
}

// isJSON checks if a filename indicates a JSON file.
func isJSON(fileName string) bool {
	return strings.HasSuffix(strings.ToLower(fileName), ".json")
}

// truncate truncates a string for logging purposes.
// Uses rune-based counting to avoid corrupting multi-byte UTF-8 characters.
func truncate(value string, maxLength int) string {
	if maxLength <= 0 {
		maxLength = 50
	}
	runes := []rune(value)
	if len(runes) <= maxLength {
		return value
	}
	return string(runes[:maxLength]) + "..."
}

// deepEqual checks if two values are deeply equal.
func deepEqual(a, b interface{}) bool {
	return reflect.DeepEqual(a, b)
}

// isPlainObject checks if a value is a plain object (map[string]interface{}).
func isPlainObject(v interface{}) bool {
	if v == nil {
		return false
	}
	_, ok := v.(map[string]interface{})
	return ok
}

// asObject attempts to cast a value to map[string]interface{}.
// Returns nil if the value is not a map.
func asObject(v interface{}) map[string]interface{} {
	if v == nil {
		return nil
	}
	m, ok := v.(map[string]interface{})
	if !ok {
		return nil
	}
	return m
}
