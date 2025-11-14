FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    sudo \
    ubuntu-standard \
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