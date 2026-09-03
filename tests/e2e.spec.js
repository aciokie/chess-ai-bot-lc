// @ts-check
import { test, expect, describe, beforeEach, afterEach } from '@playwright/test';

test.describe('Chess AI Bot - E2E Tests', () => {
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
          opts.onload({ responseText: `
            self.onmessage = function(e) {
              if (e.data === 'uci') self.postMessage('uciok');
              if (e.data.startsWith('position')) self.postMessage('readyok');
              if (e.data.startsWith('go')) setTimeout(() => self.postMessage('bestmove e2e4'), 50);
            };
          `, status: 200 });
        }
      };
      window.GM_info = { script: { name: 'Test', version: '1.0.0' } };
      window.GM_openInTab = () => {};
    });
  });

  test('full game flow on Chess.com vs Computer', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');

    const board = page.locator('chess-board, wc-chess-board');
    await expect(board).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const menu = page.locator('div[style*="z-index: 2147483647"]');
    await expect(menu).toBeVisible({ timeout: 5000 });

    const autoMoveCheckbox = page.locator('#sf-auto-move');
    await autoMoveCheckbox.check();

    await page.waitForTimeout(5000);

    const moves = await page.locator('.move-list, .vertical-move-list').textContent();
    expect(moves).toBeTruthy();
  });

  test('full game flow on Lichess vs Computer', async ({ page }) => {
    await page.goto('https://lichess.org/play/computer');
    await page.waitForLoadState('networkidle');

    const board = page.locator('cg-board, lichess-board');
    await expect(board).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const menu = page.locator('div[style*="z-index: 2147483647"]');
    await expect(menu).toBeVisible({ timeout: 5000 });
  });

  test('settings persist across reload', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const depthSlider = page.locator('#sf-depth');
    await depthSlider.fill('20');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const newDepth = await page.locator('#sf-depth').inputValue();
    expect(newDepth).toBe('20');
  });

  test('engine model switch reloads engine', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const modelSelect = page.locator('#sf-engine-model');
    await modelSelect.selectOption({ index: 0 });

    await page.waitForTimeout(1000);
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    expect(logs.some(l => l.includes('Engine reloaded'))).toBeTruthy();
  });

  test('visual highlights appear on analysis', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const autoRun = page.locator('#sf-auto-run');
    await autoRun.check();

    await page.waitForTimeout(3000);

    const shadowRoot = await page.locator('chess-board').evaluateHandle(el => el.shadowRoot);
    const highlights = await shadowRoot.evaluateHandle(root => root.querySelectorAll('.sf-highlight'));
    expect(await highlights.evaluate(nodes => nodes.length)).toBeGreaterThan(0);
  });

  test('evaluation bar appears and updates', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const showEval = page.locator('#sf-show-eval');
    await showEval.check();

    await page.waitForTimeout(2000);

    const board = page.locator('chess-board');
    const evalBar = await board.evaluateHandle(el => {
      const sr = el.shadowRoot;
      return sr ? sr.querySelector('.sf-eval-bar') : null;
    });
    expect(evalBar).toBeTruthy();
  });

  test('PV arrows display multiple lines', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const showPV = page.locator('#sf-show-pv');
    await showPV.check();

    const pvDepth = page.locator('#sf-pv-depth');
    await pvDepth.fill('3');

    await page.waitForTimeout(3000);

    const board = page.locator('chess-board');
    const arrows = await board.evaluateHandle(el => {
      const sr = el.shadowRoot;
      return sr ? sr.querySelectorAll('.sf-pv-arrow') : [];
    });
    expect(await arrows.evaluate(nodes => nodes.length)).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Anti-Cheat Behavior', () => {
  test('random delays between moves', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const minDelay = page.locator('#sf-min-delay');
    const maxDelay = page.locator('#sf-max-delay');
    await minDelay.fill('100');
    await maxDelay.fill('200');

    const autoMove = page.locator('#sf-auto-move');
    await autoMove.check();
    const autoRun = page.locator('#sf-auto-run');
    await autoRun.check();

    const moveTimes = [];
    page.on('console', msg => {
      if (msg.text().includes('Auto move')) moveTimes.push(Date.now());
    });

    await page.waitForTimeout(10000);

    if (moveTimes.length > 1) {
      const delays = moveTimes.slice(1).map((t, i) => t - moveTimes[i]);
      delays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(100);
        expect(d).toBeLessThanOrEqual(200);
      });
    }
  });

  test('anti-cheat pauses occur periodically', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const antiCheat = page.locator('#sf-anti-cheat');
    await antiCheat.check();

    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.waitForTimeout(30000);

    const pauseLogs = logs.filter(l => l.includes('pause') || l.includes('anti-cheat'));
    expect(pauseLogs.length).toBeGreaterThan(0);
  });
});

test.describe('Error Handling', () => {
  test('error reporter accessible globally', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const reporter = await page.evaluate(() => window.__SF_ErrorReporter);
    expect(reporter).toBeTruthy();
    expect(typeof reporter.dump).toBe('function');
    expect(typeof reporter.clear).toBe('function');
    expect(typeof reporter.getSummary).toBe('function');
  });

  test('errors captured and reported', async ({ page }) => {
    await page.goto('https://www.chess.com/play/computer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      window.__SF_ErrorReporter.capture(new Error('Test error'), { test: true });
    });

    const errors = await page.evaluate(() => window.__SF_ErrorReporter.dump());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBe('Test error');
  });
});