# OAuth Module

## Overview

The OAuth module handles third-party service authentication and authorization for the Whalesync application, managing the complete OAuth 2.0 flow for multiple service providers.

## Purpose

This module enables users to connect their accounts with external services (Notion, Webflow, Wix Blog, YouTube) using either system-provided OAuth credentials or custom OAuth applications they own.

## Supported Services

- **Notion**: Workspace and database integration
- **Webflow**: Website and CMS integration
- **Wix Blog**: Blog platform integration
- **YouTube**: Video platform integration

## Endpoints

All endpoints require `ScratchpadAuthGuard` authentication:

### `POST /oauth/:service/initiate`

Starts the OAuth flow and generates an authorization URL.

**Functionality:**

- Creates OAuth state for security
- Generates provider-specific auth URL
- Returns URL for user redirection

### `POST /oauth/:service/callback`

Handles OAuth provider redirects and exchanges authorization codes for access tokens.

**Functionality:**

- Validates OAuth state
- Exchanges code for access tokens
- Encrypts and stores tokens
- Creates connector account

### `POST /oauth/refresh`

Refreshes expired access tokens.

**Functionality:**

- Checks token expiration (with 5-minute buffer)
- Requests new tokens from provider
- Updates stored credentials
- Returns refreshed tokens

## Architecture

### Provider Pattern

Each service implements the `OAuthProvider` interface:

- **generateAuthUrl()**: Creates authorization URL
- **exchangeCodeForToken()**: Trades code for tokens
- **refreshToken()**: Renews expired tokens

Service-specific implementations handle OAuth variations.

## Token Management

### Security

- Access tokens encrypted before database storage
- Refresh tokens encrypted separately
- Decryption on-demand when needed

### Lifecycle

- Automatic expiration checking
- Proactive refresh (5-minute buffer)
- Token validation before use

## OAuth Types

### System OAuth

- Uses application-provided credentials
- Managed by Whalesync
- Standard integration path

### Custom OAuth

- Users provide their own client credentials
- Stored as connector metadata
- Enables custom applications

## Integration

The module integrates with:

- **Database Layer**: Persists connector accounts (via Prisma)
- **PostHog**: Analytics tracking for OAuth events
- **Encryption Service**: Secures token storage
- **Configuration Service**: OAuth client credentials

## Data Model

Connector accounts store:

- Service type
- OAuth credentials (encrypted)
- Token expiration times
- User association
- Custom OAuth metadata
- Creation/update timestamps

## Error Handling

Handles OAuth-specific errors:

- Invalid state validation
- Token exchange failures
- Refresh token expiration
- Provider API errors

## Use Cases

- Connect user accounts to external services
- Enable data synchronization
- Access third-party APIs on behalf of users
- Maintain secure credential storage
- Support multiple OAuth providers
