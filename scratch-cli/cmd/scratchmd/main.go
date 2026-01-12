// Package main is the entry point for the scratchmd CLI tool.
// scratchmd synchronizes local Markdown files with CMS platforms like Webflow and WordPress.
package main

import (
	"os"
	"github.com/whalesync/scratch-cli/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
