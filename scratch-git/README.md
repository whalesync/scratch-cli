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

- npm
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
npm run dev:api
```

**Start the Git HTTP Backend:**

```bash
npm run dev:http-backend
```

## Docker

### Build the image

```bash
docker build -t scratch-git .
```

### Run the container

```bash
docker run -p 3100:3100 -p 3101:3101 scratch-git
```

Override environment variables and mount a persistent volume for repository storage:

```bash
docker run -p 3100:3100 -p 3101:3101 \
  -e GIT_REPOS_DIR=/data/repos \
  -v /host/path/repos:/data/repos \
  scratch-git
```

## Deployment

Docker images are built automatically by the GitLab CI/CD pipeline and pushed to Artifact Registry as `spinner-scratch-git:latest`.

The scratch-git service runs on a GCE instance (Container-Optimized OS) managed by Terraform in `terraform/modules/scratch_git_gce/`. It is deployed to both **Test** (`spv1-test`) and **Production** (`spv1-production`) environments.

### Option 1: Deploy via Terraform

Terraform apply will recreate the instance with the latest startup script, which pulls and runs the newest image. If necessary you can provide just a -target option if you don't want to run the full apply

**Test:**

```bash
cd terraform/envs/test
terraform apply
```

**Production:**

```bash
cd terraform/envs/production
terraform apply
```

### Option 2: Deploy via gcloud (without Terraform)

To update the running container without a full Terraform apply, SSH into the instance and re-run the startup script. This pulls the latest image and restarts the container.

**Test:**

```bash
gcloud compute ssh scratch-git \
  --project spv1-test \
  --zone us-central1-c \
  --tunnel-through-iap \
  -- 'sudo google_metadata_script_runner startup'
```

**Production:**

```bash
gcloud compute ssh scratch-git \
  --project spv1-production \
  --zone us-central1-c \
  --tunnel-through-iap \
  -- 'sudo google_metadata_script_runner startup'
```

Alternatively, SSH in and manually pull and restart:

```bash
gcloud compute ssh scratch-git \
  --project spv1-test \
  --zone us-central1-c \
  --tunnel-through-iap

# On the instance:
export HOME=/var/lib/docker-home
docker pull us-central1-docker.pkg.dev/spv1-test/test-registry/spinner-scratch-git:latest
docker stop scratch-git && docker rm scratch-git
docker run -d \
  --name scratch-git \
  --restart unless-stopped \
  --log-driver=gcplogs \
  -p 3100:3100 \
  -p 3101:3101 \
  -v /mnt/disks/data:/data \
  us-central1-docker.pkg.dev/spv1-test/test-registry/spinner-scratch-git:latest
```

### Accessing the service locally

Use the tunnel script to forward port 3100 to your machine:

```bash
./terraform/tools/connect_to_git_service.sh test
# or
./terraform/tools/connect_to_git_service.sh production
```

The service will be available at `http://127.0.0.1:3100`.

### Viewing logs

Container logs are sent to GCP Cloud Logging. Filter by label in the Logs Explorer:

```
labels.service="scratch-git"
```

## Git Client Usage

To clone a repository hosted on this service:

```bash
git clone http://localhost:3101/my-project.git
```
