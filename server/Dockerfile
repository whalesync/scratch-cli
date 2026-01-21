FROM node:22.22.0-alpine AS deps

WORKDIR /app
COPY ./package.json ./yarn.lock /app/

RUN yarn install --frozen-lockfile --ignore-scripts

FROM node:22.22.0-alpine AS builder

ARG BUILD_VERSION=0.0.0-local

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY ./src/ /app/src
COPY ./prisma/ /app/prisma
COPY ./nest-cli.json ./package.json ./tsconfig.build.json ./tsconfig.json /app/

RUN sed -i "s/0.0.0-local/${BUILD_VERSION}/g" /app/src/version.ts && \
    yarn run prisma generate && yarn run build

FROM node:22.22.0-alpine AS runner

## https://engineeringblog.yelp.com/2016/01/dumb-init-an-init-for-docker.html
RUN apk add --no-cache dumb-init curl

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules

# Set up environment variables.
# These platform-specific vars are passed in from the CI/CD builder.
# Service and env-specific type vars (production/staging/test, frontend/data/jobqueue) are supplied at runtime.
ENV RUNNING_IN_CLOUD=false
ENV PORT=8080

# These should be passed in as env vars, not built into the image
ENV NODE_ENV=test
ENV APP_ENV=test

EXPOSE 8080

CMD [ "dumb-init", "node", "dist/main" ]
