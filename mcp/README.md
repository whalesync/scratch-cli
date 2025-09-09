# MCP Search Tools Server

A simple Model Context Protocol (MCP) server built with TypeScript that provides access to the Scratchpaper API:

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
