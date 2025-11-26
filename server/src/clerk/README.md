# Clerk Module

## Overview

The Clerk module is an authentication and identity management integration layer that encapsulates the Clerk backend SDK within the NestJS application.

## Purpose

This module provides a clean, injectable service for accessing Clerk's user and organization management capabilities while abstracting away the direct SDK initialization and configuration details.

## Key Components

### ClerkClientProvider

Initializes the Clerk SDK client using API keys from the application's configuration service.

### ClerkService

Wraps the Clerk SDK with two primary methods:

- **getUserById()**: Look up users by their Clerk ID
- **getOrganizationById()**: Look up organizations by their Clerk ID

### ClerkModule

NestJS module that ties everything together and exports services for use throughout the application.

## Integration

The module is primarily used by the AuthModule to support JWT token verification and user authentication. Specifically:

1. The `ClerkStrategy` (a Passport authentication strategy) uses the Clerk SDK to:
   - Verify incoming JWT bearer tokens
   - Extract user information from tokens
   - Synchronize or create corresponding user records in the local database

This enables the application to leverage Clerk as its authentication provider while maintaining local user records for application-specific functionality.

## Design Benefits

- **Clean Abstraction**: Centralizes Clerk SDK configuration
- **Testable**: Makes the Clerk client easy to mock for testing
- **Reusable**: Provides a typed service interface
- **Maintainable**: Makes it easy to mock or replace the authentication provider if needed

## Configuration

The module depends on the `ScratchpadConfigService` to provide:

- Clerk API keys
- Environment-specific settings
- Authentication configuration
