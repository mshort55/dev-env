FROM node:20-alpine

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
