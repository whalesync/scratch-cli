# Experiments Module

## Overview

The experiments module provides a feature flagging system for the Whalesync Spinner application, enabling A/B testing, controlled feature rollout, and experimentation.

## Purpose

This module implements an abstraction layer around OpenFeature, a vendor-agnostic feature management SDK, allowing the application to support multiple backend providers while maintaining a consistent interface for feature flags.

## Flag Types

### System-Wide Flags

Flags that apply globally across the application:

- `SAMPLE_SYSTEM_FLAG`

### User-Scoped Flags

Flags evaluated per-user:

- `DEV_TOOLBOX`: Developer tools access
- `REQUIRE_SUBSCRIPTION`: Subscription requirement enforcement
- `CONNECTOR_LIST`: Available connector list configuration
- `USE_JOBS`: Background job system enablement

## Core Service Methods

### ExperimentsService

- **getBooleanFlag()**: Evaluate boolean feature flags
- **getStringFlag()**: Evaluate string feature flags
- **getNumberFlag()**: Evaluate numeric feature flags
- **getJsonFlag()**: Evaluate JSON object feature flags
- **resolveClientFeatureFlagsForUser()**: Batch-evaluate all client-facing flags for a user

## Special Flag Handling

### DEV_TOOLBOX

- Automatically determined by user role
- ADMIN users automatically get access
- No external flag evaluation needed

### REQUIRE_SUBSCRIPTION

- Pulled from application configuration
- Controlled via environment variables
- Bypasses external flag providers

### USE_JOBS

- Configuration-based flag
- Determines background job system usage
- Environment-specific setting

## Backend Providers

### Production

- Connects to PostHog for dynamic flag management
- Supports local evaluation for performance
- Real-time flag updates

### Development

- Falls back to in-memory flag definitions
- Predefined flag values for local testing
- No external service dependency

## Integration

The module integrates with:

- **NestJS**: Dependency injection and module system
- **PostHog**: Production feature flag provider
- **Configuration**: System-level flag values
- **Users Controller**: Includes flags in current user endpoint

## Client Integration

The frontend receives personalized flag settings when fetching the current user information:

- Enables client-side feature gates
- Supports experimentation tracking
- Allows dynamic feature rollout

## Use Cases

- A/B testing new features
- Gradual feature rollout
- User segment targeting
- Development vs. production differences
- Emergency feature kill switches
- Beta feature access control

## Configuration

Flags can be configured through:

- PostHog dashboard (production)
- Environment variables (system flags)
- Application configuration service
- In-memory definitions (development)
