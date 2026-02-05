# scratchmd CLI - LLM Agent Reference

Quick reference for AI agents using the scratchmd CLI.

## Authentication Commands

```bash
# Log in to Scratch.md (opens browser for authentication)
scratchmd auth login

# Log in without opening browser (displays URL to visit manually)
scratchmd auth login --no-browser

# Log in to a specific server
scratchmd auth login --server https://api.scratch.md

# Check authentication status
scratchmd auth status

# Log out
scratchmd auth logout
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (check stderr) |

## Authentication Flow

1. Run `scratchmd auth login`
2. Browser opens to Scratch.md authorization page
3. Enter the displayed code or click the link with code
4. Approve the CLI authorization
5. CLI receives and stores API token

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Not logged in" | Run `scratchmd auth login` |
| "Token expired" | Run `scratchmd auth login` to get a new token |
| Browser doesn't open | Use `--no-browser` flag and visit the URL manually |
