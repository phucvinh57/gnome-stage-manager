#!/usr/bin/env bash
# Launch a disposable GNOME Shell; never install into the live desktop.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == --help ]]; then
    echo 'Usage: npm run test:interactive'
    echo 'Optional: STAGE_MANAGER_TEST_DISPLAY=stage-manager-test'
    echo 'Requires the mutter-dev-bin package on Ubuntu.'
    exit 0
fi
if (( $# )); then
    echo 'Unexpected arguments; use --help.' >&2
    exit 2
fi
for tool in gnome-shell gnome-extensions glib-compile-schemas dbus-run-session gsettings unzip; do
    command -v "$tool" >/dev/null || { echo "Missing dependency: $tool" >&2; exit 1; }
done
if [[ ! -x /usr/libexec/mutter-devkit ]]; then
    echo 'Missing Mutter development kit: install the Ubuntu package mutter-dev-bin.' >&2
    exit 1
fi
: "${XDG_RUNTIME_DIR:?Run this from a terminal in your graphical session}"
if [[ -z "${WAYLAND_DISPLAY:-}" && -z "${DISPLAY:-}" ]]; then
    echo 'Run this from a terminal in your graphical session.' >&2
    exit 1
fi
socket=${STAGE_MANAGER_TEST_DISPLAY:-stage-manager-test}
if [[ ! "$socket" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo 'STAGE_MANAGER_TEST_DISPLAY must be a simple socket name.' >&2
    exit 1
fi
if [[ -e "$XDG_RUNTIME_DIR/$socket" || -e "$XDG_RUNTIME_DIR/$socket.lock" ]]; then
    echo "Test display $socket is already in use; close it or choose STAGE_MANAGER_TEST_DISPLAY." >&2
    exit 1
fi

bash scripts/package.sh
home=$(mktemp -d)
trap 'rm -rf "$home"' EXIT
export XDG_CONFIG_HOME="$home/config"
export XDG_DATA_HOME="$home/data"
export XDG_CACHE_HOME="$home/cache"
export GSETTINGS_BACKEND=keyfile
extension_dir="$XDG_DATA_HOME/gnome-shell/extensions/stage-manager@phucvinh57"
mkdir -p "$extension_dir"
unzip -q dist/stage-manager@phucvinh57.shell-extension.zip -d "$extension_dir"
glib-compile-schemas --strict "$extension_dir/schemas"

printf '\nStarting disposable desktop on %s. Turn on Stage Manager in its panel.\n' "$socket"
echo 'From another terminal: npm run test:app -- gtk4-demo'
echo 'Close the test desktop, then rerun this command after edits.'
# Preserve the host display/runtime so the development-kit viewer can connect.
# Only the private bus and temporary XDG homes are passed to the new Shell.
dbus-run-session -- bash -eu -c '
    gsettings set org.gnome.shell enabled-extensions "[\"stage-manager@phucvinh57\"]"
    exec gnome-shell --devkit --wayland-display="$1"
' bash "$socket"
