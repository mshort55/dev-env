# Node 24 on Alpine 3.23 (arm64v8)
# docker manifest inspect --verbose node:24-alpine
# org.opencontainers.image.created: 2026-03-26T05:35:33Z
FROM node@sha256:3cb200bfcdbde6e13f7c9306d7f50fa2489dc8d85d9a162a131dffc0b1fe429f

ARG CONTAINER_USER
ARG CONTAINER_UID
ARG RUFLO_DIR_NAME

RUN apk add --no-cache \
    git \
    python3

COPY requirements.txt /tmp/requirements.txt
RUN apk add --no-cache curl bash py3-pip && \
    # gcloud
    curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=/usr/local/lib && \
    ln -s /usr/local/lib/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud && \
    # claude code
    curl -fsSL https://claude.ai/install.sh | bash && \
    # pykeepass
    pip3 install --no-cache-dir -r /tmp/requirements.txt && \
    # cleanup
    apk del curl bash py3-pip && \
    rm -rf /tmp/*

RUN adduser -u ${CONTAINER_UID} -D ${CONTAINER_USER}

WORKDIR /opt/${RUFLO_DIR_NAME}

USER ${CONTAINER_USER}
