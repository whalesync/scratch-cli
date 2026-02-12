// Package cmd contains all CLI command definitions for scratchmd.
package cmd

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/whalesync/scratch-cli/internal/api"
	"github.com/whalesync/scratch-cli/internal/config"
)

// authCmd represents the auth command
var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication with Scratch.md",
	Long: `Manage your authentication with Scratch.md.

Commands:
  auth login     Authenticate with Scratch.md
  auth logout    End current session
  auth status    Show current auth state`,
}

// authLoginCmd represents the auth login command
var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with Scratch.md",
	Long: `Authenticate the CLI with your Scratch.md account.

This command opens a browser to Scratch.md where you can log in and authorize the CLI.
If the browser doesn't open automatically, you can manually visit the URL and enter
the code displayed in the terminal.

Once authorized, an API token is stored locally for future CLI operations.`,
	RunE: runAuthLogin,
}

// authLogoutCmd represents the auth logout command
var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "End current session",
	Long: `Remove stored authentication credentials.

This revokes the CLI's access to your Scratch.md account.`,
	RunE: runAuthLogout,
}

// authStatusCmd represents the auth status command
var authStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show current auth state",
	Long:  `Display the current authentication status and stored credentials info.`,
	RunE:  runAuthStatus,
}

func init() {
	rootCmd.AddCommand(authCmd)
	authCmd.AddCommand(authLoginCmd)
	authCmd.AddCommand(authLogoutCmd)
	authCmd.AddCommand(authStatusCmd)

	// Flags for auth login
	authLoginCmd.Flags().Bool("no-browser", false, "Don't open browser automatically")
	authLoginCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")

	// Flags for auth logout
	authLogoutCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")

	// Flags for auth status
	authStatusCmd.Flags().String("server", "", "Scratch.md server URL (defaults to configured server)")
}

func runAuthLogin(cmd *cobra.Command, args []string) error {
	noBrowser, _ := cmd.Flags().GetBool("no-browser")
	serverURL, _ := cmd.Flags().GetString("server")

	// Use default or config server URL
	if serverURL == "" {
		cfg, err := config.LoadConfig()
		if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
			serverURL = cfg.Settings.ScratchServerURL
		} else {
			serverURL = api.DefaultScratchServerURL
		}
	}

	// Check if already logged in for this server
	if config.IsLoggedIn(serverURL) {
		creds, _ := config.LoadGlobalCredentials(serverURL)
		fmt.Printf("You are already logged in to %s", serverURL)
		if creds.Email != "" {
			fmt.Printf(" as %s", creds.Email)
		}
		fmt.Println(".")
		fmt.Println("Run 'scratchmd auth logout' to log out first.")
		return nil
	}

	client := api.NewClient(api.WithBaseURL(serverURL))

	fmt.Println()
	fmt.Println("🔐 Authenticating with Scratch.md...")
	fmt.Println()

	// Initiate authorization
	initResp, err := client.InitiateAuth()
	if err != nil {
		return fmt.Errorf("failed to initiate authentication: %w", err)
	}
	if initResp.Error != "" {
		return fmt.Errorf("authentication error: %s", initResp.Error)
	}

	// Build verification URL with code query parameter
	verificationURLWithCode := fmt.Sprintf("%s?code=%s", initResp.VerificationURL, initResp.UserCode)

	// Display the user code
	// Calculate inner width by counting spaces in the empty line
	emptyLine := "│                                             │"
	innerWidth := strings.Count(emptyLine, " ")
	innerString := fmt.Sprintf("Your authorization code is: %s", initResp.UserCode)
	// Adjust for any rendering/display differences
	// innerWidth = innerWidth - 2
	totalPadding := innerWidth - len(innerString)
	if totalPadding < 0 {
		totalPadding = 0 // Safety check in case string is too long
	}
	leftPadding := totalPadding / 2
	rightPadding := totalPadding - leftPadding // Handles odd numbers correctly
	leftSpaces := strings.Repeat(" ", leftPadding)
	rightSpaces := strings.Repeat(" ", rightPadding)
	fmt.Println("┌─────────────────────────────────────────────┐")
	fmt.Println(emptyLine)
	fmt.Printf("│%s%s%s│\n", leftSpaces, innerString, rightSpaces)
	fmt.Println(emptyLine)
	fmt.Println("└─────────────────────────────────────────────┘")
	fmt.Println()
	fmt.Printf("Visit: %s\n", verificationURLWithCode)
	fmt.Println()

	// Try to open browser
	if !noBrowser {
		fmt.Println("Opening browser...")
		if err := openBrowser(verificationURLWithCode); err != nil {
			fmt.Println("Could not open browser automatically.")
			fmt.Println("Please open the URL above manually.")
		}
	}

	fmt.Println()
	fmt.Println("Waiting for authorization...")
	fmt.Printf("(Code expires in %d seconds)\n", initResp.ExpiresIn)
	fmt.Println()

	// Poll for authorization
	pollInterval := time.Duration(initResp.Interval) * time.Second
	if pollInterval < time.Second {
		pollInterval = 5 * time.Second
	}

	timeout := time.Duration(initResp.ExpiresIn) * time.Second
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)

		pollResp, err := client.PollAuth(initResp.PollingCode)
		if err != nil {
			fmt.Printf("⚠️  Polling error: %s\n", err)
			continue
		}

		switch pollResp.Status {
		case "approved":
			// Save the credentials for this server
			creds := &config.GlobalCredentials{
				APIToken:  pollResp.APIToken,
				Email:     pollResp.UserEmail,
				ExpiresAt: pollResp.TokenExpiresAt,
			}
			if err := config.SaveGlobalCredentials(serverURL, creds); err != nil {
				return fmt.Errorf("failed to save credentials: %w", err)
			}

			fmt.Println()
			fmt.Println("✅ Authentication successful!")
			if pollResp.UserEmail != "" {
				fmt.Printf("   Logged in as: %s\n", pollResp.UserEmail)
			}
			if pollResp.TokenExpiresAt != "" {
				fmt.Printf("   Token expires: %s\n", pollResp.TokenExpiresAt)
			}
			fmt.Println()
			fmt.Println("You can now use scratchmd commands that require authentication.")
			return nil

		case "denied":
			return fmt.Errorf("authorization denied: %s", pollResp.Error)

		case "expired":
			return fmt.Errorf("authorization code expired. Please try again")

		case "pending":
			// Continue polling
			fmt.Print(".")
		}
	}

	return fmt.Errorf("authorization timed out. Please try again")
}

func runAuthLogout(cmd *cobra.Command, args []string) error {
	serverURL, _ := cmd.Flags().GetString("server")

	// Use default or config server URL
	if serverURL == "" {
		cfg, err := config.LoadConfig()
		if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
			serverURL = cfg.Settings.ScratchServerURL
		} else {
			serverURL = api.DefaultScratchServerURL
		}
	}

	if !config.IsLoggedIn(serverURL) {
		fmt.Printf("You are not logged in to %s.\n", serverURL)
		return nil
	}

	creds, _ := config.LoadGlobalCredentials(serverURL)
	email := creds.Email

	if err := config.ClearGlobalCredentials(serverURL); err != nil {
		return fmt.Errorf("failed to clear credentials: %w", err)
	}

	fmt.Printf("✅ Logged out from %s successfully.\n", serverURL)
	if email != "" {
		fmt.Printf("   Was logged in as: %s\n", email)
	}
	return nil
}

func runAuthStatus(cmd *cobra.Command, args []string) error {
	serverURL, _ := cmd.Flags().GetString("server")

	// Use default or config server URL
	if serverURL == "" {
		cfg, err := config.LoadConfig()
		if err == nil && cfg.Settings != nil && cfg.Settings.ScratchServerURL != "" {
			serverURL = cfg.Settings.ScratchServerURL
		} else {
			serverURL = api.DefaultScratchServerURL
		}
	}

	creds, err := config.LoadGlobalCredentials(serverURL)
	if err != nil {
		return fmt.Errorf("failed to load credentials: %w", err)
	}

	fmt.Println()
	fmt.Printf("📋 Server: %s\n", serverURL)
	fmt.Println()
	if creds.APIToken == "" {
		fmt.Println("   Status: Not logged in")
		fmt.Println()
		fmt.Println("Run 'scratchmd auth login' to authenticate.")
	} else {
		fmt.Println("   Status: Logged in")
		if creds.Email != "" {
			fmt.Printf("   Email: %s\n", creds.Email)
		}
		if creds.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, creds.ExpiresAt)
			if err == nil {
				daysUntilExpiry := int(time.Until(expiresAt).Hours() / 24)
				if daysUntilExpiry < 0 {
					fmt.Println("   Token has expired")
				} else if daysUntilExpiry == 0 {
					fmt.Println("   Token expires today")
				} else if daysUntilExpiry == 1 {
					fmt.Println("   Token expires in 1 day")
				} else {
					fmt.Printf("   Token expires in %d days\n", daysUntilExpiry)
				}
			} else {
				fmt.Printf("   Token expires at %s\n", creds.ExpiresAt)
			}
		}
		fmt.Println()
		fmt.Println("Run 'scratchmd auth logout' to log out.")
	}
	fmt.Println()

	return nil
}

// openBrowser opens the specified URL in the default browser
func openBrowser(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return cmd.Start()
}
