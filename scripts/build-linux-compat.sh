#!/usr/bin/env bash
# Build Lume against an OLD glibc (Ubuntu 22.04 → glibc 2.35) inside Docker, so
# the resulting .deb/AppImage runs on Ubuntu 22.04+ / Debian 12+ (the bulk of
# the install base) and not just on the dev machine's newer glibc.
#
# Rule: always build on the OLDEST distro you want to support, never on
# ubuntu-latest. Tauri 2 needs webkit2gtk-4.1, which exists from 22.04 onward,
# so 22.04 is the practical floor.
#
# Usage:  scripts/build-linux-compat.sh
# Output: ~/lume-partage/*.deb  (+ *.AppImage best-effort)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$HOME/lume-partage}"
mkdir -p "$OUT_DIR"

echo ">> Building Lume in ubuntu:22.04 (glibc 2.35). Output → $OUT_DIR"

docker run --rm \
  -v "$REPO_ROOT":/src:ro \
  -v "$OUT_DIR":/out \
  -e APPIMAGE_EXTRACT_AND_RUN=1 \
  -e CARGO_PROFILE_RELEASE_LTO=false \
  -e CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  ubuntu:22.04 bash -euo pipefail -c '
    export DEBIAN_FRONTEND=noninteractive
    echo ">> apt deps"
    apt-get update -qq
    apt-get install -y -qq \
      curl wget file ca-certificates git build-essential pkg-config \
      libssl-dev libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
      libayatana-appindicator3-dev libxdo-dev patchelf squashfs-tools >/dev/null

    echo ">> Rust"
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal >/dev/null 2>&1
    . "$HOME/.cargo/env"

    echo ">> Node 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs >/dev/null

    echo ">> copy source (excluding node_modules / target / .git)"
    mkdir -p /build
    tar -C /src --exclude=node_modules --exclude=target --exclude=dist \
      --exclude=.git --exclude=lume-partage -cf - . | tar -C /build -xf -
    cd /build

    echo ">> npm ci"
    npm ci --silent

    echo ">> tauri build (.deb)"
    npm run tauri build -- --bundles deb

    echo ">> tauri build (AppImage, best-effort)"
    npm run tauri build -- --bundles appimage || echo "!! AppImage step skipped"

    echo ">> strip bundled libnghttp2 from the AppImage (see scripts/fix-appimage.sh)"
    for f in src-tauri/target/release/bundle/appimage/*.AppImage; do
      [ -e "$f" ] && bash scripts/fix-appimage.sh "$f"
    done

    echo ">> export artifacts"
    cp -v src-tauri/target/release/bundle/deb/*.deb /out/ 2>/dev/null || true
    cp -v src-tauri/target/release/bundle/appimage/*.AppImage /out/ 2>/dev/null || true
    chmod -R a+rw /out
  '

echo ">> Done. Artifacts:"
ls -lh "$OUT_DIR"
