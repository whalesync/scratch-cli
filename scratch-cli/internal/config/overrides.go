// Package config handles configuration file management for scratchmd.
package config

// Overrides holds global configuration overrides set via CLI flags
var Overrides = struct {
	Settings struct {
		ScratchServerURL string
	}
}{}
