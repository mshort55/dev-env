# Node 24 on Alpine 3.23 (arm64v8)
# docker manifest inspect --verbose node:24-alpine
# org.opencontainers.image.created: 2026-03-26T05:35:33Z
FROM node@sha256:3cb200bfcdbde6e13f7c9306d7f50fa2489dc8d85d9a162a131dffc0b1fe429f

ARG CONTAINER_USER
ARG CONTAINER_UID
ARG RUFLO_DIR_NAME

WORKDIR /opt/${RUFLO_DIR_NAME}

RUN adduser -u ${CONTAINER_UID} -D ${CONTAINER_USER}

USER ${CONTAINER_USER}

COPY --chown=${CONTAINER_USER}:${CONTAINER_USER} --chmod=755 post-create.sh /usr/local/bin/ruflo-post-create.sh
