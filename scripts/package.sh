#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
glib-compile-schemas --strict --dry-run schemas
gnome-extensions pack --force --out-dir=dist \
    --extra-source=src --extra-source=README.md
printf '\nPackage: %s/dist/stage-manager@phucvinh57.shell-extension.zip\n' "$PWD"
