#!/bin/bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SHARED=".ai/shared-skills/skills"
LOCAL=".ai/skills"

cd .ai/shared-skills && git checkout -- . && cd "$ROOT"
git submodule update --remote .ai/shared-skills

for skill in "$SHARED"/*/; do
    name=$(basename "$skill")
    if [ ! -L "$LOCAL/$name" ]; then
        ln -s "../shared-skills/skills/$name" "$LOCAL/$name"
        echo "linked: $name"
    fi
done

echo ""
echo "=== Skills Summary ==="
echo "Shared (symlinks):"
for skill in "$LOCAL"/*/; do
    name=$(basename "$skill")
    [ -L "$LOCAL/$name" ] && echo "  → $name"
done
echo ""
echo "Local (directories):"
for skill in "$LOCAL"/*/; do
    name=$(basename "$skill")
    [ ! -L "$LOCAL/$name" ] && echo "  • $name"
done
echo ""
echo "Submodule commit: $(cd "$ROOT/.ai/shared-skills" && git rev-parse --short HEAD)"
echo "Done."
