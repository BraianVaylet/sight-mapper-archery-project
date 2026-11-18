# The PWA in production (TECNICO §12): built with the monorepo, served by Caddy with the security
# headers and the SPA fallback of apps/pwa/Caddyfile. Build context: the repository root.

FROM node:22-alpine AS build
# Railway passes service variables as build arguments only when they are declared. The version comes
# from the root package.json; these two say which commit and whether it is production (RF-X-03).
ARG VITE_API_URL
ARG RAILWAY_GIT_COMMIT_SHA
ARG RAILWAY_ENVIRONMENT_NAME
ENV VITE_API_URL=$VITE_API_URL RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA RAILWAY_ENVIRONMENT_NAME=$RAILWAY_ENVIRONMENT_NAME
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@sight-mapper/pwa...

FROM caddy:2-alpine
COPY apps/pwa/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/pwa/dist /srv
