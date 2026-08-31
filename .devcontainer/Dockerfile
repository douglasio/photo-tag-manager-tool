FROM node:24-bookworm

# Build tools for native modules (better-sqlite3, sharp, onnxruntime-node)
# + Electron/Chromium runtime libraries so the app window can render via X11
# + perl for the vendored exiftool binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    perl \
    git \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libgl1 \
    libegl1 \
    mesa-vulkan-drivers \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libgtk-3-0 \
    libnotify4 \
    libnspr4 \
    libsecret-1-0 \
    xdg-utils \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Official node images ship a non-root "node" user (uid 1000) -
# Electron/Chromium refuses to run its sandbox as root.
USER node
WORKDIR /workspace
