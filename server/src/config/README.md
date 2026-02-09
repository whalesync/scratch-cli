# Config Module

## Overview

The config module is a centralized configuration management system for the Scratch application built with NestJS, providing typed access to environment variables and configuration settings.

## Purpose

This module serves as the single source of truth for all environment configuration throughout the server, eliminating scattered environment variable access and centralizing configuration management.

## Key Components

### ScratchpadConfigModule

- NestJS module that initializes ConfigModule globally
- Loads environment variables from `.env` file
- Exports ScratchpadConfigService for dependency injection

### ScratchpadConfigService

Singleton injectable service that provides typed, application-specific environment variable accessors for:

- **Deployment Settings**: Environment type, microservice type
- **Database**: Connection URLs, SSL configuration
- **Authentication**: Clerk credentials, JWT secrets
- **Third-party APIs**: Gemini, PostHog, OpenRouter, Stripe
- **Redis**: Connection parameters
- **Feature Flags**: Experimental features, billing settings
- **Client URLs**: Environment-specific base URLs

## Microservice Architecture Support

The service supports polyglot microservice deployments with four service types:

- **FRONTEND**: API server handling HTTP requests
- **WORKER**: Bull MQ task runner for background jobs
- **CRON**: Scheduled task runner
- **MONOLITH**: All services combined (for local development)

Static helper methods determine which services are enabled:

- `isFrontendService()`
- `isTaskWorkerService()`
- `isCronService()`

This allows the same codebase to be deployed as different microservice types with different behaviors.

## Environment-Specific Behavior

The module handles environment-specific configuration:

- Production
- Development
- Staging
- Test

Dynamic configuration includes:

- Client base URL determination
- SSL requirements
- Feature availability
- External service endpoints

## Integration

The module is globally imported by the main application module and used throughout the server by:

- Authentication services
- Database connections
- External API integrations
- Feature flag evaluation
- Service initialization

## Configuration Management

The service includes:

- **Required accessors**: Throw errors if values are missing
- **Optional accessors**: Provide sensible defaults
- **Type safety**: All values are properly typed
- **Validation**: Configuration is validated at startup
