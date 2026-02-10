# Client-Specific Rules

## UI Component System

**CRITICAL**: Before writing ANY UI code, you MUST read the UI system documentation.

📚 **UI System Guide**: `src/app/components/UI_SYSTEM.md`
🎨 **Visual Gallery**: http://localhost:3000/dev/gallery (`src/app/dev/gallery/page.tsx`)

## State management

- Server-side entities are stored in the SWR cache. They **must** not be cached anywhere else.
- UI state that is small and local is stored in a useState() within the component that is using it.
- UI state that is larger or used in multiple components, or requires reconcililation with other state is stored in a
  zustand store for that feature, in src/stores

# Analytics and Tracking

The client users Posthog to track user activites.

- Done through the trackXXX() function defined in the `src/lib/posthog.ts` file
- All events have an event name that should be defined in the PostHogEvents enum
- Events have a properties (aka context) object of key-value pairs that provide some details about the event
- Event contexts should track the IDs of entities being modifed or any values involved in a decsion
- Prioritize tracking events in hooks when possible, falling back to JSX elements when necessary
- DO NOT include user data, api keys, authorization keys or tokens in event context data
- DO NOT use the captureEvent() function directly, instead create new track() functions to encapsulate the scenario

## What to track

- User interactions that create, update or delete entities
- User interactions that start workflows
- User interactions that trigger asynchronous processes on the servers like push, pull and sync
