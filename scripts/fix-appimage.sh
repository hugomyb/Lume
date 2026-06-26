#!/usr/bin/env bash
# Strip the bundled libnghttp2 from a Tauri-built AppImage, in place.
#
# Why this exists
# ---------------
# Tauri's AppImage bundler (via linuxdeploy) copies libnghttp2.so.* INTO the
# AppImage, but NOT libcurl: libcurl sits on the AppImage excludelist, so it is
# always provided by the host. That asymmetry is the bug. We build on the oldest
# supported distro (Ubuntu 22.04 → nghttp2 1.43), so on any host whose system
# libcurl is newer, libcurl resolves the *stale bundled* libnghttp2 first (the
# AppImage puts usr/lib at the front of the loader path) and dies at startup with
#   symbol lookup error: libcurl.so.4: undefined symbol: nghttp2_...
# Dropping the bundled copy lets the host provide a matching libcurl/libnghttp2
# pair. Lume itself never links libcurl (it shells out to the `curl` binary), so
# removing the bundled libnghttp2 is safe.
#
# How
# ---
# A type-2 AppImage is just "runtime ELF + appended squashfs". We reuse the
# original runtime untouched and only rebuild the squashfs, so there is nothing
# to download (no appimagetool) — only squashfs-tools (mksquashfs / unsquashfs).
#
# Idempotent: a no-op if the AppImage carries no bundled libnghttp2.
#
# Usage: scripts/fix-appimage.sh <path/to/App.AppImage>
set -euo pipefail

appimage="${1:?usage: fix-appimage.sh <App.AppImage>}"
[ -f "$appimage" ] || { echo "!! not found: $appimage" >&2; exit 1; }
appimage="$(cd "$(dirname "$appimage")" && pwd)/$(basename "$appimage")"
chmod +x "$appimage"

for tool in mksquashfs unsquashfs; do
  command -v "$tool" >/dev/null 2>&1 \
    || { echo "!! missing '$tool' — install squashfs-tools" >&2; exit 1; }
done

# Where the squashfs starts (= size of the embedded AppImage runtime).
offset="$("$appimage" --appimage-offset)"
# Preserve the original squashfs compression + block size on repack.
stat="$(unsquashfs -s -o "$offset" "$appimage")"
comp="$(awk '/^Compression/{print $2}' <<<"$stat")"
bsize="$(awk '/^Block size/{print $3}' <<<"$stat")"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

unsquashfs -o "$offset" -d "$work/squashfs-root" "$appimage" >/dev/null

if ! ls "$work"/squashfs-root/usr/lib/libnghttp2.so* >/dev/null 2>&1; then
  echo ">> $(basename "$appimage"): no bundled libnghttp2 — nothing to do"
  exit 0
fi

echo ">> $(basename "$appimage"): removing bundled libnghttp2 (offset=$offset comp=$comp)"
rm -f "$work"/squashfs-root/usr/lib/libnghttp2.so*

head -c "$offset" "$appimage" > "$work/runtime"
mksquashfs "$work/squashfs-root" "$work/fs.sqfs" \
  -root-owned -noappend -comp "$comp" -b "$bsize" >/dev/null
cat "$work/runtime" "$work/fs.sqfs" > "$work/out.AppImage"
chmod +x "$work/out.AppImage"
mv "$work/out.AppImage" "$appimage"

echo ">> repacked $(basename "$appimage") ($(du -h "$appimage" | cut -f1))"
