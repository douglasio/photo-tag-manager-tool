#!/bin/sh
# Use inside the dev container instead of `npm run dev`.
#
# --disable-gpu:  containers have no real GPU/DRM device, so Chromium's GPU
#   process fails to init and the window never appears.
#
# --no-sandbox:   chrome-sandbox ships as node:node 0755 because we run as the
#   non-root "node" user and node_modules is created inside a bind mount, so it
#   can't be root-owned setuid 4755. Chromium's namespace sandbox isn't a usable
#   fallback either - the container runs under docker-default AppArmor, which
#   denies unprivileged user namespaces (`unshare --user` => EPERM), so
#   --disable-setuid-sandbox aborts with "No usable sandbox!".
#   This must be a CLI flag, not ELECTRON_DISABLE_SANDBOX: VS Code's ptyHost
#   strips that var from integrated terminals, so containerEnv never reaches
#   the shell you actually type into.
exec npx electron-vite dev -- --disable-gpu --no-sandbox
