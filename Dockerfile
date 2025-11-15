FROM ubuntu:24.04@sha256:e96e81f410a9f9cae717e6cdd88cc2a499700ff0bb5061876ad24377fcc517d7

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    gnupg \
    podman \
    sudo \
    ubuntu-standard \
    vim \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -u 501 mjs && \
    echo "mjs ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER mjs

WORKDIR /UbuntuSync

CMD ["/bin/bash"]