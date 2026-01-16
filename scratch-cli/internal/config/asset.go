// Package config handles configuration file management for scratchmd.
package config

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"os"

	"gopkg.in/yaml.v3"
)

// AssetManifestFileName is the name of the asset manifest file
const AssetManifestFileName = "assets.yaml"

// AssetEntry represents a single downloaded attachment in the asset manifest
type AssetEntry struct {
	ID               string `yaml:"id"`                 // Attachment ID from the provider
	FileID           string `yaml:"file_id"`            // Record/file ID the attachment came from
	Filename         string `yaml:"filename"`           // Downloaded filename (includes ID suffix)
	FileSize         int64  `yaml:"file_size"`          // Size of the downloaded file in bytes
	Checksum         string `yaml:"checksum"`           // MD5 checksum of the file
	MimeType         string `yaml:"mime_type"`          // MIME type of the file (if available)
	LastDownloadDate string `yaml:"last_download_date"` // ISO timestamp when the file was downloaded
}

// AssetManifest represents the asset tracking file
type AssetManifest struct {
	Assets []AssetEntry `yaml:"assets"`
}

// LoadAssetManifest loads the asset manifest from a YAML file, or returns an empty manifest if not found
func LoadAssetManifest(path string) (*AssetManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &AssetManifest{Assets: []AssetEntry{}}, nil
		}
		return nil, err
	}

	var manifest AssetManifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse asset manifest: %w", err)
	}

	if manifest.Assets == nil {
		manifest.Assets = []AssetEntry{}
	}

	return &manifest, nil
}

// SaveAssetManifest saves the asset manifest to a YAML file
func SaveAssetManifest(path string, manifest *AssetManifest) error {
	data, err := yaml.Marshal(manifest)
	if err != nil {
		return fmt.Errorf("failed to marshal asset manifest: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// CalculateFileChecksum calculates the MD5 checksum of a file
func CalculateFileChecksum(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// UpsertAsset adds or updates an asset entry in the manifest
func (m *AssetManifest) UpsertAsset(entry AssetEntry) {
	for i := range m.Assets {
		if m.Assets[i].ID == entry.ID {
			m.Assets[i] = entry
			return
		}
	}
	m.Assets = append(m.Assets, entry)
}
