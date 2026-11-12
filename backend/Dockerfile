# syntax=docker/dockerfile:1
# One image, two processes: `node server.js` (API, the default) or
# `node worker.js` (background workers). The final stage is the production
# image; `dev` is only built by docker-compose.override.yml for hot reload.

# Node 26 (Active LTS) on Alpine, pinned by digest. Dependabot bumps it.
ARG NODE_IMAGE=node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94

FROM ${NODE_IMAGE} AS base
WORKDIR /app
# tini reaps zombies and forwards SIGTERM to node, so graceful shutdown works
# on hosts that don't offer `--init` (Render, Railway, Fly).
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

FROM base AS prod-deps
COPY package.json package-lock.json ./
# No dependency needs an install script (only fsevents, a macOS dev dependency).
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS dev
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force
COPY . .
RUN mkdir -p private-verification-storage && chown node:node private-verification-storage
USER node
EXPOSE 5000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "nodemon", "--legacy-watch", "server.js"]

FROM base AS runtime
# The app never runs npm at runtime: drop it (and its bundled dependencies,
# a common source of scanner findings) from the final image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# Code and dependencies stay root-owned and read-only to the app user; only
# the verification upload directory is writable (mount a volume there).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p private-verification-storage && chown node:node private-verification-storage
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD ["node", "scripts/healthcheck.js"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
