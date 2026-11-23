# Ubuntu 24.04 LTS
# Ubuntu 24.04 image checked 2026-10-27.
FROM ubuntu@sha256:24737cef17f4e22b1977df7d9a05e77c4e28b7da5b8911f8d8ccda136bf3573c

ARG ATUIN_VERSION
ARG BUF_VERSION
ARG CONTAINER_UID
ARG CONTAINER_USER
ARG DOCKER_COMPOSE_VERSION
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
ARG RUST_VERSION
ARG UV_VERSION
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
    libasound2t64 \
    libgbm1 \
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
    xz-utils \
    xxd && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY .devcontainer/dev/10-github.conf /etc/ssh/ssh_config.d/10-github.conf
COPY requirements/bootstrap.txt /tmp/bootstrap-requirements.txt

# Install the runtime before invoking repository-owned TypeScript.
RUN curl -fsSL --retry 3 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz --strip-components=1 -C /usr/local && \
    rm /tmp/node.tar.xz && test "$(node --version)" = "v${NODE_VERSION}"

COPY .devcontainer/dev/install-tools.ts /usr/local/lib/dev-env/install-tools.ts
RUN node /usr/local/lib/dev-env/install-tools.ts system
RUN pip3 install --no-cache-dir --break-system-packages --require-hashes -r /tmp/bootstrap-requirements.txt && \
    rm /tmp/bootstrap-requirements.txt

RUN useradd -m -s /bin/bash -u ${CONTAINER_UID} ${CONTAINER_USER} && \
    echo "${CONTAINER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${CONTAINER_USER}

ENV PATH="/home/${CONTAINER_USER}/.cargo/bin:$PATH"

RUN node /usr/local/lib/dev-env/install-tools.ts user

WORKDIR /${WORKSPACE_DIR_NAME}

CMD ["/bin/bash"]
