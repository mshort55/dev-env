FROM ubuntu:24.04@sha256:e96e81f410a9f9cae717e6cdd88cc2a499700ff0bb5061876ad24377fcc517d7

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    # Install single packages
    curl \
    git \
    gnupg \
    net-tools \
    podman \
    sudo \
    ubuntu-standard \
    vim \
    # Install gcloud CLI
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-cli \
    # Install OpenShift client (oc and kubectl)
    && curl -L https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux-arm64-4.20.1.tar.gz -o /tmp/openshift-client.tar.gz \
    && tar -xzf /tmp/openshift-client.tar.gz -C /tmp \
    && mv /tmp/oc /usr/local/bin/oc \
    && mv /tmp/kubectl /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/oc /usr/local/bin/kubectl \
    && rm -f /tmp/openshift-client.tar.gz /tmp/README.md \
    # Cleanup
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -u 501 mjs && \
    echo "mjs ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER mjs

WORKDIR /UbuntuSync

CMD ["/bin/bash"]