#!/bin/bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SHARED=".ai/shared-skills/skills"
LOCAL=".ai/skills"
SUBMODULE_PATH=".ai/shared-skills"
SUBMODULE_URL="ssh://git@gitcloud.top:2224/ai/skills.git"

mkdir -p "$LOCAL"

if [ ! -d "$SUBMODULE_PATH/.git" ] && [ ! -f "$SUBMODULE_PATH/.git" ]; then
    echo "Submodule not found, adding..."
    git submodule add "$SUBMODULE_URL" "$SUBMODULE_PATH"
fi

cd "$SUBMODULE_PATH" && git checkout -- . && cd "$ROOT"
git submodule update --remote "$SUBMODULE_PATH"

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
echo ""

php artisan boost:update

echo "Done."
