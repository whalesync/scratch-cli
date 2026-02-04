# Users Module

## Overview

The Users module is a NestJS-based authentication and credential management system that handles user identity, authentication tokens, and organizational context.

## Purpose

This module serves as a core component for managing user accounts and their associated resources within the Whalesync application, including session management and API tokens.

## Controllers

### UsersController

Provides user session management:

#### `GET /users/current`

Returns authenticated user with:

- User profile information
- JWT tokens (websocket and agent)
- Feature flags
- Organization context
- Subscription status

#### Debug Endpoint

Resource provisioning for development/testing.

## Core Services

### UsersService

Handles user lifecycle management:

#### User Creation

- Via Clerk authentication
- Automatic API token provisioning
- Trial subscription creation
- Slack notifications for new users

#### User Lookups

- By user ID
- By Clerk ID
- By API token

#### Token Management

- Websocket tokens (short-lived)
- API tokens (long-lived)
- Token expiration handling
- Secure token generation

### Supporting Services

- **SubscriptionService**: Track user subscriptions
- **OrganizationService**: Manage organizational context

## User Provisioning Flow

1. User signs up via Clerk
2. Clerk strategy creates user in database
3. API tokens generated
4. Trial subscription created
5. Slack notification sent
6. PostHog event captured

## Token Types

### Websocket Tokens

- Short expiration
- Used for real-time connections
- Generated per session

### API Tokens

- Long-lived (configurable expiration)
- Used for programmatic access
- Multiple tokens per user
- Can be revoked

## Authorization

### Actor Pattern

Users converted to Actor objects with:

- User ID
- Organization context
- Role information

### Role-Based Access

- ADMIN role for privileged operations
- User role for standard access
- System role for internal operations

## Integration

The module imports and integrates with:

- **DbModule**: Database access
- **AuthModule**: Authentication strategies
- **PaymentModule**: Subscription management
- **PosthogModule**: Analytics tracking
- **SlackModule**: Notification sending
- **AuditLogModule**: Activity logging
- **ExperimentsModule**: Feature flags

## Security Features

### Token Security

- Secure random generation
- Expiration handling
- Revocation support

### Organization Isolation

- Users scoped to organizations
- No cross-organization access
- Proper authorization checks

## User Data

User objects include:

- Profile information (name, email)
- Clerk ID (external identity)
- Organization membership
- Role assignment
- API tokens
- Subscription status
- Creation timestamp

## Feature Flags

Users receive personalized feature flags:

- Loaded from experiments module
- Included in current user response
- Enable client-side feature gates

## Analytics

User events tracked:

- User creation
- Login events
- Feature usage

## Use Cases

- User authentication and authorization
- API access management
- Session management
- Organization membership
- Subscription tracking
- Feature access control
- Audit trail maintenance

## Benefits

- **Comprehensive**: Full user lifecycle management
- **Secure**: Multi-layer authentication and authorization
- **Integrated**: Works with external services (Clerk, Stripe)
- **Auditable**: Complete activity tracking
- **Flexible**: Multiple authentication methods
- **Scalable**: Organization-based multi-tenancy
