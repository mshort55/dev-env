FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    sudo \
    ubuntu-standard \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -u 501 mjs && \
    echo "mjs ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER mjs

RUN git config --global user.email "mshort@redhat.com" && \
    git config --global user.name "Matthew Short" && \
    git config --global user.signingkey "5FC5E8CEE3AC461D" && \
    git config --global commit.gpgsign true && \
    git config --global tag.gpgsign true

WORKDIR /UbuntuSync

CMD ["/bin/bash"]