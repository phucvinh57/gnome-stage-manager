#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The test tool uses temporary XDG homes. A private bus prevents contact with
# the live Shell; memory settings prevent dconf writes to the real profile.
bash scripts/package.sh
mkdir -p dist
runtime=$(mktemp -d)
chmod 700 "$runtime"
trap 'rm -rf "$runtime"' EXIT
wrap_args=()
if [[ "${STAGE_MANAGER_TEST_LARGE:-0}" == 1 ]]; then
    # --wrap prefixes the private Shell command. Only replace the test tool's
    # virtual monitor argument; never change the invoking desktop's monitors.
    cat > "$runtime/large-monitor" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
args=("$@")
for ((i = 1; i < ${#args[@]}; i++)); do
    if [[ "${args[i-1]}" == --virtual-monitor && "${args[i]}" == 1280x720 ]]; then
        args[i]=4000x2600
    fi
done
exec "${args[@]}"
EOF
    chmod 700 "$runtime/large-monitor"
    wrap_args=(--wrap "$runtime/large-monitor")
fi
set +e
timeout --signal=TERM --kill-after=10s 120s \
    dbus-run-session -- env -u DISPLAY -u WAYLAND_DISPLAY \
    XDG_RUNTIME_DIR="$runtime" SHELL_BACKGROUND_IMAGE="$PWD/tests/background.svg" GNOME_SHELL_SLOWDOWN_FACTOR=0 \
    gnome-shell-test-tool --headless --disable-animations --extra-filter=StageManagerFixture "${wrap_args[@]}" \
    --extension="$PWD/dist/stage-manager@phucvinh57.shell-extension.zip" \
    "$PWD/tests/shellIntegration.js" 2>&1 | tee dist/shell-test.log
status=${PIPESTATUS[0]}
set -e
if [ "$status" -ne 0 ]; then
    printf '\nIsolated Shell test failed (exit %s). See dist/shell-test.log\n' "$status" >&2
    exit "$status"
fi
grep -q 'STAGE_MANAGER_INTEGRATION_PASS' dist/shell-test.log
if [[ "${STAGE_MANAGER_TEST_LARGE:-0}" == 1 ]]; then
    grep -q 'STAGE_MANAGER_LARGE_CAPTURE_PASS' dist/shell-test.log
fi
if grep -E 'JS ERROR|JS CRITICAL|Script failed|Extension .* had error' dist/shell-test.log; then
    echo 'Shell emitted JavaScript errors; inspect dist/shell-test.log' >&2
    exit 1
fi
