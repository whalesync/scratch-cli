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

- yarn
- Node.js
- Git installed and in PATH

### Environment Variables

Copy `sample.env` to `.env` file in the root:

```env
PORT=3100                 # Port for RPC API
GIT_BACKEND_PORT=3101     # Port for Git HTTP Server
GIT_REPOS_DIR=repos       # Absolute or relative path to storage directory
```

### Running the Services

The services are designed to run independently.

**Start the RPC API:**

```bash
yarn run dev:api
```

**Start the Git HTTP Backend:**

```bash
yarn run dev:http-backend
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

## Git Client Usage

To clone a repository hosted on this service:

```bash
git clone http://localhost:3101/my-project.git
```

## Deployment

Docker images are built automatically by the GitLab CI/CD pipeline and pushed to Artifact Registry as `spinner-scratch-git:latest`.

The scratch-git service runs on a GCE instance (Debian 12) managed by Terraform in `terraform/modules/scratch_git_gce/`. It is deployed to **Test** (`spv1eu-test`) and **Production** (`spv1eu-production`) in the EU region.

### Deploy via gcloud

To update the running container without a full Terraform apply, SSH into the instance and re-run the startup script. This pulls the latest image and restarts the container.

**Test:**

```bash
gcloud compute ssh scratch-git \
  --project spv1eu-test \
  --zone europe-west1-b \
  --tunnel-through-iap \
  -- 'sudo google_metadata_script_runner startup'
```

**Production:**

```bash
gcloud compute ssh scratch-git \
  --project spv1eu-production \
  --zone europe-west1-b \
  --tunnel-through-iap \
  -- 'sudo google_metadata_script_runner startup'
```

Alternatively, SSH in and interact with the instance directly:

```bash
gcloud compute ssh scratch-git \
  --project spv1eu-test \
  --zone europe-west1-b \
  --tunnel-through-iap
```

#### Docker commands

When you SSH in via `gcloud` it will login as your service account which is unable to use `docker` commands directly,
so you need to sudo any docker command.

# View running containers

```bash
sudo docker ps
```

# View logs

```bash
sudo docker logs scratch-git
```

# Follow logs in real-time

```bash
sudo docker logs -f scratch-git
```

# Open a shell inside the container

```bash
sudo docker exec -it scratch-git /bin/sh
```

# Restart the container

```bash
sudo docker restart scratch-git
```

# Check container resource usage

```bash
sudo docker stats scratch-git
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

## DevOps Playbook

### Resizing the ScratchGit Persistent Data Disk

The persistent disk can be expanded online without data loss or downtime. GCP only supports **increasing** disk size, never decreasing.

**1. Update the Terraform variable**

Pass `disk_size_gb` to the `scratch_git_gce` module in `terraform/modules/env/main.tf`, or update the default in `terraform/modules/scratch_git_gce/variables.tf`. For example, to increase from 50 GB to 100 GB:

```hcl
module "scratch_git_gce" {
  # ...existing config...
  disk_size_gb = 100
}
```

**2. Plan and apply**

```bash
terraform plan   # Verify it shows "update in-place", NOT "must be replaced"
terraform apply
```

**3. Expand the filesystem on the VM**

GCP resizes the block device automatically, but the ext4 filesystem still sees the old size. SSH into the instance and run:

```bash
# SSH into the instance
gcloud compute ssh scratch-git \
  --project <PROJECT_ID> \
  --zone europe-west1-b \
  --tunnel-through-iap

# Verify the OS sees the new disk size
sudo lsblk

# Resize the ext4 filesystem (online, no unmount needed)
sudo resize2fs /dev/disk/by-id/google-data-disk

# Verify the filesystem reflects the new size
sudo df -h /mnt/disks/data
```

The `resize2fs` command is non-destructive and runs online — no need to stop the container or unmount the disk.
