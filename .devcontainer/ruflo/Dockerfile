# Node 24 on Alpine 3.23 (arm64v8)
# docker manifest inspect --verbose node:24-alpine
# org.opencontainers.image.created: 2026-03-26T05:35:33Z
FROM node@sha256:3cb200bfcdbde6e13f7c9306d7f50fa2489dc8d85d9a162a131dffc0b1fe429f

ARG RUFLO_VERSION="3.5.48"

WORKDIR /app

# Install with exact version pin and no install scripts for security
RUN npm install --ignore-scripts "@claude-flow/cli@${RUFLO_VERSION}" && \
    npm audit --omit=dev && \
    rm -rf /root/.npm /tmp/*

# Run as non-root
RUN adduser -D -u 1001 ruflo && \
    chown -R ruflo:ruflo /app

USER ruflo
EXPOSE 3000

CMD ["npx", "claude-flow", "mcp", "start", "-t", "http", "-p", "3000"]
