# syntax=docker/dockerfile:1
# The production build served by nginx, for local parity with the compose
# stack. Vercel remains the production frontend host. With no
# REACT_APP_API_URL the app calls /api on its own origin, which nginx proxies
# to the API service.

ARG NODE_IMAGE=node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The only install script is fsevents (macOS). esbuild ships its binary as an
# optional dependency, so the build doesn't need scripts either.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM ${NGINX_IMAGE} AS runtime
# Rendered to /etc/nginx/conf.d/default.conf at start, filling ${API_UPSTREAM}.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html
ENV API_UPSTREAM=http://api:5000
EXPOSE 8080
