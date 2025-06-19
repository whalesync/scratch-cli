# MCP Search Tools Server

A simple Model Context Protocol (MCP) server built with TypeScript that provides two search tools:
- `google_search`: Simulates Google search functionality
- `bing_search`: Simulates Bing search functionality

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run the server:
```bash
npm start
```

For development with hot reload:
```bash
npm run dev
```

## Usage

This MCP server provides two tools that can be called by MCP clients:

### Google Search Tool
- **Name**: `google_search`
- **Description**: Perform a Google search and return results
- **Parameters**: 
  - `query` (string, required): The search query to execute

### Bing Search Tool
- **Name**: `bing_search`
- **Description**: Perform a Bing search and return results
- **Parameters**:
  - `query` (string, required): The search query to execute

## Customization

The current implementation returns simulated results. To integrate with actual search APIs:

1. Replace the simulated logic in `src/index.ts` with actual API calls
2. Add appropriate API keys and configuration
3. Update the response format to match your API's response structure

## MCP Configuration

To use this server with an MCP client, add it to your MCP configuration:

```json
{
  "mcpServers": {
    "search-tools": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/dist/index.js"]
    }
  }
}
``` 