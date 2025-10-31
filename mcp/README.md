# MCP Search Tools Server

A simple Model Context Protocol (MCP) server built with TypeScript that provides access to the Scratch API:

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Build the project:

```bash
yarn build
```

3. Run the server for testing:

```bash
yarn start
```

For development with hot reload:

```bash
yarn run dev
```

## Packaging the Server

The output in the `dist` folder is fine for local development but it a pain to give to other people. One shortcut is to use Vercel's NCC tool to build a single JS file that can run through node.

### Add NCC as a local tool

```bash
npm install -g @vercel/ncc
```

### NCC Build

```bash
ncc build src/bin/stdio.ts -o dist/ncc
```

This will build just the Stdio MCP server used by Cursor and output it in a `dist/ncc` folder

The bundled file will be output to `dist/ncc` and be called `index.js`

### Configure Cursor

You can then distribute the `index.js` file and setup the MCP server in cursor like normal, pointing just to that file.

The user will need Node.js installed locally in order to run it.

### Setup MCP Server:

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
        "SCRATCHPAD_API_TOKEN": "<Your API Token from Scratch>"

      }
    }
  }
}
```

By default the MCP server uses the localhost Scratch server. If you want to use the deployed version you can change the `SCRATCHPAD_SERVER_URL` to the following:

```
  "SCRATCHPAD_SERVER_URL": "https://scratchpad-server.onrender.com",
```

You can have multiple instances of the MCP server configured, each using a different set of ENV variables

- Restart Cursor. Go back to the same config. You should see a green dot next to the server name and the tools should be listed (at the time of writing: get_records and update_record)

When the MCP server changes:

1. `cd mcp & yarn run build`
