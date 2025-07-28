# Scratchpad Client

Data Studio Front-end for Scratchpad.

## Install Yarn

If Yarn is not installed on your system, you can install it using Homebrew:

```bash
brew install yarn
```

## Available Yarn Commands

### Install initial dependencies.

```bash
brew yarn install
```

### Run interactively

```bash
yarn run dev
```

### Builds a optimized version for production

```bash
yarn run build
```

### Starts the optimized version built with `yarn run build`

```bash
yarn run start
```

## Environment Variables

Create a `.env.local` file in the root directory by copying `sample.env.local`.

Tweak the following values as necessary:

```
# The URL to the backend server
NEXT_PUBLIC_API_URL=http://localhost:3000

# The URL to the Pydantic agent server
NEXT_PUBLIC_AI_AGENT_API_URL=http://localhost:8000

# The Websocket URL to the Pydantic agent server
NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL=ws://localhost:8000
```

## Hosting

The Scratchpad client is hosted on Vercel and is automatically deployed with every merge into master

[Public URL - https://scratchpad-client.vercel.app/](https://scratchpad-client.vercel.app/)

[Manage Vercel Project](https://vercel.com/whalesync-devs-projects/spinner)

- Owned by team@whalesync.com (Credentials in 1password)

## Stack

### Next.js

Scratchpad is built using [next.js](https://nextjs.org/docs).

### Component Libraries

- Mantine
- Phosphor Icons

### TRPC (TODO)

### SWR (TODO)

Data is fetched and cached with the [SWR](https://swr.vercel.app/docs/data-fetching) library. It handles refetching on
an interval, caching results across calls and between different code locations, and more.
Read the docs!

### Authentication (TODO)

Authentication is managed by Clerk, with only Google SSO enabled, using Clerk's SDK and Next.js components to sign-in. [docs here](https://clerk.com/docs/quickstarts/nextjs). Auth is provided by a combination of the ClerkProvider and the clerk middleware.

Once a user signs in, we check if a Whalesync account exists, and create it if necessary.

## Tips

### React 'Strict Mode'

In development environments, we have [Strict Mode](https://react.dev/reference/react/StrictMode) enabled (configured via next.config.js) to help catch bugs.

Be warned that strict mode changes app behavior relative to the final production build:

- Components will re-render an extra time (to find bugs caused by impure rendering).
- Components will re-run Effects an extra time (to find bugs caused by missing Effect cleanup).
  This can cause effects to run twice before the next render / state update.

If you want to step through code in the debugger, you may find it helpful to temporarily disable Strict Mode so you don't see everything running twice.

### React Developer Tools

Be sure to install the [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?hl=en) to help you locate the code you're looking at, and to profile performance issues.
