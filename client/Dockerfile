# Taken from https://nextjs.org/docs/deployment

# Install dependencies only when needed
FROM node:22.20.0-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# NOTE(ryder): Added this as different from the sample. I think its needed because i'm on an M1?
RUN apk add --no-cache g++ make py3-pip

WORKDIR /app

COPY ./package.json ./yarn.lock /app/

RUN yarn install --immutable

# Rebuild the source code only when needed
FROM node:22.20.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY ./ /app/

# Next.js automatically assigns this in next build, but set it just to be safe
ENV NODE_ENV=production

# Define a flavor we can set at docker build time. 
# Valid values: 'production', 'staging', 'test', 'development'
# A couple weird things here:
# 1. Prefixing it with "NEXT_PUBLIC_" means it will be available in client AND server code (so no secrets).
# 2. NODE_ENV has special meaning in nextjs and can't be overridden to staging.
# 3. Declaring it as an arg lets us provide it with `docker build --build-arg ...`
ARG APP_ENV
ENV NEXT_PUBLIC_APP_ENV ${APP_ENV}

ARG BUILD_VERSION
ENV NEXT_PUBLIC_BUILD_VERSION ${BUILD_VERSION}

ARG CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ${CLERK_PUBLISHABLE_KEY}

ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY ${NEXT_PUBLIC_POSTHOG_KEY}

ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST ${NEXT_PUBLIC_POSTHOG_HOST}

ARG NEXT_PUBLIC_API_URL=http://localhost:3010
ENV NEXT_PUBLIC_API_URL ${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL=ws://localhost:8000
ENV NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL ${NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL}

ARG NEXT_PUBLIC_AI_AGENT_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_AI_AGENT_API_URL ${NEXT_PUBLIC_AI_AGENT_API_URL}

ENV NEXT_PUBLIC_USER_AGENT_CREDENTIALS_REQUIRED true
ENV NEXT_PUBLIC_GA_ID G-GVXSMCZ3JR

RUN yarn build

# Production image, copy all the files and run next
FROM node:22.20.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# You only need to copy next.config.js if you are NOT using the default configuration
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public /app/public
COPY --from=builder /app/package.json /app/package.json

# Automatically leverage output traces to reduce image size 
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone /app/
COPY --from=builder --chown=nextjs:nodejs /app/.next/static /app/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV RUNNING_IN_CLOUD=false
ENV APP_ENV=test

CMD ["node", "server.js"]