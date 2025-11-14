FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    keepassxc \
    sudo \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash mjs && \
    echo "mjs ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER mjs
WORKDIR /mjs

CMD ["/bin/bash"]