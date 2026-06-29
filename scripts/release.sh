#!/usr/bin/env bash
# One-command release: bump the version, commit everything, tag, push.
# Pushing the tag triggers .github/workflows/release.yml, which builds the
# signed bundles and publishes the GitHub Release (+ latest.json the in-app
# updater reads). Apps on the old version then auto-update.
#
# Usage:
#   scripts/release.sh                 # patch  (0.1.0 -> 0.1.1)
#   scripts/release.sh minor           # 0.1.0 -> 0.2.0
#   scripts/release.sh major           # 0.1.0 -> 1.0.0
#   scripts/release.sh 0.4.2           # explicit version
#   scripts/release.sh patch -y        # skip the confirmation prompt

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BUMP="patch"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *) BUMP="$arg" ;;
  esac
done

CONF="src-tauri/tauri.conf.json"
CURRENT="$(node -p "require('./$CONF').version")"

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW="$BUMP"
else
  NEW="$(node -e '
    const [maj,min,pat] = process.argv[1].split(".").map(Number);
    const b = process.argv[2];
    const v = b==="major" ? [maj+1,0,0]
            : b==="minor" ? [maj,min+1,0]
            : [maj,min,pat+1];
    console.log(v.join("."));
  ' "$CURRENT" "$BUMP")"
fi

TAG="v$NEW"

echo "Repo:    $(git rev-parse --abbrev-ref HEAD) @ $(git config --get remote.origin.url)"
echo "Version: $CURRENT  ->  $NEW   (tag $TAG)"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "!! Le tag $TAG existe déjà. Choisis une autre version." >&2
  exit 1
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Créer et publier $TAG ? Tout le travail courant sera inclus. [y/N] " ans
  [[ "$ans" =~ ^[yYoO]$ ]] || { echo "Annulé."; exit 0; }
fi

# --- bump version in the three sources of truth ---
node -e '
  const fs = require("fs");
  const v = process.argv[1];
  for (const f of ["package.json", "src-tauri/tauri.conf.json"]) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.version = v;
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  }
' "$NEW"
# Cargo.toml: only the first `version = "..."` (the [package] one).
sed -i -E "0,/^version = \"[0-9][^\"]*\"/s//version = \"$NEW\"/" src-tauri/Cargo.toml
# Keep Cargo.lock's package version in sync so CI's `cargo --locked` stays green.
( cd src-tauri && cargo update --offline -p lume --precise "$NEW" >/dev/null 2>&1 \
    || cargo generate-lockfile >/dev/null 2>&1 || true )

# --- commit, tag, push ---
git add -A
if git diff --cached --quiet; then
  echo "Rien de nouveau à committer — le tag pointera sur le commit courant."
else
  git commit -m "release: $TAG" >/dev/null
fi
git tag -a "$TAG" -m "Lume $TAG"
git push
git push origin "$TAG"

REPO_URL="$(git config --get remote.origin.url | sed -E 's#git@github.com:#https://github.com/#; s#\.git$##')"
echo
echo "✅ $TAG poussé. La CI build et publie la release :"
echo "   $REPO_URL/actions"
echo "   $REPO_URL/releases"
