#!/usr/bin/env bash
set -euo pipefail

repo="$1"
tag="$2"
notes="$3"
dir=$(mktemp -d)
base="https://github.com/$repo/releases/download/$tag"
platforms='{}'

gh release download "$tag" -R "$repo" -p '*.sig' -D "$dir"

add() {
  local file
  file=$(cd "$dir" && ls $1 2>/dev/null | head -1) || true
  [ -n "$file" ] || { echo "fehlt: $1" >&2; exit 1; }
  shift
  for key in "$@"; do
    platforms=$(jq --arg k "$key" --arg u "$base/${file%.sig}" --rawfile s "$dir/$file" \
      '. + {($k): {signature: ($s | rtrimstr("\n")), url: $u}}' <<<"$platforms")
  done
}

add '*_aarch64.app.tar.gz.sig' darwin-aarch64 darwin-aarch64-app
add '*_x64.app.tar.gz.sig' darwin-x86_64 darwin-x86_64-app
add '*.AppImage.sig' linux-x86_64 linux-x86_64-appimage
add '*.deb.sig' linux-x86_64-deb
add '*.rpm.sig' linux-x86_64-rpm
add '*.msi.sig' windows-x86_64 windows-x86_64-msi
add '*-setup.exe.sig' windows-x86_64-nsis

jq -n --arg v "${tag#v}" --arg n "$notes" --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson p "$platforms" \
  '{version: $v, notes: $n, pub_date: $d, platforms: $p}' > "$dir/latest.json"
gh release upload "$tag" -R "$repo" "$dir/latest.json" --clobber
jq '.platforms | keys' "$dir/latest.json"
