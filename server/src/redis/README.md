# Redis Module

## Overview

The Redis module provides pub/sub (publish/subscribe) messaging infrastructure for the application, enabling real-time event distribution across different components.

## Purpose

This module abstracts the complexity of Redis communication, providing a clean observable-based API for real-time event streaming and inter-service communication.

## Key Components

### RedisPubSubService

Built as a NestJS module that exports a single service using the IORedis library.

**Architecture:**

- Maintains two separate Redis connections:
  - One for publishing messages
  - One for subscribing to channels
- Implements observable-based API with RxJS integration
- Automatic JSON serialization/deserialization

## Features

### Lazy Channel Subscription

- Only subscribes to Redis channels when observers exist
- Optimizes Redis connection usage
- Reduces overhead for unused channels

### Observable Integration

- Seamless RxJS integration
- Type-safe event streaming
- Proper cleanup when subscriptions end

### Automatic Serialization

- JSON encoding of published messages
- JSON decoding of received messages
- Type-safe message handling

## Primary Use Case

### Snapshot Event Service

The Snapshot module uses Redis pub/sub to implement real-time event notifications:

**SnapshotEventService wraps RedisPubSubService to provide:**

- Snapshot update notifications
- Record change events
- Suggested changes
- Accepted changes
- Rejected changes

This enables real-time updates to connected clients about snapshot modifications and data synchronization progress.

## Event-Driven Architecture

The module serves as a critical communication backbone:

- **Decouples Components**: Services don't need direct dependencies
- **Enables Real-time**: Push updates to clients instantly
- **Scales Horizontally**: Multiple server instances can communicate
- **Event Distribution**: One publisher, many subscribers

## Integration

Integrated throughout the application for:

- Real-time snapshot updates
- Job cancellation signals
- Cross-instance communication
- WebSocket event distribution

## Configuration

Requires Redis connection configuration:

- Host
- Port
- Password (if required)
- SSL settings

Loaded from `ScratchpadConfigService`.

## Channels

The service supports multiple channels for different event types:

- Snapshot updates
- Record changes
- System events
- Job control signals

## Error Handling

Handles Redis-specific errors:

- Connection failures
- Network issues
- Subscription errors
- Message parsing errors

## Cleanup

Proper resource management:

- Unsubscribes from channels when not needed
- Closes Redis connections gracefully
- Prevents memory leaks

## Benefits

- **Real-time Communication**: Instant event propagation
- **Horizontal Scaling**: Multiple instances coordination
- **Loose Coupling**: Services remain independent
- **Event Sourcing**: Maintains event history
- **Performance**: Efficient pub/sub mechanism

## Use Cases

- Real-time snapshot updates to UI
- Job cancellation across workers
- Multi-instance coordination
- Live collaboration features
- System-wide notifications
- Cache invalidation
- Event streaming
