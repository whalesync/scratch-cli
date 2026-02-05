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
	Short: "Sync local JSON files with Scratch.md workbooks",
	Long: `scratchmd is a command-line tool that synchronizes local folders with
Scratch.md workbooks and their data folders.

It enables local editing of CMS content using AI tools like Claude Code,
Cursor, or other editors. Content is stored as JSON files with field data
for easy manipulation.

══════════════════════════════════════════════════════════════════════════════
                              QUICK REFERENCE
══════════════════════════════════════════════════════════════════════════════

SETUP (run once):
  auth login                     Log in to Scratch.md
  workbook list                  List your workbooks
  folder list <workbook-id>      List data folders in a workbook
  folder download <folder-id>    Download a data folder

DAILY WORKFLOW:
  folder download <folder-id>    Download/sync from server (merges changes)
  [edit files locally]           Edit JSON files with your tools
  folder upload <folder-name>    Upload local changes to server

══════════════════════════════════════════════════════════════════════════════
                              COMMAND SAFETY
══════════════════════════════════════════════════════════════════════════════

SAFE (read-only, run anytime):
  workbook list [--json]         List workbooks
  folder list <workbook> [--json] List data folders

MODIFIES DATA:
  folder download <id>           Downloads and merges with local changes
  folder upload <name>           Uploads local changes to server
  folder reset <id> --yes        (DESTRUCTIVE) Discards ALL local changes

══════════════════════════════════════════════════════════════════════════════
                                 ALIASES
══════════════════════════════════════════════════════════════════════════════

  init     = folder link           Link a folder to CMS table (legacy)

══════════════════════════════════════════════════════════════════════════════

COMMANDS FOR LLM/AUTOMATION (non-interactive, no TTY required):
  scratchmd auth login
  scratchmd workbook list --json
  scratchmd folder list <workbook-id> --json
  scratchmd folder download <folder-id> --json
  scratchmd folder upload <folder-name> --json
  scratchmd folder reset <folder-id> --yes --json

TYPICAL LLM WORKFLOW:
  1. scratchmd auth login
  2. scratchmd workbook list --json
  3. scratchmd folder list wkb_abc123 --json
  4. scratchmd folder download dfd_xyz789 --json
  5. # Edit JSON files in the downloaded folder
  6. scratchmd folder upload my-folder --json

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
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Account.Name, "account.name", "", "Override account name")
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Account.Provider, "account.provider", "", "Override provider")
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Account.APIKey, "account.api-key", "", "Override API key")

	rootCmd.PersistentFlags().StringVar(&config.Overrides.Table.AccountID, "table.account", "", "Override table account (name or ID)")
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Table.FilenameField, "table.filename-field", "", "Override filename field")
	rootCmd.PersistentFlags().StringVar(&config.Overrides.Table.ContentField, "table.content-field", "", "Override content field")

	rootCmd.PersistentFlags().StringVar(&config.Overrides.Settings.ScratchServerURL, "scratch-url", "", "Override scratch server URL")

	// Add subcommands here as they are implemented, or in the init method of each subcommand
	// rootCmd.AddCommand(setupCmd)
	// rootCmd.AddCommand(accountCmd)
	// rootCmd.AddCommand(contentCmd)
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

// initCmd is an alias for 'folder link'
var initCmd = &cobra.Command{
	Use:   "init [folder-name]",
	Short: "[NON-INTERACTIVE] Alias for 'folder link' (-> then pull)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd folder link'.

Links a remote CMS table to a local folder. After linking, use 'pull' to download content.

Requires --account.name and --table-id flags.

Examples:
  scratchmd init --account.name=webflow --table-id=6789abc
  scratchmd init blog-posts --account.name=webflow --table-id=6789abc`,
	Args: cobra.MaximumNArgs(1),
	RunE: runFolderLink,
}

func init() {
	// Add alias commands to root
	rootCmd.AddCommand(initCmd)

	// Copy flags to alias commands
	initCmd.Flags().String("account.name", "", "Account name to link (required)")
	initCmd.Flags().String("table-id", "", "Table ID to link (required)")
	initCmd.MarkFlagRequired("account.name")
	initCmd.MarkFlagRequired("table-id")
}
