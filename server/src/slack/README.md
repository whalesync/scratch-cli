# Slack Module

## Overview

The Slack module is a lightweight notification service that integrates with Slack to send developer alerts for important application events.

## Purpose

This module provides a simple mechanism for the development team to receive real-time notifications about significant user actions and system events directly in their Slack channel.

## Key Components

### SlackNotificationService

Core service that:
- Sends messages to Slack webhook URL
- Uses configuration from `ScratchpadConfigService`
- Checks if notifications are enabled
- Handles errors gracefully with 2-second timeout

### SlackFormatters

Utility class providing formatting functions:
- **formatMarkdownLink()**: Format standard markdown links in Slack syntax
- **newUserSignup()**: Format new user signup notification messages

## Message Format

Currently sends simple text messages in Slack markdown format, with a note for future upgrade to Slack Block Kit for richer formatting.

## Integration

### UsersService
Sends notifications when new users sign up:
- Formats user information
- Posts to developer channel
- Tracks user onboarding

### StripePaymentService
Injected for potential payment-related notifications (not currently actively used).

## Configuration

Requires environment configuration:
- Slack webhook URL
- Enable/disable flag
- Notification preferences

Loaded from `ScratchpadConfigService`.

## Error Handling

Graceful error handling ensures:
- Notification failures don't impact application
- 2-second timeout prevents hanging
- Logs errors for debugging
- No user-facing impact

## HTTP Communication

Uses HTTP POST requests to Slack webhook API:
- Standard Slack message format
- Simple JSON payload
- Webhook authentication

## Use Cases

- New user registration alerts
- System event notifications
- Error monitoring
- Important state changes
- Developer awareness
- Team coordination

## Future Enhancements

The code includes notes for upgrading to Slack Block Kit, which would enable:
- Richer message formatting
- Interactive elements
- Better visual hierarchy
- Action buttons
- More structured data

## Benefits

- **Team Awareness**: Real-time notifications
- **Simple Integration**: Webhook-based, no complex setup
- **Lightweight**: Minimal overhead
- **Reliable**: Graceful degradation
- **Flexible**: Easy to add new notification types

## Message Types

Currently supports:
- User signup notifications

Easily extensible to add:
- Payment events
- Error alerts
- System health
- Usage milestones
- Security events

## Security

- Webhook URL kept in environment variables
- No sensitive data in notifications
- Controlled access to Slack channel
- Configuration-based enable/disable
