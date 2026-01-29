# Scratch Git Microservice

A specialized microservice that provides a persistent Git storage layer for Scratch. It decouples the application logic from file storage, allowing the main Scratch API to remain stateless while this service manages repository data on a persistent filesystem.

## Architecture

The service consists of two distinct HTTP servers running as separate processes:

### 1. RPC API Server (Port 3100)

- **Entry Point**: `main.ts`
- **Purpose**: Handles programmatic file operations from the main Scratch application (Lambda/Serverless).
- **Features**:
  - **Repository Creation**: Initialize new bare repositories.
  - **Stateless Commit**: Executes a "Clone (depth=1) -> Checkout -> Edit -> Commit -> Push" workflow in a temporary directory. This allows the API to make commits without maintaining a persistent working directory for every user.
  - **Fast Read**: Reads file content directly from the bare repository (O(1) lookup).
- **Technology**: Node.js, Express, `isomorphic-git` (for logic), `git` binary (for heavy lifting).

### 2. Git HTTP Backend Server (Port 3101)

- **Entry Point**: `http-backend.ts`
- **Purpose**: Serves standard Git traffic (Clone, Pull, Push) for users' local git clients.
- **Features**:
  - Acts as a **CGI Gateway** for the standard `git http-backend` binary.
  - Intercepts CGI headers and streams binary git data directly to/from the client.
  - Fully compatible with standard `git` CLI.

## Usage

### Prerequisites

- Node.js
- Git installed and in PATH

### Environment Variables

Create a `.env` file in the root:

```env
PORT=3100                 # Port for RPC API
GIT_BACKEND_PORT=3101     # Port for Git HTTP Server
GIT_REPOS_DIR=repos       # Absolute or relative path to storage directory
```

### Running the Services

The services are designed to run independently.

**Start the RPC API:**

```bash
npx ts-node git-scratch-api.ts
```

**Start the Git HTTP Backend:**

```bash
npx ts-node git-http-backend.ts
```

## Git Client Usage

To clone a repository hosted on this service:

```bash
git clone http://localhost:3101/my-project.git
```
