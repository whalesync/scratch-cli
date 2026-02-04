# PostHog Module

## Overview

The PostHog module is an analytics integration service that captures user behavior and product usage events throughout the application.

## Purpose

This module wraps the PostHog analytics library to enable event tracking while gracefully handling scenarios where PostHog is not configured or disabled. It provides product teams with detailed usage analytics.

## Key Components

### PostHogService

Injectable NestJS service that:

- Initializes based on configuration (API key and host)
- Provides specialized tracking methods
- Gracefully degrades when disabled
- Implements proper cleanup on shutdown

## Core Tracking Methods

### User Lifecycle

- **captureUserCreated**: Track new user registration

### Snapshot Events

- **captureSnapshotCreated**: New snapshot creation with table counts
- **captureSnapshotPublished**: Snapshot publishing events
- **captureSnapshotDeleted**: Snapshot deletion tracking

### Resource Management

- **captureStyleGuideCreated**: Style guide creation
- **captureStyleGuideDeleted**: Style guide deletion

### Subscription Events

- **captureTrialStarted**: Track trial subscription commencement

## Event Enrichment

Each tracking method automatically enriches events with contextual properties:

- Snapshot/Resource IDs
- Connector types
- Table counts
- Service names
- User context
- Timestamps

## Graceful Degradation

The service handles:

- **Disabled PostHog**: Returns early without sending events
- **Missing Configuration**: Skips initialization
- **API Failures**: Comprehensive error handling
- **No Impact on Core Features**: Analytics failures don't affect application functionality

## Integration

Integrated into application via AppModule, making it available for dependency injection across the codebase.

### Primary Consumers

- **UsersService**: User lifecycle events
- **SnapshotService**: Snapshot operations
- **PaymentService**: Subscription events
- **StyleGuideService**: Resource management

## Configuration

Requires environment configuration:

- PostHog API key
- PostHog host URL
- Enable/disable flag

Loaded from `ScratchpadConfigService`.

## Lifecycle Management

Implements NestJS lifecycle hooks:

- **onModuleInit**: Initialize PostHog client
- **onModuleDestroy**: Flush and shutdown gracefully

## Benefits

- **Product Analytics**: Understand feature usage
- **User Behavior**: Track user journeys
- **Feature Adoption**: Measure new feature uptake
- **Conversion Tracking**: Monitor trial-to-paid conversion
- **Usage Patterns**: Identify power users and patterns
- **Retention**: Track user engagement over time

## Error Handling

Comprehensive error handling prevents analytics failures from impacting core application functionality:

- API timeouts
- Network issues
- Invalid events
- Configuration errors

## Privacy Considerations

Event tracking respects:

- User privacy settings
- Data minimization
- Contextual information only
- No sensitive data in events

## Use Cases

- Feature flag targeting
- A/B test analysis
- User segmentation
- Product metrics
- Growth analytics
- Churn analysis
- Feature prioritization
