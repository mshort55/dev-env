# Ubuntu 24.04 LTS
# docker inspect ubuntu:24.04 --format='{{.Created}}'
# 2026-04-10T06:56:54.752442228Z
FROM ubuntu@sha256:c4a8d5503dfb2a3eb8ab5f807da5bc69a85730fb49b5cfca2330194ebcc41c7b

ARG ATUIN_VERSION
ARG BUF_VERSION
ARG CONTAINER_UID
ARG CONTAINER_USER
ARG GINKGO_VERSION
ARG GOPLS_VERSION
ARG GO_VERSION
ARG GRPCURL_VERSION
ARG HCP_VERSION
ARG JQ_VERSION
ARG KIND_VERSION
ARG KUSTOMIZE_VERSION
ARG NODE_VERSION
ARG OPENSHIFT_VERSION
ARG PODMAN_VERSION
ARG RUST_VERSION
ARG YQ_VERSION
ARG ZELLIJ_VERSION

ARG WORKSPACE_DIR_NAME

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    PATH="/usr/local/go/bin:$HOME/.local/bin:$PATH"

# Base system package installations, package upgrades.
# HTTP to ports.ubuntu.com:80 times out on some networks; the base image has no
# CA store, so bootstrap ca-certificates over HTTPS with verify disabled once,
# then continue with normal verified apt.
RUN sed -i 's|http://ports.ubuntu.com|https://ports.ubuntu.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
    apt-get -o Acquire::https::Verify-Peer=false -o Acquire::https::Verify-Host=false update && \
    apt-get -o Acquire::https::Verify-Peer=false -o Acquire::https::Verify-Host=false install -y --no-install-recommends ca-certificates && \
    apt-get update && \
    apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade && \
    apt-get install -y --no-install-recommends \
    apache2-utils \
    bash-completion \
    bubblewrap \
    build-essential \
    curl \
    dbus-x11 \
    gettext \
    git \
    gnome-keyring \
    gnupg \
    iputils-ping \
    less \
    locales \
    make \
    nano \
    net-tools \
    openssh-client \
    poppler-utils \
    python3-pip \
    python3-venv \
    sqlite3 \
    sudo \
    tree \
    ubuntu-standard \
    unzip \
    vim \
    xxd && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt

# Other software installations
RUN \
    # go
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-arm64.tar.gz" | tar -xz -C /usr/local && \
    # node.js
    # curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz" | tar -xJ --strip-components=1 -C /usr/local && \
    # gcloud-cli
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && apt-get install -y google-cloud-cli && \
    # gh-cli
    mkdir -p -m 755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y gh && \
    # task
    curl -1sLf 'https://dl.cloudsmith.io/public/task/task/setup.deb.sh' | bash && \
    apt-get update && apt-get install -y task && \
    # oc & kubectl
    curl -fsSL "https://mirror.openshift.com/pub/openshift-v4/clients/ocp/${OPENSHIFT_VERSION}/openshift-client-linux-arm64.tar.gz" | tar -xz -C /usr/local/bin oc kubectl && \
    # yq
    curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_arm64.tar.gz" | tar -xz --transform='s/yq_linux_arm64/yq/' -C /usr/local/bin ./yq_linux_arm64 && \
    # jq
    curl -fsSL "https://github.com/jqlang/jq/releases/download/jq-1.8.2/jq-linux-arm64" -o /usr/local/bin/jq && \
    # kind
    curl -fsSL "https://kind.sigs.k8s.io/dl/v${KIND_VERSION}/kind-linux-arm64" -o /usr/local/bin/kind && \
    # kustomize
    curl -fsSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${KUSTOMIZE_VERSION}/kustomize_v${KUSTOMIZE_VERSION}_linux_arm64.tar.gz" | tar -xz -C /usr/local/bin kustomize && \
    # hcp-cli
    # curl -fsSL "https://developers.redhat.com/content-gateway/file/pub/mce/clients/hcp-cli/${HCP_VERSION}/hcp-cli-${HCP_VERSION}-linux-arm64.tar.gz" | tar -xz -C /usr/local/bin && \
    # grpcurl
    curl -fsSL "https://github.com/fullstorydev/grpcurl/releases/download/v${GRPCURL_VERSION}/grpcurl_${GRPCURL_VERSION}_linux_arm64.tar.gz" | tar -xz --no-same-owner -C /usr/local/bin grpcurl && \
    # podman (remote client only — routes to host podman via mounted socket)
    curl -fsSL "https://github.com/containers/podman/releases/download/v${PODMAN_VERSION}/podman-remote-static-linux_arm64.tar.gz" | tar -xz --strip-components=1 -C /usr/local/bin bin/podman-remote-static-linux_arm64 && \
    mv /usr/local/bin/podman-remote-static-linux_arm64 /usr/local/bin/podman && \
    # buf
    curl -fsSL "https://github.com/bufbuild/buf/releases/download/v${BUF_VERSION}/buf-Linux-aarch64.tar.gz" | tar -xz -C /usr/local --strip-components 1 && \
    # aws-cli
    curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip -o awscliv2.zip && \
    unzip -q awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws && \
    # aws sam cli
    # curl -fsSL https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-arm64.zip -o awssamcli.zip && \
    # unzip awssamcli.zip -d sam-installation && \
    # sudo ./sam-installation/install && \
    # atuin
    curl -fsSL "https://github.com/atuinsh/atuin/releases/download/v${ATUIN_VERSION}/atuin-aarch64-unknown-linux-gnu.tar.gz" | tar -xz -C /usr/local/bin --strip-components=1 && \
    # zellij
    curl -fsSL "https://github.com/zellij-org/zellij/releases/download/v${ZELLIJ_VERSION}/zellij-no-web-aarch64-unknown-linux-musl.tar.gz" | tar -xz -C /usr/local/bin && \
    # python deps (keepass/crypto)
    pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt && \
    # finalize and clean up
    chmod +x /usr/local/bin/kind /usr/local/bin/jq && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

RUN useradd -m -s /bin/bash -u ${CONTAINER_UID} ${CONTAINER_USER} && \
    echo "${CONTAINER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${CONTAINER_USER}

ENV PATH="/home/${CONTAINER_USER}/.cargo/bin:$PATH"

# User level software
RUN \
    # rust
    # curl -fsSL https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION} && \
    # claude code
    curl -fsSL https://claude.ai/install.sh | bash && \
    # cursor agent cli
    curl https://cursor.com/install -fsS | bash && \
    # openai codex cli
    curl -fsSL https://chatgpt.com/codex/install.sh | sh && \
    # ginkgo
    go install "github.com/onsi/ginkgo/v2/ginkgo@v${GINKGO_VERSION}" && \
    # gopls (for claude code)
    go install "golang.org/x/tools/gopls@v${GOPLS_VERSION}"

WORKDIR /${WORKSPACE_DIR_NAME}

CMD ["/bin/bash"]