# Utils Module

## Overview

The utils module is a collection of lightweight utility functions that provide cross-cutting helper functionality for the Whalesync server application.

## Purpose

This module serves as a foundational layer with reusable code that supports core operations across multiple services including uploads, snapshots, connectors, and database operations.

## Utilities

### csv-stream.helper.ts

Enables efficient CSV data export from PostgreSQL.

**Features:**

- Creates PostgreSQL COPY streams
- Configurable column selection
- WHERE clause filtering support
- Memory-efficient streaming
- Direct database-to-CSV pipeline

**Use Cases:**

- Export snapshot data
- Download query results
- Generate CSV reports
- Bulk data extraction

### encryption.ts

Provides secure encryption/decryption for sensitive data.

**Features:**

- AES-256-GCM encryption
- Secure key derivation
- Encrypted credential storage
- Decryption on-demand

**Use Cases:**

- Connector account credentials
- OAuth tokens
- API keys
- Sensitive configuration

### duration.ts

Type-safe duration handling and time calculations.

**Features:**

- Duration class for time operations
- Multiple time unit support (ms, sec, min, hour, day)
- Date arithmetic
- Human-readable formatting
- Type-safe conversions

**Use Cases:**

- Job scheduling
- Token expiration
- Rate limiting
- Timeout configuration
- Timestamp calculations

### helpers.ts

Enum parsing utilities.

**Features:**

- Convert strings to enum values
- Type-safe enum handling
- Validation support

**Use Cases:**

- API parameter parsing
- Configuration loading
- Type conversions

### asserts.ts

TypeScript exhaustiveness checking.

**Features:**

- Compile-time completeness checks
- Ensures all enum values handled
- Type narrowing support

**Use Cases:**

- Switch statement completeness
- Enum handling verification
- Type-safe branching

### urls.ts

URL validation and parsing.

**Features:**

- HTTP/HTTPS URL validation
- Regex pattern matching
- Safe URL handling

**Use Cases:**

- External resource validation
- Webhook URL verification
- API endpoint validation
- User input sanitization

### objects.ts

TypeScript type definitions for JSON-safe objects.

**Features:**

- JsonObject type
- JsonValue type
- Type-safe JSON handling

**Use Cases:**

- API request/response types
- Database JSON columns
- Configuration objects
- Metadata storage

## Integration

Utilities are used throughout the application:

### CSV Export

- Snapshot controller
- Uploads service
- Data export endpoints

### Encryption

- OAuth provider
- Connector account service
- Credential storage

### Duration

- Job scheduling
- Token management
- Timeout configuration
- Rate limiting

### URL Validation

- Style guide downloads
- Webhook configuration
- External resource imports

## Design Principles

### Separation of Concerns

- Extract domain-independent functions
- Prevent code duplication
- Single responsibility

### Type Safety

- TypeScript-first design
- Generic types where appropriate
- Compile-time validation

### Performance

- Efficient implementations
- Stream-based processing
- Minimal memory overhead

### Reusability

- Pure functions where possible
- No side effects
- Composable utilities

## Benefits

- **Consistency**: Uniform behavior across codebase
- **Maintainability**: Single location for common operations
- **Type Safety**: Compile-time error checking
- **Efficiency**: Optimized implementations
- **Testability**: Pure functions easy to test
- **Documentation**: Centralized reference

## Use Cases Summary

### Data Export

- CSV streaming
- Database COPY operations
- Efficient data transfer

### Security

- Credential encryption
- Token protection
- Secure storage

### Time Management

- Duration calculations
- Expiration handling
- Scheduling support

### Validation

- URL checking
- Enum parsing
- Type conversion

### Type Safety

- JSON object handling
- Exhaustiveness checking
- Type narrowing

## Testing

Utilities are designed to be easily testable:

- Pure functions
- No external dependencies
- Clear inputs and outputs
- Predictable behavior

## Extension

Easy to add new utilities:

1. Create new utility file
2. Export functions
3. Use throughout application
4. Maintain single responsibility
