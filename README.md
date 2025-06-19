To test with Cursor

1. Run server: `cd server & yarn run start:dev`
2. Run client: `cd client & yarn run dev`
3. 'Install' mcp server
- Go to Cursor -> Settings -> Cursor Settings -> MCP Tools -> New MCP Server
- Add the following config: 
```
{
  "mcpServers": {
    "search-tools": {
      "command": "node",
      "args": [
        "{path to repo}/mcp/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```