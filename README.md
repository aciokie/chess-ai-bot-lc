# Chess AI Bot

Tampermonkey/Violentmonkey userscript adding Stockfish 18 WASM analysis and auto-play to **Chess.com** and **Lichess**.

## Features

- **Stockfish 18 WASM** - Runs entirely in-browser via WebAssembly
- **Auto-analysis** - Real-time position evaluation with eval bar
- **Auto-play** - Plays best moves with human-like delays and anti-cheat measures
- **Visual aids** - Best move arrows, PV lines, evaluation bar
- **Cross-platform** - Works on Chess.com and Lichess (including AI games)
- **Per-model settings** - Hash, Move Overhead, Skill Level, Limit Strength/Elo

## Quick Install

### Option 1: Direct Link (Recommended)
[![Install Chess AI Bot](https://img.shields.io/badge/Install-Chess%20AI%20Bot-green?style=for-the-badge)](https://raw.githubusercontent.com/aciokie/chess-ai-bot-lc/main/chess-ai-bot.user.js)

Click the button above, or go directly to:
```
https://raw.githubusercontent.com/aciokie/chess-ai-bot-lc/main/chess-ai-bot.user.js
```

### Option 2: jsDelivr CDN (Faster)
```
https://cdn.jsdelivr.net/gh/aciokie/chess-ai-bot-lc@main/dist/chess-ai-bot.user.js
```

## Usage

1. Install **Tampermonkey** (Chrome/Firefox/Edge) or **Violentmonkey** (Firefox/Chrome)
2. Click the install link above
3. Go to **Lichess** (play against computer) or **Chess.com**
3. The floating menu appears top-right - configure and play!

## Lichess AI Games Support

The script works on Lichess "Play with Computer" pages:
- Lichess homepage → "Play against computer" → Select level → Start game
- The script detects your color and analyzes only YOUR moves

## Settings Menu

The floating menu (draggable, collapsible) includes:

| Category | Options |
|----------|---------|
| **Engine** | Local/Cloud, Model, Depth, Max Think Time |
| **Auto** | Auto-analysis, Auto-move, Auto-queue, Hide after move |
| **Visuals** | Highlights, PV arrows, Eval bar, Colors |
| **Timing** | Min/Max delay, Time management |
| **Advanced** | Humanizer, Opening book, Threat detection, Anti-cheat |

## Anti-Cheat Measures

- Random pauses every 12-25 analyses (0.7-2.5s)
- Human-like randomized delays
- Humanizer (15% default) plays 2nd/3rd best moves
- Time management based on clock

## Development

```bash
npm install
npm run test       # Unit + integration tests (37 pass)
npm run lint       # ESLint + Prettier
npm run build      # Build dist/chess-ai-bot.user.js
```

## Auto-Updates

Enabled via `@updateURL` - Tampermonkey/Violentmonkey checks automatically.
Bump `@version` in the userscript header to trigger updates.

## Architecture

```
chess-ai-bot.user.js   # Deployed userscript (~58KB)
src/core.js            # ES module source (testable)
tests/                 # Vitest + Playwright test suite
dist/                  # Built artifacts
.github/workflows/     # CI/CD pipeline
```

## License

MIT