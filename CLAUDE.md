# Claude Code Project Rules

## Project Structure

This is a monorepo with three main components:

- **`/client`** - Next.js/React/Mantine Data Studio (port 3000) - Has specific UI system rules
- **`/server`** - NestJS API server (port 3010) - See README.md files
- **`/pydantic-ai-agent`** - FastAPI AI agent server (port 8000) - See README.md files

## Subdirectory-Specific Rules

Each component has its own CLAUDE.md with instructions specific to the project.

## Package Manager

**IMPORTANT**: This project uses **`yarn`** as the package manager, NOT `npm`.

- Always use `yarn` for installing dependencies (e.g., `yarn add`, `yarn install`)
- Always use `yarn` for running scripts (e.g., `yarn build`, `yarn dev`)
- Never use `npm install` or `npm` commands

## NVM

When running commands that depend on Node, first run `nvm use` in whichever directory you're working in (e.g.
server/, client/). You DON'T need to source `~/.nvm/nvm.sh`.

## NestJS DTOs in "server/"

For NestJS DTOs, we use the pattern:

- `class` definitions with 'class-validator' decorators for validation
- All properties are optional (in TypeScript, "?") to pass strict build rules
- A corresponding `Validated...` type where required fields are declared as required, using `Required<>` and `Pick<>`
