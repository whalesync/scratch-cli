# Overview

This document just tracks the general tech debt that will need to be addressed in this project as we move from prototyping into product so we don't forget about the little things. This is a place where you can elaborate a bit when a `//todo` comment doesn't get the job done

### Cross-Project Issues

**API Consistency**

- Duplicated API client code between MCP and Client projects
- Pydantic server code is copy-managed and ported
- Need true monorepo solution for shared code

**Configuration Management**

- Hardcoded localhost URLs throughout codebase
- Missing environment variable validation
- Inconsistent configuration patterns across subprojects

**Documentation**

- Missing comprehensive error handling documentation
- Incomplete API documentation
- Missing performance optimization guidelines

**Testing**

- Missing comprehensive test coverage
- No performance testing infrastructure
- Missing integration tests between subprojects

### Client Issues

**Authentication & Authorization**

- Missing user authentication in API calls - users.ts and connector-accounts.ts have TODO comments about needing auth from middleware
- Temporary JWT token refresh solution in auth context needs proper Clerk integration
- Hardcoded localhost URLs in config.ts should use environment variables

**UI/UX Issues**

- Missing "I am feeling lucky" functionality in AI connector builder
- Theme spacing variables not properly defined in design system
- Records field moved to different entity - temporarily showing no icons in table grid
- Debug components and modals scattered throughout UI components

**Code Quality**

- Debugger statement left in api-import.ts
- Excessive console.debug statements throughout components
- Hook and context could be merged in snapshot-event-context.tsx

### Server Issues

**Authentication & Security**

- API tokens lack scope-based permissions - all tokens are all-access passes
- User entity has deprecated apiToken field that needs scope-specific token replacement
- Missing proper user verification on data entities

**AI Integration**

- Gemini 2.5 Flash model needs update once in GA
- Custom connector TODO comment from Ivan needs fixing
- Notion connector has eslint disable comment that needs removal

**Data Management**

- Record filtering moved to different entity - temporarily allowing all operations
- Snapshot update DTO handling incomplete
- Target key for field injection hardcoded as '@@' - needs to be configurable
- Column ID canonicalization doesn't check for uniqueness

**Accept/Reject does not handle data types**

- the accept tool fails when you are dealing with non-string data types
- the raw SQL does not take into account the underlying data type in the postgres table

**Error Handling**

- Inconsistent error handling patterns throughout services
- Missing proper error management system - everything uses exceptions
- Debug endpoint in snapshot controller should be moved to debug controller

**Performance & Architecture**

- Background snapshot downloading needs proper implementation
- Missing proper logging system (should use Winston)
- Hardcoded project ID and location in AI service

### Python AI Agent Issues

**Data Processing**

- Read/write focus not properly applied to records in multiple places
- Field name translation to actual field IDs incomplete
- Suggested fields handling needs improvement

**Code Quality / DevX**

- Missing Python linter and formatter setup
- Missing type checker configuration
- Debug print statements throughout codebase

**Session Management**

- No session security for AI agent from client
- Missing user session management for authentication
- Session management should move to DB or Redis

**Authentication / Security**

- need some kind of user session management to authenticate incoming requests and websockets
- API endpoint to Scratchpad with separate auth that can verify an API token in a session
- There is no session security to the Pydantic AI agent from the client
- Anyone can connect and start poking at our system

### MCP Issues

**Code Quality**

- Test files contain console.log statements
- Missing proper error handling in some handlers
