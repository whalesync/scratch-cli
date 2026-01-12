// Package main is the entry point for the scratchmd CLI tool.
// scratchmd synchronizes local Markdown files with CMS platforms like Webflow and WordPress.
package main

import (
	"github.com/whalesync/scratch-cli/internal/cmd"
	"os"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
