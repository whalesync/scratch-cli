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
	Short: "Sync local Markdown files with your CMS",
	Long: `scratchmd is a command-line tool that synchronizes a local folder with
CMS platforms like Webflow and WordPress.

It enables local editing of CMS content using AI tools like Claude Code,
Cursor, or other editors. Content is stored as JSON files with field data
for easy manipulation.

══════════════════════════════════════════════════════════════════════════════
                              QUICK REFERENCE
══════════════════════════════════════════════════════════════════════════════

SETUP WORKFLOW (run once):
  account add  →  sources  →  init  →  pull
       │              │          │        │
       └─ Add CMS     └─ List    └─ Link  └─ Download
          account        tables     folder   content

DAILY WORKFLOW:
  pull  →  [edit files]  →  status  →  push
    │                          │         │
    └─ Get latest from CMS     └─ Check  └─ Upload to CMS
                                  changes

══════════════════════════════════════════════════════════════════════════════
                              COMMAND SAFETY
══════════════════════════════════════════════════════════════════════════════

SAFE (read-only, run anytime):
  status [--json]              Check which files changed locally
  ls [--json]                  List configured accounts
  sources <account> [--json]   List available tables from CMS
  check [--json]               Alias for status

CAREFUL (modifies data):
  push --sync-deletes          Deletes remote records missing locally
  pull --clobber               Discards ALL local changes

USE --explain:
  push --explain               Show what upload would do (no changes)
  pull --explain               Show what download would do (no changes)

══════════════════════════════════════════════════════════════════════════════
                                 ALIASES
══════════════════════════════════════════════════════════════════════════════

  ls       = account list          List configured accounts
  sources  = account fetch-sources Fetch tables from CMS
  init     = folder link           Link a folder to CMS table
  check    = status                Check for local changes
  pull     = content download      Download from CMS
  push     = content upload        Upload to CMS
  sync     = content upload        Alias for push

══════════════════════════════════════════════════════════════════════════════

COMMANDS FOR LLM/AUTOMATION (non-interactive, no TTY required):
  scratchmd account add <name> --provider=webflow --api-key=KEY
  scratchmd ls [--json]
  scratchmd sources <account> [--json]
  scratchmd init <folder> --account.name=<account> --table-id=<id>
  scratchmd pull [folder]
  scratchmd push [folder] [--sync-deletes] [--no-review]
  scratchmd status [--json]

COMMANDS FOR HUMANS (interactive, requires TTY):
  scratchmd setup                  # Full interactive wizard
  scratchmd account setup          # Interactive account setup

TYPICAL LLM WORKFLOW:
  1. scratchmd account add myaccount --provider=webflow --api-key=<key>
  2. scratchmd sources myaccount --json
  3. scratchmd init blog-posts --account.name=myaccount --table-id=<id>
  4. scratchmd pull blog-posts
  5. # Edit JSON files in blog-posts/
  6. scratchmd status --json
  7. scratchmd push blog-posts --no-review --json

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

// lsCmd is an alias for 'account list'
var lsCmd = &cobra.Command{
	Use:   "ls",
	Short: "[NON-INTERACTIVE] Alias for 'account list' (-> then fetch-sources)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd account list'.

Lists all configured CMS accounts. After listing accounts, typically
use 'fetch-sources' to see available tables.

Examples:
  scratchmd ls
  scratchmd ls --json`,
	RunE: runAccountList,
}

// syncCmd is an alias for 'content upload'
var syncCmd = &cobra.Command{
	Use:   "sync [folder[/file.json]]",
	Short: "[NON-INTERACTIVE] Alias for 'content upload' (check status first)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd content upload'.

Uploads local changes to the CMS. Check 'status' first to see what will be uploaded.

Examples:
  scratchmd sync                       # upload all changes
  scratchmd sync blog-posts            # upload one collection
  scratchmd sync --no-review --json    # skip confirmation, JSON output`,
	RunE: runContentUpload,
}

// checkCmd is an alias for 'status'
var checkCmd = &cobra.Command{
	Use:   "check [folder[/file.json]]",
	Short: "[NON-INTERACTIVE] Alias for 'status' (-> push if changes)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd status'.

Shows which files have local changes. If changes exist, use 'push' to upload them.

Examples:
  scratchmd check
  scratchmd check --json
  scratchmd check blog-posts`,
	RunE: runStatus,
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

// sourcesCmd is an alias for 'account fetch-sources'
var sourcesCmd = &cobra.Command{
	Use:   "sources [account-name]",
	Short: "[NON-INTERACTIVE] Alias for 'account fetch-sources' (-> then folder link)",
	Long: `[NON-INTERACTIVE - safe for LLM use]

Alias for 'scratchmd account fetch-sources'.

Lists available tables/collections from the CMS. Use this to find the table-id
needed for 'folder link'.

Examples:
  scratchmd sources webflow
  scratchmd sources webflow --json`,
	Args: cobra.MaximumNArgs(1),
	RunE: runAccountFetchSources,
}

func init() {
	// Add alias commands to root
	rootCmd.AddCommand(lsCmd)
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(checkCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(sourcesCmd)

	// Copy flags to alias commands
	lsCmd.Flags().Bool("json", false, "Output as JSON (machine-readable)")

	syncCmd.Flags().Bool("no-review", false, "Skip confirmation prompt (for automation/LLM use)")
	syncCmd.Flags().Bool("sync-deletes", false, "Delete remote CMS records when local file is removed (DESTRUCTIVE)")
	syncCmd.Flags().Bool("simulate", false, "Show what would happen without making changes")
	syncCmd.Flags().Bool("dry-run", false, "Alias for --simulate")
	syncCmd.Flags().Bool("json", false, "Output results as JSON (for automation/LLM use)")

	checkCmd.Flags().Bool("no-global-summary", false, "Don't show the 'Linked folders: N' line")
	checkCmd.Flags().Bool("no-table-summary", false, "Don't show per-table summary counts")
	checkCmd.Flags().Bool("no-file-status", false, "Don't list individual file statuses")
	checkCmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")

	initCmd.Flags().String("account.name", "", "Account name to link (required)")
	initCmd.Flags().String("table-id", "", "Table ID to link (required)")
	initCmd.MarkFlagRequired("account.name")
	initCmd.MarkFlagRequired("table-id")

	sourcesCmd.Flags().Bool("json", false, "Output as JSON (machine-readable)")
}
