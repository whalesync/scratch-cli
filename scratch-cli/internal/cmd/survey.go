package cmd

import (
	"errors"
	"io"
	"os"

	"github.com/AlecAivazis/survey/v2"
	"github.com/AlecAivazis/survey/v2/terminal"
)

// ErrGoBack is returned when the user presses Escape to go back to the previous menu.
// Functions should check for this error and return nil to their caller to enable
// "back" navigation through the menu hierarchy.
var ErrGoBack = errors.New("go back")

// isInterrupt checks if the error is a survey interrupt (Escape or Ctrl+C).
func isInterrupt(err error) bool {
	return err != nil && err.Error() == "interrupt"
}

// escapeReader wraps stdin and converts Escape key to Ctrl+C (interrupt).
// This makes Escape behave as "go back" in Survey prompts.
type escapeReader struct {
	reader io.Reader
	fd     uintptr
}

func (r *escapeReader) Read(p []byte) (n int, err error) {
	n, err = r.reader.Read(p)
	if n > 0 {
		for i := 0; i < n; i++ {
			// Convert Escape (0x1b) to Ctrl+C (0x03) if it's a standalone escape
			// (not part of an escape sequence like arrow keys)
			if p[i] == 0x1b {
				// Check if this might be an escape sequence (more bytes follow quickly)
				// For a standalone Escape press, it's usually just the one byte
				if i == n-1 {
					// Last byte in buffer - likely standalone Escape
					p[i] = 0x03 // Convert to Ctrl+C
				}
			}
		}
	}
	return n, err
}

func (r *escapeReader) Fd() uintptr {
	return r.fd
}

// askOne wraps survey.AskOne and converts interrupt (Escape/Ctrl+C) to ErrGoBack.
// This enables consistent "press Escape to go back" behavior across all menus.
//
// Usage:
//
//	var result string
//	if err := askOne(prompt, &result); err != nil {
//	    return err // Returns ErrGoBack on Escape, allowing parent menu to continue
//	}
func askOne(prompt survey.Prompt, response interface{}, opts ...survey.AskOpt) error {
	// Wrap stdin to convert Escape to interrupt
	wrappedIn := &escapeReader{
		reader: os.Stdin,
		fd:     os.Stdin.Fd(),
	}

	// Prepend our custom stdio option
	allOpts := append([]survey.AskOpt{
		survey.WithStdio(wrappedIn, os.Stdout, os.Stderr),
	}, opts...)

	if err := survey.AskOne(prompt, response, allOpts...); err != nil {
		if isInterrupt(err) {
			return ErrGoBack
		}
		return err
	}
	return nil
}

// shouldGoBack checks if an error is ErrGoBack, used by callers to determine
// if they should return nil (go back) or propagate the error.
//
// Usage in parent menus:
//
//	if err := someSubMenu(); err != nil {
//	    if shouldGoBack(err) {
//	        continue // Stay in current menu loop
//	    }
//	    return err // Propagate other errors
//	}
func shouldGoBack(err error) bool {
	return errors.Is(err, ErrGoBack)
}

// Ensure escapeReader implements terminal.FileReader
var _ terminal.FileReader = (*escapeReader)(nil)
