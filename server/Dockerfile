FROM node:22.20.0-alpine

RUN apk --no-cache add curl

## https://engineeringblog.yelp.com/2016/01/dumb-init-an-init-for-docker.html
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY ./package.json /app/
COPY ./yarn.lock /app/
COPY ./prisma /app/prisma

RUN yarn install --immutable

COPY ./dist /app/dist

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
