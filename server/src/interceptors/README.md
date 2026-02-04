# Interceptors Module

## Overview

The interceptors module is a lightweight middleware layer in the NestJS application that handles cross-cutting concerns for HTTP requests.

## Purpose

This module provides request/response transformation, logging, and monitoring capabilities that apply across all HTTP endpoints without modifying individual controllers.

## Current Interceptors

### LoggingInterceptor

Implements NestJS's `NestInterceptor` interface to capture and log incoming HTTP request metadata.

**Functionality:**

- Extracts request method (GET, POST, etc.)
- Captures request URL
- Logs user-agent headers
- Logs at debug level using WSLogger

**Registration:**
Applied globally to all HTTP requests via `app.useGlobalInterceptors()` in `main.ts`.

## Integration

The interceptor integrates with:

- **WSLogger**: Centralized logging system using Winston
- **HTTP Layer**: Automatically intercepts all requests
- **Monitoring**: Provides visibility into traffic patterns

## Benefits

- **Observability**: Visibility into request patterns and traffic sources
- **Debugging**: Track API usage and request origins
- **Analytics**: Understanding of traffic sources (browsers, agents, etc.)
- **Performance**: Lightweight overhead with debug-level logging

## Architecture

Interceptors sit between the client and route handlers:

1. Request arrives
2. Interceptor captures metadata
3. Logs information
4. Passes request to handler
5. Returns response to client

## Extensibility

The modular design allows for future interceptors to handle:

- Request/response transformation
- Performance timing
- Authentication enrichment
- Error handling
- Response caching
- Rate limiting metadata

## Usage

Interceptors are automatically applied to all routes. No configuration needed in controllers or services—they work transparently at the application level.

## Logging Details

Uses Winston logging library through WSLogger, providing:

- Structured log format
- Debug level filtering
- Production-ready logging
- Integration with log aggregation services
