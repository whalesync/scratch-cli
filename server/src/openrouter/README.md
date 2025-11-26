# OpenRouter Module

## Overview

The OpenRouter module is a NestJS service layer that manages API keys and credentials for OpenRouter, a unified API gateway for accessing multiple large language models.

## Purpose

This module provides programmatic access to OpenRouter's provisioning and key management APIs, enabling the Scratchpad application to create, update, and manage user-specific API keys with credit limits.

## Key Components

### OpenRouterService

Injectable service that handles all HTTP communication with OpenRouter's API using axios.

### Types (types.ts)

TypeScript interfaces defining:

- OpenRouter API response structures
- Request payload formats
- Result types (success/error states)

### OpenRouterModule

NestJS module that exports the service for dependency injection throughout the application.

## Core Operations

### Create API Key

- Creates new API keys for users
- Configurable credit limits
- User-specific provisioning

### Retrieve Key Data

- Fetches current API key information
- Includes usage statistics
- Rate limit information

### Update Key Properties

- Modifies credit limits
- Changes enabled/disabled status
- Updates key configurations

### Enable/Disable Keys

- Temporarily disable keys
- Re-enable disabled keys
- No key deletion required

### Delete Keys

- Permanently removes API keys
- Cleans up provisioned resources

## Authentication

All operations use a provisioning key for authentication:

- Loaded from `ScratchpadConfigService`
- Environment-specific configuration
- Secure credential management

## Error Handling

Returns typed result objects:

- **Success**: Contains requested data
- **Error**: Includes error details and messages

Proper error handling for:

- Network failures
- API errors
- Invalid requests
- Rate limiting

## Integration

Currently integrated into:

- **Users Module**: Agent credentials controller
- **Provisioning**: Creates keys for new users
- **User Management**: Key lifecycle management

Enables the application to provision and manage OpenRouter API keys on behalf of users within the Scratchpad.ai platform.

## Use Cases

- Provision AI API keys for users
- Track usage and credits
- Enforce spending limits
- Enable/disable user access
- Manage API key lifecycle
- Support multiple LLM providers through single API

## Configuration

Requires environment configuration:

- OpenRouter provisioning key
- API endpoint URLs
- Environment-specific settings

## Benefits

- **Unified Access**: Single API for multiple LLMs
- **Cost Management**: Credit limit controls
- **User Isolation**: Individual user keys
- **Flexibility**: Enable/disable without deletion
- **Monitoring**: Usage tracking and analytics
