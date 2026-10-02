#!/bin/sh
# Forge Central container entrypoint.
# Stages host SSH keys (mounted read-only at /staging/ssh-key) into the container user's own
# ~/.ssh with strict ownership/modes, so the host files are never chmod/chown'ed.
set -eu

APP_USER="${FORGE_APP_USER:-forgecentral}"
STAGING_DIR="${FORGE_SSH_STAGING_DIR:-/staging/ssh-key}"
SSH_DIR="${FORGE_SSH_DIR:-/home/${APP_USER}/.ssh}"

if [ -d "$STAGING_DIR" ] && [ -n "$(ls -A "$STAGING_DIR" 2>/dev/null)" ]; then
    mkdir -p "$SSH_DIR"
    # -L dereferences symlinks; unreadable/special entries (e.g. agent sockets) are skipped, not fatal.
    cp -RL "$STAGING_DIR"/. "$SSH_DIR"/ 2>/dev/null || echo "docker-entrypoint: some SSH entries were not copied" >&2
    if [ "$(id -u)" = "0" ]; then
        chown -R "$APP_USER:$APP_USER" "$SSH_DIR"
    fi
    chmod 700 "$SSH_DIR"
    find "$SSH_DIR" -mindepth 1 -type d -exec chmod 700 {} +
    find "$SSH_DIR" -mindepth 1 -type f -exec chmod 600 {} +
    echo "docker-entrypoint: staged SSH keys into $SSH_DIR"
fi

if [ "$(id -u)" = "0" ] && command -v gosu >/dev/null 2>&1; then
    exec gosu "$APP_USER" "$@"
fi
exec "$@"
