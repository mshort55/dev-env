# Default to TypeScript on Node.js for repository-owned automation

Use TypeScript on Node.js by default when adding or extending automation maintained by dev-env. This gives container setup, CI, and verification a shared runtime and toolchain. Contributors running verification on the host need Node.js and npm.

Bash hooks can load completions and export values into the current shell. Third-party tools can use their own runtimes, including Python.
