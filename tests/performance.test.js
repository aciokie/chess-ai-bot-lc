// @ts-check
import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body><chess-board id="board"></chess-board></body></html>`, {
  url: 'https://www.chess.com',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  onmessage: null,
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));
global.WebAssembly = { compile: vi.fn().mockResolvedValue({}) };
global.indexedDB = { open: vi.fn().mockImplementation(() => ({ onupgradeneeded: null, onsuccess: null, result: { transaction: vi.fn().mockReturnValue({ objectStore: vi.fn().mockReturnValue({ get: vi.fn().mockImplementation(function() { this.onsuccess({ target: { result: null } }); }), put: vi.fn() }) }) }) }) };
global.GM_getValue = (key, def) => { const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}'); return store[key] !== undefined ? store[key] : def; };
global.GM_setValue = (key, value) => { const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}'); store[key] = value; localStorage.setItem('GM_STORE', JSON.stringify(store)); };
global.GM_xmlhttpRequest = vi.fn((opts) => { if (opts.url.includes('stockfish')) setTimeout(() => opts.onload({ responseText: 'self.postMessage=()=>{};', status: 200 }), 10); });
global.GM_info = { script: { name: 'Test', version: '1.0.0' } };
global.GM_openInTab = vi.fn();
import { Chess } from 'chess.js';
global.Chess = Chess;

Object.defineProperty(global, 'location', {
  value: { hostname: 'www.chess.com', href: 'https://www.chess.com' },
  writable: true
});

global.SETTINGS = { ...DEFAULT_SETTINGS };

import {
  Engine,
  Analysis,
  Platform,
  Visuals,
  Settings,
  DEFAULT_SETTINGS,
  OpeningBook,
  sleep,
  randomRange,
  debounce
} from '../src/core.js';

describe('Performance Benchmarks', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    global.SETTINGS = { ...DEFAULT_SETTINGS };
    await Engine.load('stockfish-18-lite-single');
  });

  test('Engine load time under 200ms (cached)', async () => {
    const start = performance.now();
    await Engine.load('stockfish-18-lite-single');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  }, 15000);

  test('FEN parsing under 1ms', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      new Chess(fen);
    }
    const elapsed = performance.now() - start;
    expect(elapsed / iterations).toBeLessThan(1);
  });

  test('Move generation under 0.5ms per position', () => {
    const chess = new Chess();
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      chess.moves({ verbose: true });
    }
    const elapsed = performance.now() - start;
    expect(elapsed / iterations).toBeLessThan(0.5);
  });

  test('Visual highlight creation under 5ms', async () => {
    const board = document.getElementById('board');
    board.attachShadow = vi.fn().mockReturnValue({ appendChild: vi.fn(), querySelector: vi.fn() });
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });

    const square = document.createElement('div');
    square.getBoundingClientRect = () => ({ left: 50, top: 50, width: 50, height: 50 });

    Platform.getBoard = vi.fn().mockReturnValue({
      querySelector: vi.fn().mockReturnValue(square),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 })
    });
    Platform.selectors.square = '[data-square]';
    Platform.detect();

    Visuals.init();

    const start = performance.now();
    Visuals.showBestMove('e2e4');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });

  test('Settings get/set under 0.1ms', () => {
    const iterations = 10000;

    let start = performance.now();
    for (let i = 0; i < iterations; i++) {
      Settings.set('depth', i % 25);
    }
    const writeElapsed = performance.now() - start;

    start = performance.now();
    for (let i = 0; i < iterations; i++) {
      Settings.get('depth');
    }
    const readElapsed = performance.now() - start;

    expect(writeElapsed / iterations).toBeLessThan(0.1);
    expect(readElapsed / iterations).toBeLessThan(0.1);
  });

  test('Memory usage stays under 50MB after 100 analyses', async () => {
    Platform.getTurn = vi.fn().mockReturnValue('white');
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');
    Platform.getFEN = vi.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    Platform.makeMove = vi.fn().mockReturnValue(true);

    global.SETTINGS.autoMove = false;
    global.SETTINGS.showHighlights = false;
    global.SETTINGS.showPVArrows = false;
    global.SETTINGS.showEvalBar = false;

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      Engine.worker.onmessage = null;
      const promise = Analysis.analyzePosition();
      setTimeout(() => Engine.worker.onmessage?.({ data: 'bestmove e2e4' }), 1);
      await promise;
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    expect(memoryIncrease).toBeLessThan(50);
  }, 15000);

  test('Debounce reduces function calls', async () => {
    let callCount = 0;
    const fn = debounce(() => callCount++, 50);

    for (let i = 0; i < 100; i++) fn();
    expect(callCount).toBe(0);

    await sleep(60);
    expect(callCount).toBe(1);
  });
});

describe('Stress Tests', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    global.SETTINGS = { ...DEFAULT_SETTINGS };
    await Engine.load('stockfish-18-lite-single');
  });

  test('Rapid position changes handled correctly', async () => {
    const positions = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    ];

    let completed = 0;
    for (const fen of positions) {
      Platform.getFEN = vi.fn().mockReturnValue(fen);
      Platform.getTurn = vi.fn().mockReturnValue('white');
      Platform.getPlayingAs = vi.fn().mockReturnValue('white');

      Engine.worker.onmessage = null;
      const promise = Engine.analyze(fen, 10, 1);
      setTimeout(() => Engine.worker.onmessage?.({ data: 'bestmove e2e4' }), 1);
      await promise;
      completed++;
    }

    expect(completed).toBe(positions.length);
  }, 15000);

  test('Concurrent engine loads handled', async () => {
    const promises = [
      Engine.load('stockfish-18-lite-single'),
      Engine.load('stockfish-18-lite-single'),
      Engine.load('stockfish-18-lite-single')
    ];

    const results = await Promise.all(promises);
    expect(results.every(r => r === true)).toBe(true);
  }, 15000);

  test('Large opening book lookup performance', async () => {
    OpeningBook.init();

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      OpeningBook.getMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }

    const elapsed = performance.now() - start;
    expect(elapsed / iterations).toBeLessThan(0.01);
  });
});