#!/usr/bin/env bash
# Route a fresh Wayland client to the disposable test compositor.
set -euo pipefail
if [[ "${1:-}" == --help || $# == 0 ]]; then
    echo 'Usage: npm run test:app -- COMMAND [ARGS...]'
    echo 'Example: npm run test:app -- gtk4-demo'
    echo 'Uses STAGE_MANAGER_TEST_DISPLAY (default: stage-manager-test).'
    echo 'Use a fresh process; this does not join the test desktop D-Bus session.'
    exit 0
fi
socket=${STAGE_MANAGER_TEST_DISPLAY:-stage-manager-test}
if [[ ! "$socket" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo 'STAGE_MANAGER_TEST_DISPLAY must be a simple socket name.' >&2
    exit 1
fi
display_path="${XDG_RUNTIME_DIR:?No graphical runtime directory}/$socket"
if [[ ! -S "$display_path" ]] ||
    { command -v ss >/dev/null && [[ $(ss -xlH) != *"$display_path"* ]]; }; then
    echo 'Test display not found. Start npm run test:interactive first.' >&2
    exit 1
fi
# Do not allow X11-only applications to fall back to the main desktop.
exec env -u DISPLAY WAYLAND_DISPLAY="$socket" GDK_BACKEND=wayland QT_QPA_PLATFORM=wayland "$@"
