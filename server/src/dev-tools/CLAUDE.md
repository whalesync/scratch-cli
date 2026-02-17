This module is for admin and developer tools and is designed to segregated from other services.

- All controller endpoints MUST pass through the ScratchAuthGuard
- All controller endpoints MUST verify that the active user has admin permissions
- NEVER make any other module should depend on dev-tools
  - dev-tools should be able to consume any other service without generating circular dependencies
