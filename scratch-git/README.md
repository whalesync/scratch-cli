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

- Node.js (v18+)
- Git installed and in PATH
- Persistent storage directory (e.g., standard SSD on a VM)

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
npx ts-node main.ts
```

**Start the Git HTTP Backend:**

```bash
npx ts-node http-backend.ts
```

## API Reference

### Create Repository

**POST** `/api/repo/create`

```json
{
  "repoId": "my-project"
}
```

### Stateless Commit

**POST** `/api/exec/commit`

```json
{
  "repoId": "my-project",
  "message": "Initial commit",
  "files": [
    {
      "path": "README.md",
      "content": "# Hello World"
    }
  ]
}
```

_Note: Pass `content: null` to delete a file._

### Read File

**GET** `/api/exec/read?repoId=my-project&path=README.md&ref=main`

## Git Client Usage

To clone a repository hosted on this service:

```bash
git clone http://<host>:3101/my-project.git
```

### Create Dirty Branch

**POST** `/api/branch/dirty`

Creates a user-specific branch (`dirty/<userId>`) from `main` to track draft changes.

```json
{
  "repoId": "my-project",
  "userId": "user-123"
}
```

## Backup Feature (Temporary)

As an experimental feature, the Spinner UI allows backing up a workbook directly to a git repository managed by this service.

1.  **Initialization**: Repositories are auto-created as **bare** repositories upon the first backup request.
    - _Note_: We strictly use `bare: true` with explicit `gitdir` to prevent nested `.git` directories and ensure compatibility with standard git clients.
2.  **Commit**: The backup action triggers a stateless commit that writes all workbook files directly to the `main` branch.
3.  **Cloning**: You can clone the backed-up repository using the HTTP backend:

```bash
git clone http://localhost:3101/<workbookId>.git
```

## Deployment Notes

- **Google Cloud Compute Engine**: Recommended deployment target.
  - **Machine**: e2-small (2 vCPU, 2GB RAM) is sufficient for start.
  - **Storage**: Zonal Persistent Disk (Standard or Balanced).
    - Can be resized online (increased size) without downtime.
    - Mount the disk to the directory specified in `GIT_REPOS_DIR`.
