# Payment Module

## Overview

The payment module is a NestJS-based Stripe integration service that handles subscription billing and payment management for the Scratchpad application.

## Purpose

This module encapsulates all payment processing logic within a dedicated domain module, managing the complete subscription lifecycle including customer creation, subscription initiation, checkout, and state synchronization.

## Endpoints

### `POST /payment/portal`
**Auth Required**: Yes (`ScratchpadAuthGuard`)

Creates a Stripe Billing Portal URL for authenticated users to manage existing subscriptions.

**Use Case**: Allow users to update payment methods, view invoices, cancel subscriptions.

### `POST /payment/checkout/:productType`
**Auth Required**: Yes (`ScratchpadAuthGuard`)

Generates a checkout session URL for initiating new subscriptions with a specific plan type.

**Parameters:**
- `productType`: The subscription plan to purchase

**Features:**
- Tax collection configuration
- Payment requirement settings
- Return URL handling

### `POST /payment/webhook`
**Auth Required**: No (Stripe signature verification)

Receives and processes Stripe webhook events.

**Security**: Validates requests through Stripe's cryptographic signature verification.

**Handled Events:**
- Checkout session completion
- Subscription updates
- Invoice payments
- Payment failures

## Core Service

### StripePaymentService

Provides primary business logic using Stripe API (version 2025-08-27.basil):

- **Customer Management**: Creates and manages Stripe customer IDs
- **Subscription Creation**: Handles trial and paid subscriptions
- **Checkout Generation**: Creates hosted checkout sessions
- **Webhook Processing**: Syncs subscription state from Stripe to database
- **State Synchronization**: Keeps local database in sync with Stripe

## Subscription Plans

### STARTER_PLAN
- Configured per environment
- Different Stripe IDs for test, staging, and production
- Enables safe sandbox development
- Production payment separation

## Trial Management

- **Default Trial**: 7 days
- **PostHog Integration**: Tracks trial start events
- **Automatic Conversion**: Trials convert to paid subscriptions

## Integration

The module integrates with:
- **Configuration**: Stripe credentials and settings
- **Database**: Subscription persistence via Prisma
- **PostHog**: Analytics for subscription events
- **Slack**: Notifications for important events

## Metadata Filtering

Subscription validation uses metadata:
- Filters for Scratchpad-specific subscriptions
- Prevents cross-contamination in shared Stripe accounts
- Enables multi-tenant support

## Webhook Event Handling

Processes multiple event types:
- `checkout.session.completed`: New subscription creation
- `customer.subscription.updated`: Subscription changes
- `invoice.payment_succeeded`: Successful payments
- `invoice.payment_failed`: Failed payments

## Security

- Webhook signature verification
- Customer validation
- Metadata verification
- Secure credential management

## Error Handling

Comprehensive error handling for:
- Stripe API errors
- Invalid webhook signatures
- Database synchronization issues
- Network failures

## Use Cases

- User subscription management
- Payment collection
- Trial period handling
- Subscription upgrades/downgrades
- Invoice generation
- Payment failure recovery
- Churn prevention
