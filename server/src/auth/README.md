# Auth Module

## Overview

The auth module implements a comprehensive authentication system for the Whalesync Spinner application using NestJS and Passport, supporting multiple authentication strategies for different client types.

## Purpose

This module provides unified authentication and authorization mechanisms to accommodate web users, API consumers, and internal agents while maintaining consistent user identity throughout the system.

## Authentication Strategies

### ClerkStrategy

- Validates JWT tokens issued by Clerk (external identity provider)
- Automatically creates or retrieves users in the database by their Clerk ID
- Used for web application authentication

### APITokenStrategy

- Validates user-scoped API tokens stored in the database
- Enables programmatic access for authenticated users
- Used for CLI tools and API integrations

### AgentTokenStrategy

- Validates special agent tokens (shared secret key + user ID)
- Allows internal agents or services to operate on behalf of users
- Used for AI agents and internal services

## Guards

### ScratchpadAuthGuard

- Controller-level guard for HTTP endpoints
- Attempts authentication in sequence:
  1. API token
  2. Agent token
  3. JWT (Clerk)
- Succeeds if any strategy validates successfully

### WebSocketAuthGuard

- Designed for Socket.io WebSocket connections
- Implements dual authentication fallback:
  1. API token first
  2. JWT second
- Throws WebSocket-specific exceptions on failure

## Types and Utilities

### AuthenticatedUser

Extension of base user data with metadata about authentication type and source.

### RequestWithUser / SocketWithUser

Type definitions that inject authenticated user into request/socket contexts.

### hasAdminToolsPermission()

Role-based access control function that checks if a user:

- Has an ADMIN role
- Authenticated via either JWT or API token

### userToActor()

Note: The `toActor()` function has been moved to `users/types.ts` as `userToActor()`. It converts authenticated users into actor objects with organization context and subscription status, supporting the organization-based authorization model.

## Integration

The auth module is a foundational module used throughout the application to protect endpoints and enforce access control. It integrates with:

- Clerk for identity management
- Database for API token validation
- User management for actor context
- WebSocket gateway for real-time communication

## Security Features

- Multiple authentication mechanisms
- Role-based access control
- Organization-based authorization
- Token validation and verification
- Secure user identity propagation
