# Multi-stage Dockerfile for scratch-git microservice
# Build from scratch-git directory: docker build -t scratch-git .

# Stage 1: Install dependencies and build
FROM node:22.22.0-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:22.22.0-alpine AS runner

# Install dumb-init for proper signal handling, and git for git-http-backend
RUN apk add --no-cache dumb-init git

WORKDIR /app

# Copy compiled output and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Create the default repos directory
RUN mkdir -p /app/repos

# Environment variables (supplied at runtime, these are defaults)
ENV PORT=3100
ENV GIT_BACKEND_PORT=3101
ENV GIT_REPOS_DIR=/app/repos

EXPOSE 3100 3101

# Start both the API and HTTP backend services
CMD ["dumb-init", "sh", "-c", "node dist/git-scratch-api.js & node dist/git-http-backend.js & wait"]
