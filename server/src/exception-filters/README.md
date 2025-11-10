# Exception Filters Module

## Overview

The exception-filters module contains NestJS global exception filters that handle application-level errors and transform them into standardized HTTP responses.

## Purpose

This module provides centralized error handling that catches specific exceptions and converts them into properly formatted HTTP responses with meaningful error messages for API consumers.

## Current Filters

### ConnectorInstantiationErrorExceptionFilter

Registered globally in `main.ts`, this filter:
- Catches `ConnectorInstantiationError` exceptions
- Converts them to `InternalServerErrorException` responses
- Extracts error details (service name, error message)
- Returns structured HTTP 500 responses

Instead of generic "Internal server error" messages, clients receive descriptive information about why a specific connector failed to initialize.

## Error Response Format

The filter provides:
- HTTP status code (typically 500)
- Detailed error message
- Service-specific context
- Actionable information for debugging

## Integration with Error Utilities

Works in conjunction with error handling utilities in `remote-service/connectors/error.ts`:
- Standardized error templates
- Common error scenarios:
  - Unauthorized credentials
  - Quota exceeded
  - Timeouts
  - Oversized responses
- Axios error extraction utilities

## Benefits

- **Improved User Experience**: Descriptive errors instead of opaque failures
- **Better Debugging**: Clear indication of what went wrong
- **Consistent Responses**: Standardized error format across API
- **Graceful Degradation**: Handles connector failures without crashing

## Architecture

Exception filters are registered globally at application bootstrap, intercepting exceptions before they reach the client. This creates a cohesive error handling strategy where:
1. Connector-specific failures are captured
2. Error details are standardized
3. Helpful messages are returned to clients

## Extensibility

The module is designed to support additional exception filters for:
- Different error types
- Service-specific exceptions
- Custom business logic errors
- Third-party integration failures

## Usage

Filters are automatically applied to all routes. No special configuration needed in controllers or services—just throw the appropriate exception type.
