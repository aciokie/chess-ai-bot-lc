process.env.VITEST = 'true';
process.env.VITEST_WORKER_ID = '1';
globalThis.__TEST_MODE__ = true;

import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://www.chess.com',
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.CustomEvent = dom.window.CustomEvent;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.requestAnimationFrame = cb => setTimeout(cb, 16);
global.cancelAnimationFrame = id => clearTimeout(id);
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.indexedDB = dom.window.indexedDB;
global.WebAssembly = dom.window.WebAssembly;

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
  if (opts.url && opts.url.includes('stockfish')) {
    setTimeout(() => {
      if (opts.onload) opts.onload({ responseText: 'self.postMessage=()=>{};', status: 200 });
    }, 10);
  }
});

global.GM_info = { script: { name: 'Test', version: '1.0.0' } };
global.GM_openInTab = vi.fn();

global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  onmessage: null,
  onerror: null,
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));

global.MutationObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn().mockReturnValue([])
}));

import { Chess } from 'chess.js';
global.Chess = Chess;

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});