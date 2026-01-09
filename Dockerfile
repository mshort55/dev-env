# Ubuntu 24.04 LTS
# docker inspect ubuntu:24.04 --format='{{.Created}}'
# 2025-10-16T19:26:58.895610113Z
FROM ubuntu@sha256:c35e29c9450151419d9448b0fd75374fec4fff364a27f176fb458d472dfc9e54

ARG YQ_VERSION="4.50.1"
ARG OPENSHIFT_VERSION="4.20.8"
ARG KIND_VERSION="0.31.0"
ARG CONTAINER_USER
ARG CONTAINER_UID
ARG WORKSPACE_DIR_NAME

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# Base system packages install
RUN apt-get update && apt-get install -y \
    apache2-utils \
    curl \
    git \
    gnupg \
    iputils-ping \
    locales \
    net-tools \
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
RUN curl -L https://mirror.openshift.com/pub/openshift-v4/clients/ocp/${OPENSHIFT_VERSION}/openshift-client-linux-arm64.tar.gz -o /tmp/openshift-client.tar.gz \
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

# kind install
RUN curl -L https://kind.sigs.k8s.io/dl/v${KIND_VERSION}/kind-linux-arm64 -o /usr/local/bin/kind \
    && chmod +x /usr/local/bin/kind

RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8

RUN useradd -m -s /bin/bash -u ${CONTAINER_UID} ${CONTAINER_USER} && \
    echo "${CONTAINER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${CONTAINER_USER}

WORKDIR /${WORKSPACE_DIR_NAME}

CMD ["/bin/bash"]