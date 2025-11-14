Host setup:
1. Install Podman desktop
2. Setup podman VM
  - might be needed:
  - brew tap slp/krunkit
  - brew install krunkit
3. Increase podman VM resources
  - CPU 8
  - Memory 30GB
  - Disk 480GB
4. Install vscode and dev containers extension
5. Change docker to podman for dev containers
  - vim $HOME/Library/Application\ Support/Code/User/settings.json
  - add: "dev.containers.dockerPath": "podman",
6. Set up compose for podman on desktop app
  - enable Docker Compatability