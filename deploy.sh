#!/usr/bin/env bash
# deploy.sh - Deploy Chess AI Bot to GitHub with auto-update support
# Usage: ./deploy.sh YOUR_GITHUB_USERNAME

set -e

GITHUB_USERNAME="${1:-}"

if [ -z "$GITHUB_USERNAME" ]; then
    echo "Usage: $0 YOUR_GITHUB_USERNAME"
    echo "Example: $0 johndoe"
    exit 1
fi

REPO_NAME="chess-ai-bot"
REPO_DIR="/tmp/$REPO_NAME"

echo "🚀 Deploying Chess AI Bot for user: $GITHUB_USERNAME"

# Update userscript with actual username
sed -i "s/{{GITHUB_USERNAME}}/$GITHUB_USERNAME/g" chess-ai-bot.user.js
sed -i "s/{{GITHUB_USERNAME}}/$GITHUB_USERNAME/g" dist/chess-ai-bot.user.js 2>/dev/null || true

echo "✅ Updated @updateURL and @downloadURL in userscript"

# Build fresh
npm run build
sed -i "s/{{GITHUB_USERNAME}}/$GITHUB_USERNAME/g" dist/chess-ai-bot.user.js

# Create temp repo
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR/dist"
mkdir -p "$REPO_DIR/tests"
mkdir -p "$REPO_DIR/src"

# Copy files
cp chess-ai-bot.user.js "$REPO_DIR/"
cp dist/chess-ai-bot.user.js "$REPO_DIR/dist/"
cp package.json "$REPO_DIR/"
cp README.md "$REPO_DIR/" 2>/dev/null || true
cp LICENSE "$REPO_DIR/" 2>/dev/null || true
cp -r src "$REPO_DIR/"
cp -r tests "$REPO_DIR/"
cp vitest.config.js "$REPO_DIR/" 2>/dev/null || true
cp playwright.config.js "$REPO_DIR/" 2>/dev/null || true
cp .eslintrc.json "$REPO_DIR/" 2>/dev/null || true
cp .prettierrc "$REPO_DIR/" 2>/dev/null || true
cp .github/workflows/test.yml "$REPO_DIR/.github/workflows/" 2>/dev/null || true

# Create README if missing
if [ ! -f "$REPO_DIR/README.md" ]; then
cat > "$REPO_DIR/README.md" << 'EOF'
# Chess AI Bot

Tampermonkey/Violentmonkey userscript adding Stockfish 18 WASM analysis and auto-play to Chess.com and Lichess.

## Features
- **Stockfish 18 WASM** - Runs entirely in-browser, no server needed
- **Auto-analysis** - Real-time position evaluation
- **Auto-play** - Plays best moves with human-like delays
- **Visual aids** - Best move arrows, PV lines, evaluation bar
- **Anti-cheat** - Random pauses, humanizer, time management
- **Cross-platform** - Chess.com & Lichess support

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click [Install](https://raw.githubusercontent.com/GITHUB_USERNAME/chess-ai-bot/main/chess-ai-bot.user.js)
3. Play on Chess.com or Lichess - menu appears top-right

## Auto-updates
Enabled via `@updateURL` - Tampermonkey/Violentmonkey checks automatically.

## Development
```bash
npm install
npm run test       # Unit tests
npm run test:e2e   # E2E tests
npm run build      # Build dist/
npm run lint       # Code style
```

## Architecture
- `chess-ai-bot.user.js` - Deployed userscript (~27KB)
- `src/core.js` - ES module source
- `tests/` - Vitest + Playwright test suite
- `dist/` - Built artifacts

## License
MIT
EOF
sed -i "s/GITHUB_USERNAME/$GITHUB_USERNAME/g" "$REPO_DIR/README.md"
fi

cd "$REPO_DIR"

# Init git
git init
git config user.name "$GITHUB_USERNAME"
git config user.email "$GITHUB_USERNAME@users.noreply.github.com"
git add .
git commit -m "Chess AI Bot v1.0.0 - Stockfish 18 WASM userscript"
git branch -M main

echo ""
echo "📦 Repository ready at: $REPO_DIR"
echo ""
echo "Next steps:"
echo "1. Create repo on GitHub: https://github.com/new"
echo "   - Name: chess-ai-bot"
echo "   - Public (required for raw.githubusercontent.com)"
echo "   - Don't initialize with README"
echo ""
echo "2. Push:"
echo "   cd $REPO_DIR"
echo "   git remote add origin https://github.com/$GITHUB_USERNAME/chess-ai-bot.git"
echo "   git push -u origin main"
echo ""
echo "3. Install link for users:"
echo "   https://raw.githubusercontent.com/$GITHUB_USERNAME/chess-ai-bot/main/chess-ai-bot.user.js"
echo ""
echo "4. jsDelivr CDN (optional, faster):"
echo "   https://cdn.jsdelivr.net/gh/$GITHUB_USERNAME/chess-ai-bot@main/dist/chess-ai-bot.user.js"