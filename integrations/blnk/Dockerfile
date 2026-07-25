# syntax=docker/dockerfile:1.7
FROM golang:1.25.1-bookworm AS build
WORKDIR /src
COPY .workloads/blnk/go.mod .workloads/blnk/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY .workloads/blnk/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/blnk ./cmd/*.go

FROM debian:bookworm-slim
ARG BLNK_REVISION
LABEL org.opencontainers.image.title="GreenLight Blnk workload" \
      org.opencontainers.image.source="https://github.com/blnkfinance/blnk" \
      org.opencontainers.image.version="v0.15.1" \
      org.opencontainers.image.revision="${BLNK_REVISION}" \
      org.opencontainers.image.licenses="Apache-2.0"
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 blnk \
    && useradd --system --uid 10001 --gid blnk --home-dir /nonexistent --shell /usr/sbin/nologin blnk
COPY --from=build --chown=10001:10001 /out/blnk /usr/local/bin/blnk
USER 10001:10001
WORKDIR /app
EXPOSE 5001 5004
ENTRYPOINT ["/usr/local/bin/blnk"]
CMD ["start"]
