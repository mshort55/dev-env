# Ubuntu 24.04 LTS
# docker inspect ubuntu:24.04 --format='{{.Created}}'
# 2025-10-16T19:26:58.895610113Z
FROM ubuntu@sha256:c35e29c9450151419d9448b0fd75374fec4fff364a27f176fb458d472dfc9e54

ARG YQ_VERSION="4.50.1"
ARG OPENSHIFT_VERSION="4.20.8"
ARG KIND_VERSION="0.31.0"
ARG HCP_VERSION="2.8.3-13"
ARG CONTAINER_USER
ARG CONTAINER_UID
ARG WORKSPACE_DIR_NAME

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# Base system package installations, package upgrades
RUN apt-get update && \
    apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade && \
    apt-get install -y --no-install-recommends \
    apache2-utils \
    bash-completion \
    ca-certificates \
    curl \
    dbus-x11 \
    gettext \
    git \
    gnupg \
    iputils-ping \
    less \
    locales \
    nano \
    net-tools \
    openssh-client \
    sudo \
    ubuntu-standard \
    unzip \
    vim && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Other software installations
RUN \
    # gcloud-cli
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && apt-get install -y google-cloud-cli && \
    # oc & kubectl
    curl -fsSL https://mirror.openshift.com/pub/openshift-v4/clients/ocp/${OPENSHIFT_VERSION}/openshift-client-linux-arm64.tar.gz | tar -xz -C /usr/local/bin oc kubectl && \
    # yq
    curl -fsSL https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_arm64.tar.gz | tar -xz --transform='s/yq_linux_arm64/yq/' -C /usr/local/bin ./yq_linux_arm64 && \
    # kind
    curl -fsSL https://kind.sigs.k8s.io/dl/v${KIND_VERSION}/kind-linux-arm64 -o /usr/local/bin/kind && \
    # hcp-cli
    curl -fsSL https://developers.redhat.com/content-gateway/file/pub/mce/clients/hcp-cli/${HCP_VERSION}/hcp-cli-${HCP_VERSION}-linux-arm64.tar.gz | tar -xz -C /usr/local/bin && \
    # aws-cli
    curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip -o awscliv2.zip && \
    unzip -q awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws && \
    # finalize and clean up
    chmod +x /usr/local/bin/oc /usr/local/bin/kubectl /usr/local/bin/yq /usr/local/bin/kind /usr/local/bin/hcp && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

RUN useradd -m -s /bin/bash -u ${CONTAINER_UID} ${CONTAINER_USER} && \
    echo "${CONTAINER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${CONTAINER_USER}
WORKDIR /${WORKSPACE_DIR_NAME}

CMD ["/bin/bash"]