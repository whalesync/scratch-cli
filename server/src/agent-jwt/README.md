# Agent JWT Module

## Overview

The agent-jwt module is a specialized NestJS module responsible for generating JSON Web Tokens (JWTs) for agent authentication within the Scratchpad application.

## Purpose

This module serves as a bridge between the server-side authentication system and client-side agents that need to interact with protected resources. It provides secure token generation for agents to authenticate on behalf of users.

## Key Components

### JwtGeneratorService

The main service exports a single method to generate tokens containing:
- `userId`: The authenticated user's ID
- `role`: The user's role (from Prisma's UserRole enum)

The service is configured globally and uses environment-based secrets and expiration times from the `ScratchpadConfigService`.

## Token Generation

Tokens are generated on-demand when authenticated users request them, as seen in the `UsersController.currentUser()` endpoint. The generated agent JWT allows agents to perform operations with proper authorization controls based on the user's assigned role.

## Integration

The module is imported at the application root level and consumed primarily by the users module for token generation during authentication flows. The token payload is minimal but sufficient for securing agent requests while maintaining proper authorization.

## Security

- Tokens include expiration timestamps
- Secret keys are loaded from environment configuration
- Token payload includes only essential user identity information
