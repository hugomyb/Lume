#!/usr/bin/env bash
# One-line installer for Lume (Linux). Downloads the latest AppImage from the
# GitHub Releases, installs it to ~/.local/bin and registers a desktop entry so
# Lume appears in the app menu. The AppImage then auto-updates from inside Lume.
#
#   curl -fsSL https://raw.githubusercontent.com/hugomyb/Lume/main/scripts/install.sh | bash
#
# Requires the repo (or its releases) to be PUBLIC.

set -euo pipefail

REPO="hugomyb/Lume"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons"
APP="$BIN_DIR/Lume.AppImage"

mkdir -p "$BIN_DIR" "$APPS_DIR" "$ICON_DIR"

echo ">> Recherche de la dernière version…"
URL="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -oE '"browser_download_url"[^,]*\.AppImage"' \
  | sed -E 's/.*"(https[^"]+)".*/\1/' | head -1)"

if [ -z "${URL:-}" ]; then
  echo "!! Aucune AppImage trouvée. Le repo est-il public et une release existe-t-elle ?" >&2
  exit 1
fi

echo ">> Téléchargement : $URL"
curl -fSL "$URL" -o "$APP"
chmod +x "$APP"

# Icon (best effort) for the menu entry.
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/128x128.png" \
  -o "$ICON_DIR/lume.png" 2>/dev/null || true

cat > "$APPS_DIR/com.lume.app.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Lume
GenericName=Terminal
Comment=Terminal moderne inspiré de Warp
Exec=$APP
Icon=$ICON_DIR/lume.png
Terminal=false
Categories=System;TerminalEmulator;Utility;
StartupWMClass=Lume
EOF
update-desktop-database "$APPS_DIR" 2>/dev/null || true

echo
echo "✅ Lume installé."
echo "   Lance-le depuis le menu des applications, ou : $APP"
echo "   Les mises à jour se font automatiquement dans Lume."
echo
# AppImages need libfuse2 on Ubuntu 22.04+. Detect and hint.
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  echo "ℹ️  Si Lume ne se lance pas : installe FUSE 2 →  sudo apt install -y libfuse2"
fi
