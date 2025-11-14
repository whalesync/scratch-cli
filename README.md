# Project Structure

The Scratch project consists of 3 elements:

## 1. API Server (`/server`)

- NestJS application serving as the main backend
- Provides data functionality via REST API
- Modelled after the Whalesync Bottlenose server
- Runs locally on port 3010

Full [Documentation](/server/README.md)

## 2. Data Studio Client (`/client`)

- The Data studio tool
- Next.js / React / Mantine
- Thin client that mainly interacts with the server
- Runs locally on port 3000

Full [Documentation](/client/README.md)

**Client-Specific Rules**: See [`client/.clauderules`](/client/.clauderules) for mandatory UI coding standards

### UI Component System

The client uses a standardized UI component library built on Mantine. **All developers and AI agents must follow the UI system guidelines** to maintain design consistency.

- 📚 **[UI System Guide](/client/src/app/components/UI_SYSTEM.md)** - Complete documentation for AI agents and developers
- 🎨 **Component Gallery** - Visual reference at http://localhost:3000/dev/gallery

**Key Rules:**
- Use base components from `@/components/base/` instead of raw Mantine components
- Use semantic CSS variables for colors (`var(--fg-primary)`, `var(--bg-base)`)
- Always wrap Lucide icons with `StyledLucideIcon`
- Never use inline styles or hardcoded colors

## 3. Pydantic AI Agent (`/pydantic-ai-agent`)

- The agent server that powers Scratch chat
- Interfaces with the LLMs through OpenRouter and provides a set of data tools for the LLMs to invoke
- FastAPI, Pydantic & Pydantic AI
- Runs locally on port 8000

Full [Documentation](/pydantic-ai-agent/README.md)

# Deployments

The client, server and agent are all automatically deployed to GCP from the `prod` branch.

A scheduled pipeline in Gitlab triggers the deployment by merging the current state of `master` into `prod`. The deployment happens ever day at 9:30 am PST, but can also be triggered manually.

[Gitlab Pipeline Schedules](https://gitlab.com/whalesync/spinner/-/pipeline_schedules)

## Manual Deployments

To manually trigger a new deployment, you must have **Maintainer** permissions on the repository. Then you need to do a merge from `master` to `prod` and push changes. First make sure your `master` and `prod` branches are up to date, then from the `prod` branch create a merge with the comment included below.

```bash
git checkout master
git pull
git checkout prod
git pull origin prod
git merge -m "(Auto) Merge branch 'master' into prod" --no-ff -X theirs master
git push origin prod
git checkout master
```

Once done, make sure to leave the `prod` branch immediately to avoid accidently branching from it or pushing new changes. The `prod` branch **must** always be equal or behind the `master` branch.

# MCP Server (`/mcp`) - DEPRECATED

- Model Context Protocol server that bridges Cursor with our API service
- Built with TypeScript and MCP SDK
- Key files:
  - `mcp/src/index.ts`: Main MCP server implementation
- Is now out of date and just used for reference - to be replaced by a Pydantic AI MCP host at some point
