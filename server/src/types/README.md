# Types Module

## Overview

The types module provides core type definitions and utility functions that form the foundation for type safety and error handling across the Spinner application.

## Purpose

This module establishes consistent patterns for ID generation, error handling, and progress tracking throughout the application, ensuring type safety and maintainable code.

## Module Components

### ids.ts - ID Generation and Management

Defines a prefixed ID system for globally unique, type-safe identifiers.

#### IdPrefixes Enum

20 different entity types with three-letter prefixes:

- `usr_` - Users
- `sna_` - Snapshots
- `org_` - Organizations
- `tok_` - API Tokens
- `con_` - Connectors
- `csv_` - CSV Records
- `aud_` - Audit Logs
- And more...

#### For Each ID Type

- **Branded TypeScript Type**: Type-safe ID handling
- **Validation Function**: `isUserId()`, `isWorkbookId()`, etc.
- **Creation Function**: Generate new IDs with nanoid

#### ID Format

- 3-letter prefix
- Underscore separator
- 10-character random string using nanoid
- Total: 14 characters (e.g., `usr_abc1234567`)

#### Benefits

- Type-safe ID handling throughout codebase
- Visually distinctive IDs
- Easily selectable in text editors
- Prevents ID type confusion
- Self-documenting entity types

### results.ts - Error Handling

Implements functional error handling with discriminated unions.

#### Result<T> Type

Represents either:

- **OkResult**: Successful operation with data
- **ErrResult**: Failed operation with error details

#### ErrorCode Enum

15+ error categories:

- GENERAL
- NOT_FOUND
- UNAUTHORIZED
- DATABASE
- TIMEOUT
- QUOTA_EXCEEDED
- And more...

#### Utility Functions

- **isOk()**: Check for success
- **isErr()**: Check for error
- **coalesceResults()**: Combine array of results
- **partition()**: Separate success/error results
- **fromNullable()**: Convert nullable to Result

#### Error Details

Each error captures:

- Error code
- Error message
- Underlying cause
- Context for debugging
- Retriability flag for job scheduling

#### Benefits

- Explicit error handling (replaces try-catch)
- Type-safe error propagation
- Rich error context
- Functional composition
- Job retry logic support

### progress.ts - Progress Tracking

Defines structures for tracking multi-layered operation progress.

#### Progress<T> Type

Three independent progress objects:

- **publicProgress**: User-facing progress info
- **jobProgress**: Internal job system progress
- **connectorProgress**: Service-specific progress
- **timestamp**: Progress update time

#### Use Cases

- Long-running operations monitoring
- User progress updates
- Internal job tracking
- Connector synchronization status

#### Benefits

- Granular progress visibility
- Separation of concerns
- Public vs. internal progress
- Detailed operation tracking

## Integration

The types module is used throughout the application:

### ID System

- Database models
- API responses
- URL parameters
- Service methods

### Result Type

- Service layer error handling
- API response wrapping
- Job execution results
- Connector operations

### Progress Type

- Job processing
- Upload operations
- Connector synchronization
- Background tasks

## Type Safety Benefits

- **Compile-time Checks**: Catch errors before runtime
- **IntelliSense Support**: Better IDE autocomplete
- **Refactoring Safety**: Confident code changes
- **Self-documenting**: Types describe intent
- **Error Prevention**: Impossible states eliminated

## Design Patterns

### Branded Types

IDs are branded to prevent mixing different ID types.

### Discriminated Unions

Result types use discriminators for type narrowing.

### Generic Types

Progress and Result work with any data type.

## Best Practices

- Always use type-safe ID creation functions
- Return Result types from services
- Use Progress for long-running operations
- Validate IDs before use
- Handle both Ok and Err cases
