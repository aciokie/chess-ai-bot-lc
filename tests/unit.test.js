// @ts-check
import { test, expect, describe, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://www.chess.com',
  pretendToBeVisual: true,
  resources: 'usable'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.requestAnimationFrame = cb => setTimeout(cb, 16);
global.cancelAnimationFrame = id => clearTimeout(id);

Object.defineProperty(global, 'location', {
  value: { hostname: 'www.chess.com', href: 'https://www.chess.com' },
  writable: true
});

global.GM_getValue = (key, def) => {
  const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
  return store[key] !== undefined ? store[key] : def;
};
global.GM_setValue = (key, value) => {
  const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
  store[key] = value;
  localStorage.setItem('GM_STORE', JSON.stringify(store));
};
global.GM_xmlhttpRequest = vi.fn((opts) => {
  if (opts.url.includes('stockfish')) {
    setTimeout(() => opts.onload({ responseText: 'self.postMessage=()=>{};', status: 200 }), 10);
  }
});
global.GM_info = { script: { name: 'Test', version: '1.0.0' } };
global.GM_openInTab = vi.fn();
global.indexedDB = dom.window.indexedDB;

import { Chess } from 'chess.js';
global.Chess = Chess;

// Import modules once
let coreModule;
async function getCore() {
  if (!coreModule) {
    coreModule = await import('../src/core.js');
  }
  return coreModule;
}

function resetCore() {
  coreModule = null;
  vi.resetModules();
}

describe('Platform Abstraction', () => {
  beforeEach(async () => {
    resetCore();
    const { Platform } = await getCore();
    Platform.detect();
  });

  test('detects Chess.com', async () => {
    const { Platform } = await getCore();
    expect(Platform.detect()).toBe('chess.com');
    expect(Platform.name).toBe('chess.com');
  });

  test('has correct selectors for Chess.com', async () => {
    const { Platform } = await getCore();
    expect(Platform.selectors.board).toContain('chess-board');
    expect(Platform.selectors.square).toBe('[data-square]');
  });

  test('getTurn returns color', async () => {
    const { Platform } = await getCore();
    const turn = Platform.getTurn();
    expect(['white', 'black']).toContain(turn);
  });

  test('getPlayingAs returns color', async () => {
    const { Platform } = await getCore();
    const color = Platform.getPlayingAs();
    expect(['white', 'black']).toContain(color);
  });

  test('isFlipped returns boolean', async () => {
    const { Platform } = await getCore();
    expect(typeof Platform.isFlipped()).toBe('boolean');
  });
});

describe('Settings Management', () => {
  beforeEach(async () => {
    resetCore();
    localStorage.clear();
  });

  test('get returns default when not set', async () => {
    const { Settings } = await getCore();
    expect(Settings.get('depth')).toBe(18);
    expect(Settings.get('autoMove')).toBe(false);
  });

  test('set and get roundtrip', async () => {
    const { Settings } = await getCore();
    Settings.set('depth', 20);
    expect(Settings.get('depth')).toBe(20);
  });

  test('model-specific settings isolated', async () => {
    const { Settings } = await getCore();
    Settings.set('hash', 256, 'model-a');
    Settings.set('hash', 512, 'model-b');
    expect(Settings.get('hash', 'model-a')).toBe(256);
    expect(Settings.get('hash', 'model-b')).toBe(512);
  });

  test('loadModel merges with defaults', async () => {
    const { Settings } = await getCore();
    Settings.set('depth', 15, 'test-model');
    Settings.set('skillLevel', 10, 'test-model');
    const all = Settings.getAll('test-model');
    expect(all.depth).toBe(15);
    expect(all.skillLevel).toBe(10);
    expect(all.autoMove).toBe(false);
  });
});

describe('Error Reporter', () => {
  beforeEach(async () => {
    resetCore();
    const { ErrorReporter } = await getCore();
    ErrorReporter.clear();
    global.SETTINGS = { engineModel: 'test-model', openingBook: true };
  });

  test('captures errors with context', async () => {
    const { ErrorReporter } = await getCore();
    const err = new Error('Test error');
    ErrorReporter.capture(err, { action: 'test', platform: 'chess.com' });
    expect(ErrorReporter.errors.length).toBe(1);
    expect(ErrorReporter.errors[0].message).toBe('Test error');
    expect(ErrorReporter.errors[0].context.action).toBe('test');
  });

  test('dump returns all errors', async () => {
    const { ErrorReporter } = await getCore();
    ErrorReporter.capture(new Error('Error 1'));
    ErrorReporter.capture(new Error('Error 2'));
    const dumped = ErrorReporter.dump();
    expect(dumped.length).toBe(2);
  });

  test('clear empties errors', async () => {
    const { ErrorReporter } = await getCore();
    ErrorReporter.capture(new Error('Error'));
    ErrorReporter.clear();
    expect(ErrorReporter.errors.length).toBe(0);
  });

  test('getSummary groups by platform and model', async () => {
    const { ErrorReporter } = await getCore();
    ErrorReporter.capture(new Error('e1'), { platform: 'chess.com', engineModel: 'm1' });
    ErrorReporter.capture(new Error('e2'), { platform: 'chess.com', engineModel: 'm1' });
    ErrorReporter.capture(new Error('e3'), { platform: 'lichess', engineModel: 'm1' });
    const summary = ErrorReporter.getSummary();
    expect(summary['chess.com:m1']).toBe(2);
    expect(summary['lichess:m1']).toBe(1);
  });
});

describe('Opening Book', () => {
  beforeEach(async () => {
    resetCore();
    const { OpeningBook } = await getCore();
    OpeningBook.init();
  });

  test('initializes with known positions', async () => {
    const { OpeningBook } = await getCore();
    expect(OpeningBook.entries.size).toBeGreaterThan(0);
  });

  test('returns move for starting position', async () => {
    const { OpeningBook } = await getCore();
    const move = OpeningBook.getMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(['e2e4', 'd2d4', 'g1f3', 'c2c4']).toContain(move);
  });

  test('returns null for unknown position', async () => {
    const { OpeningBook } = await getCore();
    const move = OpeningBook.getMove('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(move).toBeNull();
  });

  test('validates move legality', async () => {
    const { OpeningBook } = await getCore();
    const move = OpeningBook.getMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(chess.move(move)).toBeTruthy();
  });
});

describe('Utility Functions', () => {
  beforeEach(async () => {
    resetCore();
  });

  test('sleep resolves after ms', async () => {
    const { sleep } = await getCore();
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  test('randomRange returns value in range', async () => {
    const { randomRange } = await getCore();
    for (let i = 0; i < 100; i++) {
      const val = randomRange(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
    }
  });

  test('clamps value to range', async () => {
    const { clamp } = await getCore();
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test('debounce delays execution', async () => {
    const { debounce, sleep } = await getCore();
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn(); fn(); fn();
    expect(count).toBe(0);
    await sleep(60);
    expect(count).toBe(1);
  });
});

describe('FEN Generation', () => {
  test('Chess.js generates valid FEN', () => {
    const chess = new Chess();
    const fen = chess.fen();
    expect(fen).toMatch(/^[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+ [wb] (-|K?Q?k?q?) (-|[a-h][36]) \d+ \d+$/);
  });

  test('Chess.js parses moves correctly', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    expect(chess.fen()).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });
});

describe('Engine Models', () => {
  test('has stockfish-18-lite-single model', async () => {
    const { ENGINE_MODELS } = await getCore();
    expect(ENGINE_MODELS['stockfish-18-lite-single']).toBeTruthy();
    expect(ENGINE_MODELS['stockfish-18-lite-single'].name).toBe('Stockfish 18 (Lite Single)');
    expect(ENGINE_MODELS['stockfish-18-lite-single'].supportsNNUE).toBe(true);
    expect(ENGINE_MODELS['stockfish-18-lite-single'].maxDepth).toBe(25);
  });
});

describe('Default Settings', () => {
  test('has all required settings', async () => {
    const { DEFAULT_SETTINGS } = await getCore();
    expect(DEFAULT_SETTINGS.engineMode).toBe('local');
    expect(DEFAULT_SETTINGS.depth).toBe(18);
    expect(DEFAULT_SETTINGS.autoMove).toBe(false);
    expect(DEFAULT_SETTINGS.showHighlights).toBe(true);
    expect(DEFAULT_SETTINGS.humanizerRate).toBe(15);
  });
});