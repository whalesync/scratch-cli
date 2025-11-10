# Custom Connector Module

## Overview

The custom-connector module is a NestJS feature that enables users to create, configure, and manage custom data source connectors within the Whalesync application.

## Purpose

This module provides a complete CRUD API for defining connectors for arbitrary external APIs or data sources by specifying implementation details programmatically. Users can integrate custom data sources without requiring code changes to the core application.

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard` and scoped to the authenticated user:

### `POST /custom-connectors`
Creates a new custom connector.

### `PUT /custom-connectors/:id`
Updates an existing connector configuration.

### `GET /custom-connectors`
Retrieves all connectors for the authenticated user.

### `GET /custom-connectors/:id`
Fetches a specific connector by ID.

### `DELETE /custom-connectors/:id`
Removes a connector.

## Configuration Options

Custom connectors can be configured with:

- **Table Definitions**: Define available tables/entities
- **Polling Functions**: Retrieve data from external sources
- **CRUD Operations**: Create, read, update, delete record implementations
- **Schema Definitions**: Define table structures
- **Response Schemas**: Define expected API response formats
- **Field Mappings**: Map external fields to internal schema

### Mapping System

The `MappingConfig` structure specifies how to extract records from API responses:
- **Record Array Path**: Where to find records in the response
- **ID Path**: How to identify unique records
- **Field Mappings**: Map external fields to internal fields with type information

## Architecture

The module follows NestJS architectural patterns:
- **Controller Layer**: Manages HTTP requests
- **Service Layer**: Handles business logic
- **Database Layer**: Persists connector data via DbService

## Data Isolation

All connector data is scoped to individual users, supporting multi-tenant isolation and ensuring users can only access their own connectors.

## Integration

The custom-connector module works alongside:
- **Custom Connector Builder**: AI-powered code generation for connector functions
- **Snapshot Module**: Uses custom connectors as data sources
- **Remote Service**: Instantiates custom connectors for data operations

## Use Cases

- Integrate internal APIs
- Connect to proprietary data sources
- Build custom data pipelines
- Support unique external services
- Prototype new integrations
