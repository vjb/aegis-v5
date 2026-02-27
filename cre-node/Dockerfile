# /cre-node/Dockerfile

# 1. SWITCH to Ubuntu 24.04 (Noble)
# This provides GLIBC 2.39+, which is a strict requirement for the CRE CLI 
# and Javy WASM engine to run without "version GLIBC not found" errors.
FROM ubuntu:24.04

# Prevent interactive prompts during the build process
ENV DEBIAN_FRONTEND=noninteractive

# 2. Install Basic System Tools
# We need curl/wget for installers, git for versioning, and xz-utils for extraction.
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    unzip \
    wget \
    python3 \
    golang-go \
    ca-certificates \
    gnupg \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# 3. Install Node.js 20
# Manually installed to ensure we stay on a LTS version compatible with the CRE SDK.
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs

# 4. Install Bun (The Speed Demon)
# Used for fast package management and running local scripts.
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"
RUN curl -fsSL https://bun.sh/install | bash

# 5. Install Foundry (Smart Contract Power Tools)
# Includes 'forge' for compiling and 'cast' for interacting with the AegisVault.
ENV PATH="/root/.foundry/bin:$PATH"
RUN curl -L https://foundry.paradigm.xyz | bash && \
    foundryup

# 6. Install Chainlink CRE CLI
# The core orchestration tool. We move it to /usr/local/bin so it's globally accessible.
RUN curl -sSL https://cre.chain.link/install.sh | bash && \
    mv /root/.cre/bin/cre /usr/local/bin/cre

# 7. Pre-cache Javy (WASM Compiler)
# CRE uses Javy to turn your TypeScript into WebAssembly. Pre-caching v5.0.4 
# prevents "Download failed" errors during your first 'cre simulate' run.
RUN mkdir -p /root/.cache/javy/v5.0.4/linux-x64 && \
    curl -L https://github.com/bytecodealliance/javy/releases/download/v5.0.4/javy-x86_64-linux-v5.0.4.gz | gunzip > /root/.cache/javy/v5.0.4/linux-x64/javy && \
    chmod +x /root/.cache/javy/v5.0.4/linux-x64/javy

# 8. Set working directory
WORKDIR /app

# 9. Keep container alive
# Allows you to 'docker exec' into a running environment at any time.
CMD ["tail", "-f", "/dev/null"]