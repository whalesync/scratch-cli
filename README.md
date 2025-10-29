# Project Structure

The Scratchpaper consists of 3 elements:

## 1. API Server (`/server`)

- NestJS application serving as the main backend
- Provides scratchpaper data functionality via REST API
- Modelled after the Whalesync Bottlenose server
- Runs locally on port 3010

Full [Documentation](/server/README.md)

## 2. Data Studio Client (`/client`)

- The Data studio tool
- Next.js / React / Mantine
- Thin client that mainly interacts with the server
- Runs locally on port 3000

Full [Documentation](/client/README.md)

## 3. Pydantic AI Agent (`/pydantic-ai-agent`)

- The agent server that powers Scratchpaper chat
- Interfaces with the LLMs through OpenRouter and provides a set of data tools for the LLMs to invoke
- FastAPI, Pydantic & Pydantic AI
- Runs locally on port 8000

Full [Documentation](/pydantic-ai-agent/README.md)

# Deployments

The client, server and agent are all automatically deployed to Vercel and Render from the `prod` branch.

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
