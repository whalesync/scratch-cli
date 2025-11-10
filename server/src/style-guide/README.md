# Style Guide Module

## Overview

The style-guide module is a resource management system that allows users to create, store, and manage reference documents (style guides, design documentation, guidelines) within the application.

## Purpose

This module serves as a content repository where organizations can maintain shared resources with metadata about their purpose and format, providing a centralized location for documentation and guidelines.

## Endpoints

All endpoints protected by `ScratchpadAuthGuard` and scoped to user's organization:

### `POST /style-guides`
Create a new style guide.

### `GET /style-guides`
List all style guides for the user's organization.

### `GET /style-guides/:id`
Retrieve a specific style guide by ID.

### `PATCH /style-guides/:id`
Update style guide properties.

### `DELETE /style-guides/:id`
Remove a style guide.

### `GET /style-guides/download`
Download external content from URLs.

### `PATCH /style-guides/:id/update-external-resource`
Refresh guide content from an external source URL.

## Data Model

Style guides include:
- **Name**: Resource title
- **Body**: Content/documentation
- **Content Type**: Format (markdown, JSON, or text)
- **Source URL**: Optional external reference
- **Organization**: Organization-level visibility
- **Timestamps**: Creation and modification dates

## Content Types

### Markdown
- Formatted documentation
- Rich text support
- Code blocks and lists

### JSON
- Structured data
- Configuration files
- API schemas

### Plain Text
- Simple documentation
- Notes and guidelines
- Raw content

## External Resource Integration

### Download Resource
The `downloadResource` method can:
- Fetch content from HTTP URLs
- Convert HTML to markdown (using Postlight Parser)
- Preserve JSON format
- Preserve markdown format
- Preserve plain text format

### URL Processing
- URL validation and sanitization
- Automatic content-type detection
- Intelligent format conversion
- Error handling for invalid sources

## Security

- Organization-level isolation
- Only members can access organization's style guides
- URL validation before fetching
- Safe content processing

## Integration

The module integrates with:
- **Database Service**: Persistence via Prisma
- **PostHog**: Analytics for resource tracking
  - Resource creation events
  - Resource deletion events
- **Audit Log**: Compliance and change tracking

## Audit Trail

All operations are logged:
- Creation events
- Updates
- Deletions
- User attribution
- Timestamps

## Use Cases

- Store brand guidelines
- Share coding standards
- Maintain documentation
- Reference external resources
- Organization knowledge base
- Design system documentation
- API documentation
- Content templates
- Writing guidelines

## Organization Scoping

All operations enforce organization-level isolation:
- Users can only access their organization's guides
- Queries filtered by organization ID
- No cross-organization access
- Multi-tenant security

## Content Management

Features include:
- Create from scratch or URL
- Update content inline
- Refresh from external source
- Delete when no longer needed
- List all resources
- Organization-wide sharing

## External Resource Refresh

Keep content up-to-date:
- Re-fetch from source URL
- Update existing guide
- Maintain reference link
- Track update timestamps

## Benefits

- **Centralized Documentation**: Single source of truth
- **Version Control**: Track changes over time
- **External Integration**: Import from any URL
- **Format Flexibility**: Support multiple content types
- **Organization Sharing**: Team-wide access
- **Analytics**: Track usage and adoption
