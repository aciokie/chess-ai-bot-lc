// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Chess AI Bot - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.GM_getValue = (key, def) => {
        const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
        return store[key] !== undefined ? store[key] : def;
      };
      window.GM_setValue = (key, value) => {
        const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
        store[key] = value;
        localStorage.setItem('GM_STORE', JSON.stringify(store));
      };
      window.GM_xmlhttpRequest = (opts) => {
        if (opts.url.includes('stockfish')) {
          opts.onload({ responseText: 'self.postMessage = function(){};', status: 200 });
          opts.onerror({ status: 0 });
        }
      };
      window.GM_info = { script: { name: 'Test', version: '1.0.0' } };
      window.GM_openInTab = () => {};
    });
  });

  test('loads on Chess.com home page', async ({ page }) => {
    await page.goto('https://www.chess.com');
    await expect(page).toHaveTitle(/Chess\.com/);
  });

  test('loads on Lichess home page', async ({ page }) => {
    await page.goto('https://lichess.org');
    await expect(page).toHaveTitle(/Lichess/);
  });

  test('injects userscript without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const scriptErrors = errors.filter(e => e.includes('SF Engine') || e.includes('userscript'));
    expect(scriptErrors).toHaveLength(0);
  });
});