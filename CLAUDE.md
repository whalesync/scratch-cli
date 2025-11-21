# Claude Code Project Rules

## Project Structure

This is a monorepo with three main components:

- **`/client`** - Next.js/React/Mantine Data Studio (port 3000) - Has specific UI system rules
- **`/server`** - NestJS API server (port 3010) - See README.md files
- **`/pydantic-ai-agent`** - FastAPI AI agent server (port 8000) - See README.md files

## Subdirectory-Specific Rules

Each component has its own CLAUDE.md with instructions specific to the project.

## NVM

When running commands that depend on Node, first run `nvm use` in whichever directory you're working in (e.g.
server/, client/). You DON'T need to source `~/.nvm/nvm.sh`.
