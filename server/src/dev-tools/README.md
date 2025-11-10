# Dev Tools Module

## Overview

The dev-tools module is an administrative utility feature that provides specialized endpoints for internal development and support purposes.

## Purpose

This module offers comprehensive administrative tools for developers and support staff to search for users, inspect user data, and aggregate information across multiple services for troubleshooting and support.

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard` and require `hasAdminToolsPermission()` authorization (ADMIN role only):

### `GET /dev-tools/users/search?query=<string>`
Search for users in the system by query string.

Returns basic user information matching the search criteria.

### `GET /dev-tools/users/:id/details`
Retrieve comprehensive administrative details about a specific user.

Returns a `UserDetail` object containing:
- **User Info**: Basic user account information
- **Workbooks**: All snapshots owned by the user with table counts
- **Integrations**: Connected connectors with service types
- **Audit History**: Latest 20 audit log events for the user

## Architecture

The module orchestrates calls across multiple services:
- **UsersService**: User account information
- **PaymentService**: Subscription data
- **SnapshotService**: Workbook/snapshot data
- **ConnectorAccountService**: Integration connections
- **AuditLogService**: Activity history
- **UploadsService**: File upload information

## Authorization

Access is restricted to administrators only through:
1. `ScratchpadAuthGuard`: Ensures user is authenticated
2. `hasAdminToolsPermission()`: Checks for ADMIN role

## Integration

The module is mounted as a standard NestJS module in the application's main `AppModule`, making it available throughout the application's lifecycle.

## Use Cases

- User support and troubleshooting
- Account investigation
- Data verification
- Usage analysis
- Security audits
- Customer service inquiries

## Security Considerations

- Highly sensitive information access
- Requires administrator privileges
- Full audit trail of user activities
- Should be used responsibly and logged
