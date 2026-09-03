# Chess AI Bot

Tampermonkey/Violentmonkey userscript adding Stockfish 18 WASM analysis and auto-play to Chess.com and Lichess.

## Features
- **Stockfish 18 WASM** - Runs entirely in-browser, no server needed
- **Auto-analysis** - Real-time position evaluation
- **Auto-play** - Plays best moves with human-like delays
- **Visual aids** - Best move arrows, PV lines, evaluation bar
- **Anti-cheat** - Random pauses, humanizer, time management
- **Cross-platform** - Chess.com and Lichess support

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click [Install](https://raw.githubusercontent.com/GITHUB_USERNAME_PLACEHOLDER/chess-ai-bot/main/chess-ai-bot.user.js)
3. Play on Chess.com or Lichess - menu appears top-right

## Auto-updates
Enabled via @updateURL - Tampermonkey/Violentmonkey checks automatically.

## Development
```bash
npm install
npm run test       # Unit tests
npm run test:e2e   # E2E tests
npm run build      # Build dist/
npm run lint       # Code style
```

## Architecture
- chess-ai-bot.user.js - Deployed userscript (~27KB)
- src/core.js - ES module source
- tests/ - Vitest + Playwright test suite
- dist/ - Built artifacts

## License
MIT