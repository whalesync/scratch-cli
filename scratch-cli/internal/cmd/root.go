// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// Version information (set at build time via ldflags)
var (
	version   = "dev"
	commit    = "none"
	buildDate = "unknown"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "scratchmd",
	Short: "Command-line tool for ScratchMD",
	Long: `scratchmd is the command-line tool for ScratchMD.

══════════════════════════════════════════════════════════════════════════════
                              AUTHENTICATION
══════════════════════════════════════════════════════════════════════════════

  auth login                     Authenticate with ScratchMD
  auth logout                    End current session
  auth status                    Show current auth state

══════════════════════════════════════════════════════════════════════════════
                                WORKBOOKS
══════════════════════════════════════════════════════════════════════════════

  workbooks list                 List all workbooks
  workbooks create               Create a new workbook
  workbooks show <id>            Show workbook details
  workbooks delete <id>          Delete a workbook

══════════════════════════════════════════════════════════════════════════════

For more information, visit: https://github.com/whalesync/scratch-cli`,
	Version: version,
	// Silence usage on errors - we'll handle our own error messages
	SilenceUsage: true,
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Set version template to include build info
	rootCmd.SetVersionTemplate(fmt.Sprintf(`scratchmd version {{.Version}}
commit: %s
built: %s
`, commit, buildDate))

	// Global flags that apply to all commands
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Enable verbose output")
	rootCmd.PersistentFlags().String("config", "", "Config file path (default: .scratchmd.config.yaml)")

	// Config overrides
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Settings.ScratchServerURL, "scratch-url", "", "Override scratch server URL")
}

// SetVersionInfo sets the version information for the CLI.
// Called from main with values injected at build time.
func SetVersionInfo(v, c, d string) {
	version = v
	commit = c
	buildDate = d
	// Also set the API package version for request headers
	api.Version = v
}

// GetVersion returns the current CLI version.
func GetVersion() string {
	return version
}

// Helper function to exit with error message
func exitWithError(msg string) {
	fmt.Fprintln(os.Stderr, "Error:", msg)
	os.Exit(1)
}
