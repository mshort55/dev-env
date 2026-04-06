# Node 24 on Alpine 3.23 (arm64v8)
# docker manifest inspect --verbose node:24-alpine
# org.opencontainers.image.created: 2026-03-26T05:35:33Z
FROM node@sha256:3cb200bfcdbde6e13f7c9306d7f50fa2489dc8d85d9a162a131dffc0b1fe429f

ARG BEADS_VERSION
ARG BUF_VERSION
ARG CONTAINER_USER
ARG CONTAINER_UID
ARG DOLT_VERSION
ARG GASTOWN_DIR_NAME
ARG GASTOWN_VERSION
ARG GH_VERSION
ARG GO_VERSION
ARG GOPLS_VERSION

ENV PYTHONDONTWRITEBYTECODE=1 \
    CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
    PATH="$HOME/.local/bin:/usr/local/go/bin:/usr/local/lib/google-cloud-sdk/bin:$PATH" \
    ENV=/home/${CONTAINER_USER}/.ashrc

# Base system packages
RUN apk add --no-cache \
    bash \
    curl \
    git \
    jq \
    make \
    python3 \
    py3-pip \
    sqlite \
    tini \
    tmux

COPY requirements.txt /tmp/requirements.txt

# Software installations
RUN \
    # go
    curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-arm64.tar.gz | tar -xz -C /usr/local && \
    # gcloud
    curl -fSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-arm.tar.gz -o /tmp/gcloud.tar.gz && \
    mkdir -p /usr/local/lib && \
    tar -xzf /tmp/gcloud.tar.gz -C /usr/local/lib && \
    rm -rf /usr/local/lib/google-cloud-sdk/bin/bq \
           /usr/local/lib/google-cloud-sdk/bin/gsutil \
           /usr/local/lib/google-cloud-sdk/bin/anthos \
           /usr/local/lib/google-cloud-sdk/platform/gsutil \
           /usr/local/lib/google-cloud-sdk/platform/bq && \
    # buf
    curl -fsSL "https://github.com/bufbuild/buf/releases/download/v${BUF_VERSION}/buf-Linux-aarch64.tar.gz" | tar -xz -C /usr/local --strip-components 1 && \
    # dolt
    curl -fsSL "https://github.com/dolthub/dolt/releases/download/v${DOLT_VERSION}/dolt-linux-arm64.tar.gz" | tar -xz -C /usr/local --strip-components 1 && \
    # gastown (gt) - must use 'make build' (go install produces unsigned binary rejected on macOS)
    git clone --depth 1 --branch v${GASTOWN_VERSION} https://github.com/steveyegge/gastown.git /tmp/gastown && \
    cd /tmp/gastown && make build && cp gt /usr/local/bin/gt && cd / && \
    # gh (github cli)
    curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_arm64.tar.gz" | tar -xz -C /usr/local --strip-components 1 && \
    # beads (bd)
    GOBIN=/usr/local/bin go install github.com/steveyegge/beads/cmd/bd@v${BEADS_VERSION} && \
    # claude code
    curl -fsSL https://claude.ai/install.sh | bash && \
    mv /root/.local/share/claude /usr/local/share/claude && \
    ln -s /usr/local/share/claude/versions/$(ls /usr/local/share/claude/versions | head -n 1) /usr/local/bin/claude && \
    # gopls (for claude code)
    GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@v"${GOPLS_VERSION}" && \
    # python deps (keepass/crypto)
    pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    # cleanup
    apk del py3-pip && \
    rm -rf /tmp/* /root/.cache /root/.config /root/go

RUN adduser -u ${CONTAINER_UID} -s /bin/bash -D ${CONTAINER_USER}

WORKDIR /opt/${GASTOWN_DIR_NAME}

USER ${CONTAINER_USER}

ENTRYPOINT ["/sbin/tini", "--"]
