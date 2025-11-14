FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    keepassxc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /work

CMD ["/bin/zsh"]