# Health Module

## Overview

The health module provides basic system health and metadata endpoints for the Scratch API. It serves as a lightweight, foundational component for deployment monitoring, load balancer health checks, and CI/CD pipeline verification.

## Purpose

This module exposes two essential HTTP endpoints that provide server information and health status, ensuring the API server is running and serving traffic correctly. These endpoints are critical for infrastructure monitoring, Kubernetes liveness probes, and external monitoring systems.

## Endpoints

### `GET /`

Returns server information including:

- Application name: "Scratch API"
- Build version

### `GET /health`

Returns a detailed health status response including:

- Timestamp
- Service name
- Build version

## Architecture

The module consists of a single controller (`HealthController`) with no service layer or database interactions, making it highly performant and reliable. This design ensures these critical endpoints remain available and responsive even during high system load or when other services experience issues.

## Integration

The HealthModule is imported early in the main application module (`app.module.ts`) alongside other core infrastructure modules like `ScratchpadConfigModule`, `PosthogModule`, and `AuditLogModule`. Its placement at the top level of the application hierarchy indicates its critical role in system initialization and monitoring.
