#!/usr/bin/env bash
set -euo pipefail

current=$(jq -r .version src-tauri/tauri.conf.json)

if ! git rev-parse -q --verify "refs/tags/v$current" >/dev/null; then
  echo "$current"
  exit 0
fi

subjects=$(git log --no-merges --format=%s "v$current..HEAD" | grep -v '^chore(release)' || true)
bodies=$(git log --no-merges --format=%b "v$current..HEAD")

pattern='^[a-z]+(\([^)]*\))?!?: '
if grep -qE '^[a-z]+(\([^)]*\))?!: ' <<<"$subjects" || grep -q '^BREAKING CHANGE' <<<"$bodies"; then
  bump=major
elif grep -qE '^feat(\([^)]*\))?: ' <<<"$subjects"; then
  bump=minor
elif grep -qE '^(fix|perf)(\([^)]*\))?: ' <<<"$subjects"; then
  bump=patch
else
  exit 0
fi

IFS=. read -r major minor patch <<<"$current"
case "$bump" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac
next="$major.$minor.$patch"

sed -i "0,/\"version\": \".*\"/s//\"version\": \"$next\"/" package.json src-tauri/tauri.conf.json
sed -i "0,/^version = \".*\"/s//version = \"$next\"/" src-tauri/Cargo.toml
sed -i "/^name = \"betterjira\"$/{n;s/^version = \".*\"/version = \"$next\"/}" src-tauri/Cargo.lock

section() {
  local items
  items=$(grep -E "$1" <<<"$subjects" | sed -E "s/$pattern//; s/^/- /" || true)
  [ -n "$items" ] && printf '### %s\n\n%s\n\n' "$2" "$items"
  return 0
}

{
  printf '## %s – %s\n\n' "$next" "$(date +%F)"
  section '^feat(\(|!|:)' "Neu"
  section '^(fix|perf)(\(|!|:)' "Fehlerbehebung"
} >release-notes.md

awk 'NR==FNR { notes = notes $0 "\n"; next } !done && /^## / { printf "%s", notes; done = 1 } { print }' \
  release-notes.md CHANGELOG.md >CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
rm release-notes.md

echo "$next"
