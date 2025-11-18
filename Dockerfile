# Ubuntu 24.04 LTS - Digest updated: 2025-11-17
FROM ubuntu:24.04@sha256:e96e81f410a9f9cae717e6cdd88cc2a499700ff0bb5061876ad24377fcc517d7

ARG IMAGE_VERSION="1.0.0"
ARG YQ_VERSION="4.48.2"
ARG OPENSHIFT_VERSION="4.20.1"
ARG DEV_USER="mjs"
# This UID needs to match the mac UID else volume mounts have permissions issues
ARG DEV_UID="501"
ARG WORKSPACE_DIR="/UbuntuSync"

ENV DEBIAN_FRONTEND=noninteractive

# Base system packages install
RUN apt-get update && apt-get install -y \
    curl \
    git \
    gnupg \
    locales \
    net-tools \
    podman \
    sudo \
    ubuntu-standard \
    vim \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# gcloud CLI install
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# oc & kubectl install
RUN curl -L https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux-arm64-${OPENSHIFT_VERSION}.tar.gz -o /tmp/openshift-client.tar.gz \
    && tar -xzf /tmp/openshift-client.tar.gz -C /tmp \
    && mv /tmp/oc /usr/local/bin/oc \
    && mv /tmp/kubectl /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/oc /usr/local/bin/kubectl \
    && rm -f /tmp/openshift-client.tar.gz /tmp/README.md

# yq install
RUN curl -L https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_arm64.tar.gz -o /tmp/yq.tar.gz \
    && tar -xzf /tmp/yq.tar.gz -C /tmp \
    && mv /tmp/yq_linux_arm64 /usr/local/bin/yq \
    && chmod +x /usr/local/bin/yq \
    && rm -f /tmp/yq.tar.gz

RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8

RUN useradd -m -s /bin/bash -u ${DEV_UID} ${DEV_USER} && \
    echo "${DEV_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${DEV_USER}

WORKDIR ${WORKSPACE_DIR}

CMD ["/bin/bash"]