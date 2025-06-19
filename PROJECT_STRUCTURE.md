# Project Structure

This project consists of three main components:

## 1. MCP Server (`/mcp`)
- Model Context Protocol server that bridges Cursor with our search service
- Implements Google and Bing search tools
- Built with TypeScript and MCP SDK
- Key files:
  - `mcp/src/index.ts`: Main MCP server implementation
  - `mcp/src/api-examples.ts`: Examples for real API integration

## 2. Backend Server (`/server`)
- NestJS application serving as the main backend
- Provides search functionality via REST API
- Key components:
  - Search Module (`src/search/search.module.ts`)
  - Search Controller (`src/search/search.controller.ts`)
- API Endpoints:
  - GET `/search?q=query`: Performs a search operation
  - More endpoints to be added...

## 3. Frontend Client (to be implemented)
- Will be built with Next.js
- Will provide a user interface for search functionality
- Planned features:
  - Search interface
  - Results display
  - Advanced search options

## Development Setup

1. MCP Server:
```bash
cd mcp
yarn install
yarn build
yarn start
```

2. Backend Server:
```bash
cd server
yarn install
yarn start:dev
```

## Testing the Search API

Test the search endpoint:
```bash
curl "http://localhost:3000/search?q=test"
```

## Project Status
- ✅ MCP Server: Basic implementation complete
- ✅ Backend Server: Basic search endpoint implemented
- ⏳ Frontend Client: Not started
- ⏳ Real API Integration: Not started 