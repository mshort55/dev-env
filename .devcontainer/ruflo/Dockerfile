# Node 24 on Alpine 3.23 (arm64v8)
# docker manifest inspect --verbose node:24-alpine
# org.opencontainers.image.created: 2026-03-26T05:35:33Z
FROM node@sha256:3cb200bfcdbde6e13f7c9306d7f50fa2489dc8d85d9a162a131dffc0b1fe429f

ARG CONTAINER_USER
ARG CONTAINER_UID
ARG RUFLO_DIR_NAME

RUN adduser -u ${CONTAINER_UID} -D ${CONTAINER_USER}

ENV PYTHONDONTWRITEBYTECODE=1 \
    CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
    PATH=$PATH:/usr/local/lib/google-cloud-sdk/bin \
    ENV=/home/${CONTAINER_USER}/.ashrc

COPY requirements.txt /tmp/requirements.txt

RUN apk add --no-cache \
    git \
    python3 \
    py3-pip \
    curl \
    bash && \
    # gcloud
    curl -fSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-arm.tar.gz -o /tmp/gcloud.tar.gz && \
    mkdir -p /usr/local/lib && \
    tar -xzf /tmp/gcloud.tar.gz -C /usr/local/lib && \
    # remove unwanted gcloud components
    rm -rf /usr/local/lib/google-cloud-sdk/bin/bq \
           /usr/local/lib/google-cloud-sdk/bin/gsutil \
           /usr/local/lib/google-cloud-sdk/bin/anthos \
           /usr/local/lib/google-cloud-sdk/platform/gsutil \
           /usr/local/lib/google-cloud-sdk/platform/bq && \
    # claude code
    curl -fsSL https://claude.ai/install.sh | bash && \
    mv /root/.local/share/claude /usr/local/share/claude && \
    ln -s /usr/local/share/claude/versions/$(ls /usr/local/share/claude/versions | head -n 1) /usr/local/bin/claude && \
    # python deps
    pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    # cleanup
    apk del curl bash py3-pip && \
    rm -rf /tmp/* /root/.cache /root/.config

WORKDIR /opt/${RUFLO_DIR_NAME}

USER ${CONTAINER_USER}
