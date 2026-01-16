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
Cursor, or other editors. Content is stored as Markdown files with YAML
frontmatter for easy manipulation.

COMMANDS FOR LLM/AUTOMATION (non-interactive, no TTY required):
  scratchmd account add <name> --provider=webflow --api-key=KEY
  scratchmd account list
  scratchmd account list-tables <account>
  scratchmd account link-table <account> <table-id> [folder]
  scratchmd account remove <name>
  scratchmd content download [folder]

COMMANDS FOR HUMANS (interactive, requires TTY):
  scratchmd setup                  # Full interactive wizard
  scratchmd account setup          # Interactive account setup

TYPICAL LLM WORKFLOW:
  1. scratchmd account add --provider=webflow --api-key=<key>
  2. scratchmd account list-tables webflow
  3. scratchmd account link-table webflow <table-id> my-content
  4. scratchmd content download my-content

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
