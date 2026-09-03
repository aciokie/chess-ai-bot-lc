# Chess AI Bot - Test Suite

## Overview
Comprehensive test suite for the Chess AI Bot userscript covering unit tests, integration tests, E2E tests, and performance benchmarks.

## Test Structure
```
tests/
├── setup.js              # Vitest global setup (JSDOM, mocks)
├── unit.test.js          # Unit tests for core modules
├── integration.test.js   # Integration tests for engine/analysis
├── e2e.test.js           # Playwright E2E tests
├── performance.test.js   # Performance benchmarks
└── brave-smoke.spec.js   # Playwright smoke tests
```

## Running Tests

### Unit & Integration Tests (Vitest)
```bash
# Run all unit tests
npm test

# Run with UI
npm run test:ui

# Watch mode
npm run test:watch
```

### E2E Tests (Playwright)
```bash
# Run all E2E tests
npm run test:e2e

# Run headed (visible browser)
npm run test:e2e:headed

# Run with UI
npm run test:e2e:ui
```

### All Tests
```bash
npm run test:all
```

## Test Coverage
- **Platform Abstraction**: Chess.com & Lichess detection, FEN extraction, move execution
- **Settings Management**: Persistence, per-model isolation, defaults
- **Error Reporter**: Capture, dump, summary, global access
- **Opening Book**: Position lookup, move validation, legality checks
- **Engine Manager**: Load, configure, analyze, cache, termination
- **Analysis Engine**: Color-first analysis, auto-move, humanizer, anti-cheat
- **Visuals**: Highlights, PV arrows, eval bar, shadow DOM isolation
- **Menu System**: DOM creation, drag, persistence, events
- **Auto-Rematch**: Button detection, visibility checks

## Performance Benchmarks
- Engine load (cached): < 200ms
- FEN parsing: < 1ms per 10k iterations
- Move generation: < 0.5ms per position
- Visual highlights: < 5ms
- Settings I/O: < 0.1ms per operation
- Memory growth: < 50MB after 100 analyses

## CI/CD
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

## Debugging
```bash
# Debug specific test
npx vitest run tests/unit.test.js -t "Platform"

# Debug Playwright test
npx playwright test tests/e2e.test.js --debug

# View coverage report
npx vitest run --coverage
open coverage/index.html
```

## Mock Strategy
- **GM APIs**: Mocked via localStorage + vi.fn()
- **Web Workers**: Mocked with postMessage/onmessage simulation
- **WebAssembly**: Mocked compile/instantiate
- **IndexedDB**: Mocked with in-memory store
- **Stockfish**: Mocked UCI protocol responses
- **DOM**: JSDOM with pretendToBeVisual

## Adding New Tests
1. Create test file in `tests/` with `.test.js` suffix
2. Import modules from `../chess-ai-bot.user.js?raw`
3. Use `vi.resetModules()` and `localStorage.clear()` in `beforeEach`
4. Follow existing patterns for mocks and assertions