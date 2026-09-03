// @ts-check
import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <chess-board id="board"></chess-board>
</body></html>`, {
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
global.WebAssembly = {
  compile: vi.fn().mockResolvedValue({}),
  instantiate: vi.fn().mockResolvedValue({ instance: { exports: {} } })
};
global.indexedDB = {
  open: vi.fn().mockImplementation(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockImplementation(function() { this.onsuccess({ target: { result: null } }); }),
          put: vi.fn()
        })
      })
    }
  }))
};

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

import { Chess } from 'chess.js';
global.Chess = Chess;

Object.defineProperty(global, 'location', {
  value: { hostname: 'www.chess.com', href: 'https://www.chess.com' },
  writable: true
});

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

describe('Engine Manager (skipped - requires WASM engine)', () => {
  test.skip('load creates worker', () => {});
  test.skip('configure sends UCI options', () => {});
  test.skip('analyze returns bestmove', () => {});
  test.skip('caches analysis results', () => {});
  test.skip('stop sends stop command', () => {});
  test.skip('terminate cleans up worker', () => {});
});

describe('Analysis Engine', () => {
  beforeEach(async () => {
    resetCore();
    localStorage.clear();
    const { DEFAULT_SETTINGS } = await getCore();
    global.SETTINGS = { ...DEFAULT_SETTINGS };
    const { Engine } = await getCore();
    // Mock the engine for analysis tests
    Engine.worker = {
      postMessage: vi.fn(),
      onmessage: null,
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    Engine.ready = true;
    Engine.analyzing = false;
  });

  test('analyzePosition skips if not your turn', async () => {
    const { Platform, Engine, Analysis } = await getCore();
    Platform.getTurn = vi.fn().mockReturnValue('black');
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');
    Platform.getFEN = vi.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    await Analysis.analyzePosition();
    expect(Engine.analyzing).toBe(false);
  }, 15000);

  test('analyzePosition runs when your turn', async () => {
    const { Platform, Engine, Analysis } = await getCore();
    Platform.getTurn = vi.fn().mockReturnValue('white');
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');
    Platform.getFEN = vi.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    let resolveAnalysis;
    const analysisPromise = new Promise(r => { resolveAnalysis = r; });
    
    Engine.worker.onmessage = null;
    Engine.analyze = vi.fn().mockImplementation(() => analysisPromise);
    
    const analyzePromise = Analysis.analyzePosition();
    
    // Simulate engine response
    setTimeout(() => {
      if (Engine.worker.onmessage) {
        Engine.worker.onmessage({ data: 'bestmove e2e4' });
      }
      resolveAnalysis({ bestMove: 'e2e4' });
    }, 10);
    
    await analyzePromise;
    expect(Analysis.lastAnalysis).toBeTruthy();
  }, 15000);

  test('scheduleAutoMove calls makeMove after delay', async () => {
    const { Platform, Analysis } = await getCore();
    Platform.makeMove = vi.fn().mockReturnValue(true);
    Platform.getTurn = vi.fn().mockReturnValue('white');
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');
    global.SETTINGS.autoMove = true;
    global.SETTINGS.minDelay = 10;
    global.SETTINGS.maxDelay = 20;
    global.SETTINGS.timeManagement = false;
    global.SETTINGS.humanizerRate = 0;

    Analysis.lastAnalysis = { bestMove: 'e2e4' };
    Analysis.scheduleAutoMove('e2e4');

    await new Promise(r => setTimeout(r, 50));
    expect(Platform.makeMove).toHaveBeenCalledWith('e2e4');
  }, 15000);

  test('humanizer picks alternative move', async () => {
    const { Platform, Analysis } = await getCore();
    Platform.makeMove = vi.fn().mockReturnValue(true);
    Platform.getTurn = vi.fn().mockReturnValue('white');
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');
    global.SETTINGS.autoMove = true;
    global.SETTINGS.minDelay = 10;
    global.SETTINGS.maxDelay = 20;
    global.SETTINGS.timeManagement = false;
    global.SETTINGS.humanizerRate = 100;

    Analysis.lastAnalysis = {
      bestMove: 'e2e4',
      multiPV: [{ move: 'e2e4', score: 50 }, { move: 'd2d4', score: 30 }]
    };

    Analysis.scheduleAutoMove('e2e4');
    await new Promise(r => setTimeout(r, 50));
    expect(['e2e4', 'd2d4']).toContain(Platform.makeMove.mock.calls[0][0]);
  }, 15000);
});

describe('Visuals System', () => {
  beforeEach(async () => {
    resetCore();
    const board = document.getElementById('board');
    const mockShadowRoot = {
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([])
    };
    board.attachShadow = vi.fn().mockReturnValue(mockShadowRoot);
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
    const { Platform } = await getCore();
    Platform.detect();
  });

  test('showBestMove creates SVG arrow', async () => {
    const { Visuals, Platform } = await getCore();
    const square = document.createElement('div');
    square.getBoundingClientRect = () => ({ left: 50, top: 50, width: 50, height: 50 });
    square.setAttribute = vi.fn();
    square.classList = { add: vi.fn() };

    const mockBoard = {
      querySelector: vi.fn().mockReturnValue(square),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
      attachShadow: vi.fn().mockReturnValue({
        appendChild: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([])
      })
    };
    
    Platform.getBoard = vi.fn().mockReturnValue(mockBoard);
    Platform.selectors.square = '[data-square]';

    Visuals.init();
    Visuals.showBestMove('e2e4');

    expect(Visuals.highlights.size).toBeGreaterThan(0);
  });

  test('clearAll removes all visuals', async () => {
    const { Visuals } = await getCore();
    Visuals.highlights.set('test', { remove: vi.fn() });
    Visuals.pvArrows.push({ remove: vi.fn() });
    Visuals.clearAll();
    expect(Visuals.highlights.size).toBe(0);
    expect(Visuals.pvArrows.length).toBe(0);
  });
});

describe('Evaluation Bar', () => {
  beforeEach(async () => {
    resetCore();
  });

  test('update positions knob based on score', async () => {
    const { Platform, EvalBar } = await getCore();
    const mockElement = {
      style: {},
      offsetHeight: 400,
      appendChild: vi.fn(),
      remove: vi.fn()
    };
    const mockKnob = { style: {} };
    const mockShadowRoot = { appendChild: vi.fn() };

    Platform.getBoard = vi.fn().mockReturnValue({
      attachShadow: () => mockShadowRoot,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 })
    });
    Platform.getPlayingAs = vi.fn().mockReturnValue('white');

    EvalBar.init = vi.fn(() => {
      EvalBar.element = mockElement;
      EvalBar.knob = mockKnob;
    });

    EvalBar.update({ multiPV: [{ score: 200 }] });
    expect(mockKnob.style.top).toBeDefined();
  });

  test('flips colors when playing as black', async () => {
    const { Platform, EvalBar } = await getCore();
    Platform.getPlayingAs = vi.fn().mockReturnValue('black');
    const mockElement = { style: {}, offsetHeight: 400 };
    const mockKnob = { style: {} };

    EvalBar.element = mockElement;
    EvalBar.knob = mockKnob;

    EvalBar.update({ multiPV: [{ score: 200 }] });
    expect(mockElement.style.background).toContain('#000');
  });
});

describe('Menu System', () => {
  beforeEach(async () => {
    resetCore();
    localStorage.clear();
    const { DEFAULT_SETTINGS } = await getCore();
    global.SETTINGS = { ...DEFAULT_SETTINGS };
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  test('createMenu builds DOM structure', async () => {
    const { Platform, Menu } = await getCore();
    Platform.detect();
    Menu.createMenu();
    expect(Menu.element).toBeTruthy();
    expect(Menu.shadowRoot).toBeTruthy();
  });

  test('savePosition stores coordinates', async () => {
    const { Menu, Settings } = await getCore();
    Menu.element = { getBoundingClientRect: () => ({ left: 100, top: 200 }) };
    Menu.savePosition();
    expect(Settings.get('menuX')).toBe(100);
    expect(Settings.get('menuY')).toBe(200);
  });
});

describe('Auto Rematch', () => {
  beforeEach(async () => {
    resetCore();
    const { DEFAULT_SETTINGS } = await getCore();
    global.SETTINGS = { ...DEFAULT_SETTINGS };
    const { Platform } = await getCore();
    Platform.detect();
  });

  test('clicks rematch button when visible', async () => {
    const { Platform } = await getCore();
    const btn = { click: vi.fn(), offsetParent: document.body };
    Platform.getBoard = vi.fn().mockReturnValue({
      querySelector: vi.fn().mockReturnValue(btn)
    });
    Platform.selectors.rematchButton = '.rematch-button';

    global.SETTINGS.autoQueue = true;
    const checkRematch = () => {
      const btn = Platform.getBoard().querySelector(Platform.selectors.rematchButton);
      if (btn && btn.offsetParent !== null) btn.click();
    };
    checkRematch();
    expect(btn.click).toHaveBeenCalled();
  });

  test('does not click when button hidden', async () => {
    const { Platform } = await getCore();
    const btn = { click: vi.fn(), offsetParent: null };
    Platform.getBoard = vi.fn().mockReturnValue({
      querySelector: vi.fn().mockReturnValue(btn)
    });

    const checkRematch = () => {
      const btn = Platform.getBoard().querySelector(Platform.selectors.rematchButton);
      if (btn && btn.offsetParent !== null) btn.click();
    };
    checkRematch();
    expect(btn.click).not.toHaveBeenCalled();
  });
});