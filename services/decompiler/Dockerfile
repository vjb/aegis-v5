FROM rust:1.85-bookworm AS builder

# Pre-install everything bifrost would try to install via sudo
RUN apt-get update && \
    apt-get install -y build-essential libssl-dev pkg-config curl && \
    rm -rf /var/lib/apt/lists/*

# Sudo shim — bifrost calls "sudo apt-get" but we're already root in Docker
RUN echo '#!/bin/sh\nexec "$@"' > /usr/local/bin/sudo && chmod +x /usr/local/bin/sudo

# Install bifrost
RUN curl -L http://get.heimdall.rs | bash

# Install Heimdall via bifrost with prebuilt binary flag
RUN $HOME/.bifrost/bin/bifrost -B

# Use same Debian base as builder (bookworm) to match glibc version
# Then install Node.js manually
FROM debian:trixie-slim

# Install runtime deps: Node.js + libssl3
RUN apt-get update && \
    apt-get install -y curl libssl3t64 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy the heimdall binary from builder
COPY --from=builder /root/.bifrost/bin/heimdall /usr/local/bin/heimdall

# Verify heimdall works
RUN heimdall --version

WORKDIR /app
COPY package.json server.js ./
RUN npm install --production

EXPOSE 8080
CMD ["node", "server.js"]
