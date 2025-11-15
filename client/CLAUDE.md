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
