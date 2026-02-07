# Multi-stage Dockerfile for scratch-git microservice
# Build from scratch-git directory: docker build -t scratch-git .

# Stage 1: Install dependencies and build
FROM node:22.22.0-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# Stage 2: Production runtime
FROM node:22.22.0-alpine AS runner

# Install dumb-init for proper signal handling, git + git-daemon (provides git-http-backend)
RUN apk add --no-cache dumb-init git git-daemon

WORKDIR /app

# Copy compiled output and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Create the default repos directory
RUN mkdir -p /data/repos

# Build version label
ARG BUILD_VERSION=0.0.0-local
ENV BUILD_VERSION=${BUILD_VERSION}

# Environment variables (supplied at runtime, these are defaults)
ENV PORT=3100
ENV GIT_BACKEND_PORT=3101
ENV GIT_REPOS_DIR=/data/repos
ENV NODE_ENV=production

EXPOSE 3100 3101

# Start both the API and HTTP backend services
CMD ["dumb-init", "sh", "-c", "node dist/git-scratch-api.js & node dist/git-http-backend.js & wait"]
