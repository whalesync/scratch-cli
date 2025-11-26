# OAuth Redirect Proxy for Local Development Overview

## Problem

When developing locally, OAuth connectors that only allow one valid redirect URI (like Webflow) create a problem:

- If you configure the redirect URI to point to localhost, the production/test server can't use it
- If you configure it to point to the test server, local development can't use it

## Solution

The OAuth redirect proxy allows OAuth providers to redirect to a test server, which then proxies the callback back to localhost during local development.

### How It Works

```
┌─────────────┐     1. Initiate OAuth      ┌────────────────┐
│  Localhost  │ ─────────────────────────> │ OAuth Provider │
│  :3000      │                            │  (e.g. Webflow)│
└─────────────┘                            └────────────────┘
       ▲                                           │
       │                                           │ 2. User authorizes
       │                                           │
       │                                           ▼
       │                                    ┌──────────────┐
       │  4. Redirect to localhost          │ Test Server  │
       │     with OAuth params              │              │
       └────────────────────────────────────│ callback-    │
                                            │ proxy page   │
                                            └──────────────┘
                                                   ▲
                                                   │
                                            3. Callback with
                                               code & state
```

### Flow Details

1. **OAuth Initiation** (on localhost):
   - User clicks "Connect with Webflow"
   - Client reads that it's on `http://localhost:3000` and saves that as part of the `redirectPrefix`
   - Client asks the server for the authorization URL for the provider to redirect to
   - Server puts the `redirectPrefix` in the `state` param
   - State is base64-encoded
   - Backend constructs OAuth URL and returns it
   - User is redirected to OAuth provider

2. **OAuth Authorization**:
   - User authorizes the app on the OAuth provider's website
   - OAuth provider redirects to: `https://test.scratch.md/oauth/callback?code=ABC123&state=eyJ...`

3. **Callback Proxy** (on test server):
   - Test server's `/oauth/callback` page loads
   - It decodes the `state` parameter to get: `{ redirectPrefix: 'http://localhost:3000' }`
   - In constructs the `localhost` URL to redirect to, `http://localhost:3000/oauth/callback-step-2?code=ABC123&state=eyJ...`
   - It redirects the browser

4. **Final Callback** (back on localhost):
   - Localhost's `/oauth/callback-step-2?` page loads
   - It extracts the `code` and `state` parameters
   - It calls the backend API to exchange the code for tokens
   - OAuth flow completes successfully
