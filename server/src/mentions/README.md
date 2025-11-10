# Mentions Module

## Overview

The mentions module is a NestJS feature module that provides search functionality for finding resources and records within the application, supporting autocomplete and reference discovery.

## Purpose

This module enables users to discover relevant content through text search, likely powering @-mention autocomplete or link suggestion functionality within the application.

## Endpoints

Both endpoints are protected by `ScratchpadAuthGuard`:

### `POST /mentions/search/resources`
Searches for markdown uploads (MD documents) by name.

**Functionality:**
- Queries the Upload table for markdown files
- Matches search text against file names
- Fetches full content from MdUploads schema
- Provides preview snippets

**Returns:** List of matching markdown documents with metadata and content.

### `POST /mentions/search/records`
Searches for database records within a specific snapshot and table by their title field.

**Functionality:**
- Retrieves snapshot and table specifications
- Locates the title column
- Performs case-insensitive pattern matching
- Searches within snapshot database

**Returns:** List of matching records with their data.

## Core Service

### MentionsService

Provides search logic across two distinct data sources:

1. **Resource Search**: Queries markdown uploads for documentation and notes
2. **Record Search**: Searches within snapshot data for entity references

## Data Sources

- **Upload Table**: Markdown file metadata (via DbModule)
- **MdUploads Schema**: Markdown content storage (via UploadsModule)
- **Snapshot Database**: Table data within snapshots (via SnapshotDbModule)

## Integration

The module depends on four other modules:
- **DbModule**: Database access for uploads
- **SnapshotModule**: Snapshot metadata
- **SnapshotDbModule**: Snapshot data queries
- **UploadsModule**: File content access

## Use Cases

- @-mention autocomplete in text editors
- Link suggestion for internal resources
- Quick reference lookup
- Cross-referencing documents and data
- Search-as-you-type functionality
- Entity discovery

## Search Features

- **Case-insensitive**: Flexible text matching
- **Pattern matching**: Partial text search
- **Scoped search**: Within specific snapshots/tables
- **Fast lookup**: Optimized for autocomplete
- **Context-aware**: Respects user permissions

## Architecture

The service performs targeted searches against specific tables and schemas, avoiding full-text search complexity while providing responsive results for mention/reference features.
