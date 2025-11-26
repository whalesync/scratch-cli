# Cron Module

## Overview

The cron module provides scheduled task execution capabilities for the Scratchpad application using NestJS's `@nestjs/schedule` library.

## Purpose

This module manages and runs recurring background jobs on a schedule. It is conditionally loaded based on the microservice type—only activating when deployed as a dedicated cron service or as a monolith for local development.

## Current Services

### ExampleCronService

A demonstration service that shows the pattern for creating scheduled tasks. It runs daily at midnight and logs a verification message.

## Architecture

The module is designed to be extensible:

1. Create new injectable services decorated with `@Cron` decorator
2. Register them in the CronModule's providers array
3. Define schedule using cron expressions

## Conditional Loading

The CronModule is only loaded when `ScratchpadConfigService.isCronService()` returns true, which occurs when the `SERVICE_TYPE` environment variable is set to:

- `"cron"`: Dedicated cron service
- `"monolith"`: Combined service for local development

This design allows the same binary to run different microservice configurations in production, with dedicated cron instances handling background jobs separately from API and worker services.

## Integration

The module integrates with the broader application through conditional import in `app.module.ts`. When active, it runs alongside other services to handle time-based automation tasks.

## Adding New Cron Jobs

To add a new scheduled task:

1. Create a new service in this directory
2. Decorate methods with `@Cron(expression)` or `@Interval(ms)`
3. Add the service to CronModule's providers
4. The service will automatically execute on schedule

## Use Cases

- Data cleanup tasks
- Scheduled reports
- Periodic synchronization
- Maintenance operations
- Monitoring and health checks
