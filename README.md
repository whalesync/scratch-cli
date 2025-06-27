# Project Structure

The Scratchpad consists of 3 elements:

### 1. MCP Server (`/mcp`)

- Model Context Protocol server that bridges Cursor with our API service
- Built with TypeScript and MCP SDK
- Key files:
  - `mcp/src/index.ts`: Main MCP server implementation

### 2. API Server (`/server`)

- NestJS application serving as the main backend
- Provides scratchpad data functionality via REST API
- Modelled after the Whalesync Bottlenose server

### 3. Data Studio Client (`/client`)

- The Data studio tool
- Next.js / React
- Thin client that mainly interacts with the server
- Runs locally on port 3000

# Testing with Cursor

1. Run server:

```bash
cd server
yarn install
yarn migrate # Only if there are DB migrations pending
yarn run start:dev
```

2. Run client:

```bash
cd client
yarn install
yarn run dev
```

3. Build the mcp server:

```bash
cd mcp
yarn install
yarn run build
```

4. 'Install' MCP server

- Go to Cursor -> Settings -> Cursor Settings -> Tools & Integrations
- Under MCP Tools click on Add Custom MCP button
- Add the following config:

```
{
  "mcpServers": {
    "spinner-mcp": {
      "command": "node",
      "args": [
        "{path to repo}/mcp/dist/bin/stdio.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "SCRATCHPAD_SERVER_URL": "http://localhost:3010",
        "SCRATCHPAD_API_TOKEN": "<Your API Token from Scratchpad>"

      }
    }
  }
}
```

By default the MCP server uses the localhost Scratchpad server. If you want to use the deployed version you can change the `SCRATCHPAD_SERVER_URL` to the following:

```
  "SCRATCHPAD_SERVER_URL": "https://scratchpad-server.onrender.com",
```

You can have multiple instances of the MCP server configured, each using a different set of ENV variables

- Restart Cursor. Go back to the same config. You should see a green dot next to the server name and the tools should be listed (at the time of writing: get_records and update_record)

When the MCP server changes:

1. `cd mcp & yarn run build`
