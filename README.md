To test with Cursor

1. Run server: `cd server & yarn install & yarn run start:dev`
2. Run client: `cd client & yarn run dev`
2. Build the mcp server: `cd mcp & yarn install & yarn run build`
3. 'Install' mcp server
- Go to Cursor -> Settings -> Cursor Settings -> Tools & Integrations
- Under MCP Tools click on Add Custom MCP button
- Add the following config: 
```
{
  "mcpServers": {
    "spinner-mcp": {
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

By default the MCP server uses the localhost Scratchpad server.  If you want to use the deployed version you can add the following environment variables to the configuration above:

```
  "SCRATCHPAD_SERVER_URL": "https://scratchpad-server.onrender.com",
  "SCRATCHPAD_API_TOKEN": "1234567890"
```

The API token is a placeholder for how we might do auth inside Scratchpad


- Restart Cursor. Go back to the same config. You should see a green dot next to the server name and the tools should be listed (at the time of writing: get_records and update_record)


When the MCP server changes:
1. `cd mcp & yarn run build`