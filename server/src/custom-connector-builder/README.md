# Custom Connector Builder Module

## Overview

The custom-connector-builder module (RestApiImportModule) is an AI-powered code generation and execution engine that enables users to create connectors for arbitrary REST APIs without manual coding.

## Purpose

This module serves as a bridge between the application and external APIs by generating and executing JavaScript functions dynamically. It handles common data synchronization patterns using AI to generate appropriate code.

## Architecture

The module follows a generate-and-execute pattern:
1. User calls a "generate" endpoint with a plain-language prompt
2. AI service creates a JavaScript function
3. User calls corresponding "execute" endpoint to run the generated function
4. Function executes in isolated VM sandbox with 5-second timeout

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard`:

### Generate Endpoints
- `POST /generate-schema`: Generate function to fetch table schema
- `POST /generate-poll-records`: Generate function to list/poll records
- `POST /generate-list-tables`: Generate function to list available tables
- `POST /generate-create-record`: Generate function to create records
- `POST /generate-update-record`: Generate function to update records
- `POST /generate-delete-record`: Generate function to delete records

### Execute Endpoints
- `POST /execute-schema`: Execute generated schema function
- `POST /execute-poll-records`: Execute generated polling function
- `POST /execute-list-tables`: Execute generated list tables function
- `POST /execute-create-record`: Execute generated create function
- `POST /execute-update-record`: Execute generated update function
- `POST /execute-delete-record`: Execute generated delete function

## Core Services

### Schema Services
Fetch and define table structures from external APIs.

### Polling Services
Retrieve and list records from data sources.

### CRUD Services
- **Create**: Add new records to external systems
- **Update**: Modify existing records
- **Delete**: Remove records from external systems

### List Tables Services
Discover available tables/entities in multi-table services (like Airtable).

## Service Types

- **Opinionated Schema**: Services with predefined entities (CRMs like Salesforce)
- **Flexible Schema**: Services with user-defined tables (spreadsheet apps)

## AI Integration

The module leverages the `AiService` to:
- Generate functions from natural language prompts
- Include guidelines and examples in prompts
- Transform arbitrary API responses into standardized formats
- Handle various authentication methods
- Adapt to different API patterns

## Security

- Functions execute in isolated Node.js VM sandbox
- 5-second timeout prevents runaway code
- No access to file system or network (except within function context)
- User authentication required

## Integration

The module integrates with:
- **AI Module**: For code generation
- **Custom Connector Module**: Stores connector metadata and prompts
- **Auth Module**: Enforces user authentication

## Use Cases

- Quick API prototyping
- Connect to undocumented APIs
- Build custom integrations rapidly
- Support unique API patterns
- Enable non-technical users to build connectors
