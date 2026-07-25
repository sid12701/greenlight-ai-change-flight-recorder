# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build --workspace @greenlight/shared \
 && npm run build --workspace @greenlight/api \
 && npm ci --omit=dev \
      --workspace @greenlight/api \
      --workspace @greenlight/shared \
      --ignore-scripts \
 && mkdir -p /app/data

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:af85d11ce7ef10172855a6e3649e3e8125b1b9e3ca41849ec2918036f05cb212 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=65532:65532 /app/package.json /app/package-lock.json ./
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=65532:65532 /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=65532:65532 /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=65532:65532 /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=65532:65532 /app/data ./data
USER 65532
CMD ["apps/api/dist/worker.js"]
