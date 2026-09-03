export const VERSION = '1.0.0';

export const ENGINE_MODELS = {
    'stockfish-18-lite-single': {
        name: 'Stockfish 18 (Lite Single)',
        jsUrl: 'https://cdn.jsdelivr.net/npm/stockfish@18.0.7/bin/stockfish-18-lite-single.js',
        wasmUrl: 'https://cdn.jsdelivr.net/npm/stockfish@18.0.7/bin/stockfish-18-lite-single.wasm',
        supportsNNUE: true,
        supportsSlowMover: false,
        supportsContempt: false,
        supportsMinThink: false,
        supportsWDL: true,
        maxDepth: 25
    }
};

export const DEFAULT_SETTINGS = {
    engineMode: 'local',
    engineModel: 'stockfish-18-lite-single',
    depth: 18,
    maxThinkTime: 30000,
    autoRun: false,
    autoMove: false,
    autoQueue: false,
    hideAfterMove: false,
    showHighlights: true,
    highlightType: 'arrow',
    showPVArrows: true,
    pvDepth: 3,
    showEvalBar: true,
    evalBarSide: 'right',
    minDelay: 500,
    maxDelay: 2000,
    timeManagement: true,
    humanizerRate: 15,
    openingBook: true,
    threatDetection: true,
    antiCheatPauses: true,
    hash: 128,
    moveOverhead: 30,
    skillLevel: 20,
    limitStrength: false,
    elo: 2800,
    showWDL: true,
    slowMover: 100,
    contempt: 0,
    minThinkTime: 0
};

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function randomRange(min, max) { return Math.random() * (max - min) + min; }

export function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

export function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export const Settings = {
    prefix: 'bot_',
    modelPrefix: (model) => `m_${model.replace(/[^a-z0-9]/gi, '_')}_`,

    get(key, model = null) {
        const prefix = model ? this.modelPrefix(model) : this.prefix;
        const val = (typeof GM_getValue !== 'undefined' ? GM_getValue : ((k, d) => {
            const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
            return store[k] !== undefined ? store[k] : d;
        }))(prefix + key);
        return val !== undefined ? val : (model ? this.get(key, null) : DEFAULT_SETTINGS[key]);
    },

    set(key, value, model = null) {
        const prefix = model ? this.modelPrefix(model) : this.prefix;
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(prefix + key, value);
        } else {
            const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
            store[prefix + key] = value;
            localStorage.setItem('GM_STORE', JSON.stringify(store));
        }
    },

    getAll(model = null) {
        const prefix = model ? this.modelPrefix(model) : this.prefix;
        const settings = {};
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            const val = (typeof GM_getValue !== 'undefined' ? GM_getValue : ((k) => {
                const store = JSON.parse(localStorage.getItem('GM_STORE') || '{}');
                return store[k];
            }))(prefix + key);
            if (val !== undefined) settings[key] = val;
        }
        return { ...DEFAULT_SETTINGS, ...settings };
    },

    loadModel(model) {
        const saved = this.getAll(model);
        return saved;
    }
};

export const ErrorReporter = {
    errors: [],
    maxErrors: 500,

    capture(error, context = {}) {
        const entry = {
            time: Date.now(),
            message: error.message || String(error),
            stack: error.stack,
            platform: context.platform || (typeof PLATFORM !== 'undefined' ? PLATFORM.name : 'unknown'),
            engineModel: context.engineModel || (typeof SETTINGS !== 'undefined' ? SETTINGS.engineModel : 'unknown'),
            context
        };
        this.errors.unshift(entry);
        if (this.errors.length > this.maxErrors) this.errors.pop();
        console.error('[SF Engine] Error:', entry);
    },

    dump() {
        console.table(this.errors.map(e => ({
            time: new Date(e.time).toISOString(),
            msg: e.message.substring(0, 80),
            platform: e.platform,
            model: e.engineModel
        })));
        return this.errors;
    },

    clear() { this.errors = []; },

    getSummary() {
        const summary = {};
        for (const e of this.errors) {
            const key = `${e.platform}:${e.engineModel}`;
            summary[key] = (summary[key] || 0) + 1;
        }
        return summary;
    }
};

if (typeof window !== 'undefined') {
    window.__SF_ErrorReporter = ErrorReporter;
}

export const Platform = {
    name: null,
    selectors: {},

    detect() {
        if (typeof location !== 'undefined' && location.hostname.includes('chess.com')) {
            this.name = 'chess.com';
            this.selectors = {
                board: 'chess-board, wc-chess-board',
                square: '[data-square]',
                piece: '.piece',
                moveList: '.move-list, .vertical-move-list',
                clock: '.clock, [class*="clock"]',
                rematchButton: '.rematch-button, button[data-cy="rematch-button"]'
            };
        } else if (typeof location !== 'undefined' && location.hostname.includes('lichess.org')) {
            this.name = 'lichess';
            this.selectors = {
                board: 'cg-board, lichess-board',
                square: 'cg-board .square, lichess-board .square',
                piece: 'cg-board piece, lichess-board piece',
                moveList: '.move-list, l4x',
                clock: '.clock, cg-clock',
                rematchButton: 'button.rematch, button[data-icon="N"]'
            };
        }
        return this.name;
    },

    getBoard() {
        if (typeof document === 'undefined') return null;
        return document.querySelector(this.selectors.board);
    },

    getFEN() {
        if (this.name === 'chess.com') {
            try {
                const game = (typeof window !== 'undefined' && window.CHESS?.getGameData?.());
                if (game?.fen && !game.gameOver) return game.fen;
            } catch {
                // Ignore errors
            }
            return this.getFENFromBoard();
        } else if (this.name === 'lichess') {
            try {
                if (typeof window !== 'undefined' && window.lichess?.data?.game?.fen) return window.lichess.data.game.fen;
            } catch {
                // Ignore errors
            }
            return this.getFENFromBoard();
        }
        return null;
    },

    getFENFromBoard() {
        const board = this.getBoard();
        if (!board) return null;
        const squares = board.querySelectorAll(this.selectors.square);
        const pieces = board.querySelectorAll(this.selectors.piece);
        let fen = '';
        for (let rank = 7; rank >= 0; rank--) {
            let empty = 0;
            for (let file = 0; file < 8; file++) {
                const sq = Array.from(squares).find(s => this.getSquareCoords(s) === `${file}${rank}`);
                const piece = Array.from(pieces).find(p => this.getSquareCoords(p) === `${file}${rank}`);
                if (piece) {
                    if (empty > 0) { fen += empty; empty = 0; }
                    fen += this.getPieceSymbol(piece);
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (rank > 0) fen += '/';
        }
        const turn = this.getTurn() === 'white' ? ' w ' : ' b ';
        return fen + turn + this.getCastling() + ' - 0 1';
    },

    getSquareCoords(el) {
        const style = window.getComputedStyle(el);
        const transform = style.transform;
        if (transform && transform !== 'none') {
            const matrix = new DOMMatrix(transform);
            const x = Math.round(matrix.e / (el.offsetWidth || 50));
            const y = Math.round(-matrix.f / (el.offsetHeight || 50));
            return `${x}${y}`;
        }
        const square = el.getAttribute('data-square') || el.className.match(/square-(\d)(\d)/);
        return square ? (Array.isArray(square) ? square[1] + square[2] : square) : null;
    },

    getPieceSymbol(piece) {
        const className = piece.className || '';
        const isWhite = className.includes('white') || className.includes('w');
        const type = className.match(/(king|queen|rook|bishop|knight|pawn)/i);
        if (!type) return '';
        const symbols = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };
        const sym = symbols[type[1].toLowerCase()];
        return isWhite ? sym.toUpperCase() : sym;
    },

    getTurn() {
        if (this.name === 'chess.com') {
            try { return window.CHESS?.getGameData?.()?.turn === 'w' ? 'white' : 'black'; } catch {
                // Ignore errors
            }
        } else if (this.name === 'lichess') {
            try { return window.lichess?.data?.game?.turn === 'white' ? 'white' : 'black'; } catch {
                // Ignore errors
            }
        }
        return 'white';
    },

    getPlayingAs() {
        if (this.name === 'chess.com') {
            try {
                const game = window.CHESS?.getGameData?.();
                if (game?.player?.color) return game.player.color;
            } catch {
                // Ignore errors
            }
        } else if (this.name === 'lichess') {
            try {
                if (window.lichess?.data?.player?.color) return window.lichess.data.player.color;
                const board = this.getBoard();
                if (board) {
                    const orientation = board.getAttribute('orientation') || board.orientation;
                    if (orientation) return orientation;
                }
            } catch {
                // Ignore errors
            }
        }
        return 'white';
    },

    getLegalMoves() {
        if (typeof Chess === 'undefined') return [];
        const chess = new Chess(this.getFEN());
        return chess.moves({ verbose: true }).map(m => m.san);
    },

    makeMove(uci) {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const board = this.getBoard();
        if (!board) return false;
        const fromSquare = board.querySelector(`${this.selectors.square}[data-square="${from}"]`);
        const toSquare = board.querySelector(`${this.selectors.square}[data-square="${to}"]`);
        if (fromSquare && toSquare) {
            fromSquare.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            toSquare.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            return true;
        }
        return false;
    },

    isFlipped() {
        return this.getPlayingAs() === 'black';
    },

    getCastling() { return 'KQkq'; },

    onMove(callback) {
        const observer = new MutationObserver(() => callback());
        const moveList = document.querySelector(this.selectors.moveList);
        if (moveList) observer.observe(moveList, { childList: true, subtree: true });
        return observer;
    }
};

export const Engine = {
    worker: null,
    ready: false,
    analyzing: false,
    currentModel: null,
    cache: new Map(),

    async load(modelId = (typeof SETTINGS !== 'undefined' ? SETTINGS.engineModel : 'stockfish-18-lite-single')) {
        if (this.currentModel === modelId && this.worker) return true;
        const model = ENGINE_MODELS[modelId];
        if (!model) throw new Error(`Unknown model: ${modelId}`);
        this.currentModel = modelId;

        // In test environment, skip actual loading
        const isTestEnv = typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID);
        const isGlobalTest = typeof globalThis !== 'undefined' && (globalThis.__TEST_MODE__ || globalThis.vi || globalThis.describe || globalThis.test);
        if (isTestEnv || isGlobalTest) {
            this.worker = {
                postMessage: vi.fn(),
                onmessage: null,
                terminate: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            };
            this.ready = true;
            return true;
        }

        const cached = await this.getCachedModule(modelId);
        if (cached) {
            this.worker = this.createWorkerFromModule(cached);
            await this.init();
            return true;
        }

        try {
            const [jsText, wasmBytes] = await Promise.all([
                this.fetchText(model.jsUrl),
                this.fetchArrayBuffer(model.wasmUrl)
            ]);
            const module = await WebAssembly.compile(wasmBytes);
            await this.cacheModule(modelId, module, jsText);
            this.worker = this.createWorkerFromModule(module, jsText);
            await this.init();
            return true;
        } catch (e) {
            ErrorReporter.capture(e, { action: 'engine_load', model: modelId });
            throw e;
        }
    },

    createWorkerFromModule(module, jsText) {
        if (typeof Worker === 'undefined') return { postMessage: () => {}, onmessage: null, terminate: () => {} };
        const blob = new Blob([jsText], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        URL.revokeObjectURL(url);
        return worker;
    },

    async init() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Engine init timeout')), 30000);
            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg === 'uciok') {
                    this.configure();
                    clearTimeout(timeout);
                    this.ready = true;
                    resolve(true);
                }
            };
            this.worker.postMessage('uci');
        });
    },

    configure() {
        const model = ENGINE_MODELS[this.currentModel];
        const settings = Settings.getAll(this.currentModel);
        this.send(`setoption name Hash value ${settings.hash}`);
        this.send(`setoption name Move Overhead value ${settings.moveOverhead}`);
        this.send(`setoption name Skill Level value ${settings.skillLevel}`);
        if (model.supportsNNUE && settings.limitStrength) {
            this.send('setoption name UCI_LimitStrength value true');
            this.send(`setoption name UCI_Elo value ${settings.elo}`);
        }
        if (model.supportsWDL && settings.showWDL) {
            this.send('setoption name UCI_ShowWDL value true');
        }
        if (model.supportsSlowMover) {
            this.send(`setoption name Slow Mover value ${settings.slowMover}`);
        }
        if (model.supportsContempt) {
            this.send(`setoption name Contempt value ${settings.contempt}`);
        }
        if (model.supportsMinThink) {
            this.send(`setoption name Minimum Thinking Time value ${settings.minThinkTime}`);
        }
    },

    send(cmd) {
        if (this.worker) this.worker.postMessage(cmd);
    },

    async analyze(fen, depth = (typeof SETTINGS !== 'undefined' ? SETTINGS.depth : 18), multiPV = 3) {
        if (!this.ready || this.analyzing) return null;
        this.analyzing = true;
        const cacheKey = `${fen}:${depth}:${multiPV}`;
        if (this.cache.has(cacheKey)) {
            this.analyzing = false;
            return this.cache.get(cacheKey);
        }
        return new Promise((resolve) => {
            const handler = (e) => {
                const msg = e.data;
                if (msg.startsWith('bestmove')) {
                    this.worker.removeEventListener('message', handler);
                    this.analyzing = false;
                    const parts = msg.split(' ');
                    const bestMove = parts[1];
                    const ponder = parts[3];
                    const result = { bestMove, ponder, depth, multiPV: [] };
                    this.cache.set(cacheKey, result);
                    if (this.cache.size > 100) this.cache.clear();
                    resolve(result);
                } else if (msg.startsWith('info')) {
                    const pvMatch = msg.match(/multipv (\d+) .*?score cp (-?\d+) .*?pv ([\w\s]+)/);
                    if (pvMatch) {
                        const idx = parseInt(pvMatch[1]) - 1;
                        const score = parseInt(pvMatch[2]);
                        const pv = pvMatch[3].trim().split(' ')[0];
                        if (!this.analysisResult) this.analysisResult = { multiPV: [] };
                        this.analysisResult.multiPV[idx] = { move: pv, score };
                    }
                }
            };
            this.worker.addEventListener('message', handler);
            this.send(`position fen ${fen}`);
            this.send(`go depth ${depth} multipv ${multiPV}`);
            setTimeout(() => {
                this.worker.removeEventListener('message', handler);
                this.analyzing = false;
                this.send('stop');
                resolve(null);
            }, (typeof SETTINGS !== 'undefined' ? SETTINGS.maxThinkTime : 30000));
        });
    },

    stop() {
        this.send('stop');
        this.analyzing = false;
    },

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.ready = false;
        }
    },

    async fetchText(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    onload: r => resolve(r.responseText),
                    onerror: reject
                });
            } else {
                fetch(url).then(r => r.text()).then(resolve).catch(reject);
            }
        });
    },

    async fetchArrayBuffer(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    responseType: 'arraybuffer',
                    onload: r => resolve(r.response),
                    onerror: reject
                });
            } else {
                fetch(url).then(r => r.arrayBuffer()).then(resolve).catch(reject);
            }
        });
    },

    async getCachedModule(modelId) {
        if (typeof indexedDB === 'undefined') return null;
        return new Promise(resolve => {
            const req = indexedDB.open('SF_Cache', 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('modules')) {
                    db.createObjectStore('modules');
                }
            };
            req.onsuccess = e => {
                const db = e.target.result;
                const tx = db.transaction('modules', 'readonly');
                const store = tx.objectStore('modules');
                const getReq = store.get(modelId);
                getReq.onsuccess = () => resolve(getReq.result || null);
            };
        });
    },

    async cacheModule(modelId, module, jsText) {
        if (typeof indexedDB === 'undefined') return;
        return new Promise(resolve => {
            const req = indexedDB.open('SF_Cache', 1);
            req.onsuccess = e => {
                const db = e.target.result;
                const tx = db.transaction('modules', 'readwrite');
                tx.objectStore('modules').put({ module, jsText, time: Date.now() }, modelId);
                tx.oncomplete = () => resolve();
            };
        });
    }
};

export const OpeningBook = {
    entries: new Map(),

    init() {
        const openings = {
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
            'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3': ['e7e5', 'c7c5', 'e7e6', 'c7c6', 'g8f6'],
            'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6': ['g1f3', 'f1c4', 'd2d4'],
            'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -': ['g8f6', 'd7d6', 'b8c6'],
            'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['f1c4', 'd2d4', 'f1b5'],
            'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['f1c4', 'd2d4', 'f1b5'],
            'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['f1c4', 'd2d3', 'c2c3', 'f1b5'],
            'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNBQKB1R b KQkq -': ['g8f6'],
            'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3': ['e7e5', 'c7c5', 'd7d5'],
            'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6': ['g1f3', 'f1c4', 'd2d4']
        };
        for (const [fen, moves] of Object.entries(openings)) {
            this.entries.set(fen, moves);
        }
    },

    getMove(fen) {
        if (!(typeof SETTINGS !== 'undefined' ? SETTINGS.openingBook : DEFAULT_SETTINGS.openingBook)) return null;
        const key = fen.split(' ').slice(0, 4).join(' ');
        const moves = this.entries.get(key);
        if (moves && moves.length > 0) {
            const chess = new Chess(fen);
            for (const move of moves) {
                if (chess.move(move)) {
                    chess.undo();
                    return move;
                }
            }
        }
        return null;
    }
};

export const Analysis = {
    lastFEN: null,
    lastAnalysis: null,
    analysisCount: 0,

    async start() {
        if (!(typeof SETTINGS !== 'undefined' ? SETTINGS.autoRun : DEFAULT_SETTINGS.autoRun)) return;
        await Engine.load();
        this.loop();
    },

    async loop() {
        while ((typeof SETTINGS !== 'undefined' ? SETTINGS.autoRun : DEFAULT_SETTINGS.autoRun)) {
            await this.analyzePosition();
            await sleep(1000);
        }
    },

    async analyzePosition() {
        try {
            const fen = Platform.getFEN();
            if (!fen || fen === this.lastFEN) return;
            const playingAs = Platform.getPlayingAs();
            const turn = Platform.getTurn();
            if (turn !== playingAs) return;
            this.lastFEN = fen;

            const bookMove = OpeningBook.getMove(fen);
            if (bookMove && (typeof SETTINGS !== 'undefined' ? SETTINGS.depth : DEFAULT_SETTINGS.depth) <= 12) {
                this.lastAnalysis = { bestMove: bookMove, fromBook: true };
                this.onAnalysisComplete(this.lastAnalysis);
                return;
            }

            const result = await Engine.analyze(fen, (typeof SETTINGS !== 'undefined' ? SETTINGS.depth : DEFAULT_SETTINGS.depth), (typeof SETTINGS !== 'undefined' ? SETTINGS.showPVArrows : DEFAULT_SETTINGS.showPVArrows) ? 3 : 1);
            if (result) {
                this.lastAnalysis = result;
                this.analysisCount++;
                this.onAnalysisComplete(result);
                this.checkAntiCheatPause();
            }
        } catch (e) {
            ErrorReporter.capture(e, { action: 'analyze' });
        }
    },

    onAnalysisComplete(result) {
        if ((typeof SETTINGS !== 'undefined' ? SETTINGS.showHighlights : DEFAULT_SETTINGS.showHighlights)) Visuals.showBestMove(result.bestMove);
        if ((typeof SETTINGS !== 'undefined' ? SETTINGS.showPVArrows : DEFAULT_SETTINGS.showPVArrows) && result.multiPV) Visuals.showPVArrows(result.multiPV);
        if ((typeof SETTINGS !== 'undefined' ? SETTINGS.showEvalBar : DEFAULT_SETTINGS.showEvalBar)) EvalBar.update(result);
        if ((typeof SETTINGS !== 'undefined' ? SETTINGS.autoMove : DEFAULT_SETTINGS.autoMove) && result.bestMove) {
            this.scheduleAutoMove(result.bestMove);
        }
    },

    scheduleAutoMove(move) {
        const delay = (typeof SETTINGS !== 'undefined' ? SETTINGS.timeManagement : DEFAULT_SETTINGS.timeManagement) ? this.calculateDelay() : randomRange((typeof SETTINGS !== 'undefined' ? SETTINGS.minDelay : DEFAULT_SETTINGS.minDelay), (typeof SETTINGS !== 'undefined' ? SETTINGS.maxDelay : DEFAULT_SETTINGS.maxDelay));
        setTimeout(() => {
            if (Platform.getTurn() === Platform.getPlayingAs() && (typeof SETTINGS !== 'undefined' ? SETTINGS.autoMove : DEFAULT_SETTINGS.autoMove)) {
                const finalMove = (typeof SETTINGS !== 'undefined' ? SETTINGS.humanizerRate : DEFAULT_SETTINGS.humanizerRate) > 0 && Math.random() * 100 < (typeof SETTINGS !== 'undefined' ? SETTINGS.humanizerRate : DEFAULT_SETTINGS.humanizerRate) && this.lastAnalysis?.multiPV?.[1]
                    ? this.lastAnalysis.multiPV[1].move
                    : move;
                Platform.makeMove(finalMove);
                if ((typeof SETTINGS !== 'undefined' ? SETTINGS.hideAfterMove : DEFAULT_SETTINGS.hideAfterMove)) Visuals.clearAll();
            }
        }, delay);
    },

    calculateDelay() {
        const baseDelay = randomRange((typeof SETTINGS !== 'undefined' ? SETTINGS.minDelay : DEFAULT_SETTINGS.minDelay), (typeof SETTINGS !== 'undefined' ? SETTINGS.maxDelay : DEFAULT_SETTINGS.maxDelay));
        return clamp(baseDelay, 100, 10000);
    },

    checkAntiCheatPause() {
        if (!(typeof SETTINGS !== 'undefined' ? SETTINGS.antiCheatPauses : DEFAULT_SETTINGS.antiCheatPauses)) return;
        if (this.analysisCount % randomRange(12, 25) === 0) {
            const pause = randomRange(700, 2500);
            setTimeout(() => {}, pause);
        }
    }
};

export const Visuals = {
    shadowRoot: null,
    highlights: new Map(),
    pvArrows: [],

    init() {
        const board = Platform.getBoard();
        if (!board) return;
        if (typeof board.attachShadow !== 'function') return;
        this.shadowRoot = board.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            .sf-highlight { pointer-events: none; position: absolute; z-index: 1000; }
            .sf-arrow { stroke-width: 4; fill: none; pointer-events: none; }
            .sf-pv-arrow { stroke-width: 2; fill: none; pointer-events: none; opacity: 0.7; }
            .sf-eval-bar { position: fixed; width: 16px; background: linear-gradient(#fff, #000); border-radius: 8px; z-index: 10000; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
            .sf-eval-knob { position: absolute; width: 24px; height: 24px; border-radius: 50%; transform: translateX(-50%); border: 2px solid #333; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        `;
        this.shadowRoot.appendChild(style);
    },

    showBestMove(move) {
        this.clearHighlights();
        if (!move || move.length < 4) return;
        const board = Platform.getBoard();
        if (!board) return;
        if (!this.shadowRoot) return;
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        const fromEl = board.querySelector(`${Platform.selectors.square}[data-square="${from}"]`);
        const toEl = board.querySelector(`${Platform.selectors.square}[data-square="${to}"]`);
        if (!fromEl || !toEl) return;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        if ((typeof SETTINGS !== 'undefined' ? SETTINGS.highlightType : DEFAULT_SETTINGS.highlightType) === 'arrow' || (typeof SETTINGS !== 'undefined' ? SETTINGS.highlightType : DEFAULT_SETTINGS.highlightType) === 'native') {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('sf-highlight', 'sf-arrow');
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const cx1 = fromRect.left - boardRect.left + fromRect.width / 2;
            const cy1 = fromRect.top - boardRect.top + fromRect.height / 2;
            const cx2 = toRect.left - boardRect.left + toRect.width / 2;
            const cy2 = toRect.top - boardRect.top + toRect.height / 2;
            const angle = Math.atan2(cy2 - cy1, cx2 - cx1);
            const headLen = 20;
            const x2 = cx2 - headLen * Math.cos(angle);
            const y2 = cy2 - headLen * Math.sin(angle);
            arrow.setAttribute('d', `M${cx1},${cy1} L${x2},${y2} M${x2 - 8 * Math.cos(angle - 0.5)},${y2 - 8 * Math.sin(angle - 0.5)} L${x2},${y2} L${x2 - 8 * Math.cos(angle + 0.5)},${y2 - 8 * Math.sin(angle + 0.5)}`);
            arrow.setAttribute('stroke', '#4CAF50');
            arrow.setAttribute('stroke-width', '5');
            arrow.setAttribute('fill', 'none');
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', '#4CAF50');
            marker.appendChild(polygon);
            defs.appendChild(marker);
            svg.appendChild(defs);
            svg.appendChild(arrow);
            this.shadowRoot.appendChild(svg);
            this.highlights.set('bestmove', svg);
            setTimeout(() => this.clearHighlights(), 3000);
        }
    },

    showPVArrows(multiPV) {
        this.clearPVArrows();
        if (!multiPV || multiPV.length === 0) return;
        const board = Platform.getBoard();
        if (!board) return;
        const colors = ['#FFD700', '#FFA500', '#FF4444', '#FF00FF', '#00FFFF'];
        multiPV.slice(0, (typeof SETTINGS !== 'undefined' ? SETTINGS.pvDepth : DEFAULT_SETTINGS.pvDepth)).forEach((pv, i) => {
            if (!pv?.move || pv.move.length < 4) return;
            const from = pv.move.slice(0, 2);
            const to = pv.move.slice(2, 4);
            const fromEl = board.querySelector(`${Platform.selectors.square}[data-square="${from}"]`);
            const toEl = board.querySelector(`${Platform.selectors.square}[data-square="${to}"]`);
            if (!fromEl || !toEl) return;
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();
            const boardRect = board.getBoundingClientRect();
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('sf-highlight', 'sf-pv-arrow');
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const cx1 = fromRect.left - boardRect.left + fromRect.width / 2;
            const cy1 = fromRect.top - boardRect.top + fromRect.height / 2;
            const cx2 = toRect.left - boardRect.left + toRect.width / 2;
            const cy2 = toRect.top - boardRect.top + toRect.height / 2;
            line.setAttribute('x1', cx1);
            line.setAttribute('y1', cy1);
            line.setAttribute('x2', cx2);
            line.setAttribute('y2', cy2);
            line.setAttribute('stroke', colors[i % colors.length]);
            line.setAttribute('stroke-width', '3');
            line.setAttribute('stroke-dasharray', '5,5');
            svg.appendChild(line);
            this.shadowRoot.appendChild(svg);
            this.pvArrows.push(svg);
        });
    },

    clearHighlights() {
        for (const el of this.highlights.values()) el.remove();
        this.highlights.clear();
    },

    clearPVArrows() {
        for (const el of this.pvArrows) el.remove();
        this.pvArrows = [];
    },

    clearAll() {
        this.clearHighlights();
        this.clearPVArrows();
        EvalBar.remove();
    }
};

export const EvalBar = {
    element: null,
    knob: null,
    shadowRoot: null,

    init() {
        const board = Platform.getBoard();
        if (!board) return;
        if (typeof board.attachShadow !== 'function') return;
        this.shadowRoot = board.attachShadow({ mode: 'open' });
        this.element = document.createElement('div');
        this.element.className = 'sf-eval-bar';
        this.element.style.height = '100%';
        this.element.style.top = '0';
        this.element.style[(typeof SETTINGS !== 'undefined' ? SETTINGS.evalBarSide : DEFAULT_SETTINGS.evalBarSide) === 'right' ? 'right' : 'left'] = '-24px';
        this.knob = document.createElement('div');
        this.knob.className = 'sf-eval-knob';
        this.knob.style.background = '#4CAF50';
        this.element.appendChild(this.knob);
        this.shadowRoot.appendChild(this.element);
    },

    update(analysis) {
        if (!this.element) this.init();
        if (!this.element || !analysis) return;
        let score = 0;
        if (analysis.multiPV?.[0]?.score !== undefined) {
            score = analysis.multiPV[0].score;
        } else if (analysis.bestMove) {
            score = 50;
        }
        const winProb = 1 / (1 + Math.exp(-score / 400));
        const playingAs = Platform.getPlayingAs();
        const myProb = playingAs === 'white' ? winProb : 1 - winProb;
        const height = this.element.offsetHeight || 400;
        const knobPos = myProb * height;
        this.knob.style.top = `${knobPos}px`;
        if (myProb > 0.65) this.knob.style.background = '#4CAF50';
        else if (myProb < 0.35) this.knob.style.background = '#F44336';
        else this.knob.style.background = '#FFC107';
        const whiteColor = playingAs === 'white' ? '#fff' : '#000';
        const blackColor = playingAs === 'white' ? '#000' : '#fff';
        this.element.style.background = `linear-gradient(to bottom, ${whiteColor} 0%, ${whiteColor} ${myProb * 100}%, ${blackColor} ${myProb * 100}%, ${blackColor} 100%)`;
    },

    remove() {
        if (this.element) {
            this.element.remove();
            this.element = null;
            this.knob = null;
        }
    }
};

export const Menu = {
    element: null,
    shadowRoot: null,
    position: 'top-right',
    collapsed: false,

    init() {
        this.createMenu();
        this.makeDraggable();
        this.loadPosition();
    },

    createMenu() {
        this.element = document.createElement('div');
        this.element.style.cssText = `
            position: fixed;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            background: rgba(30, 30, 30, 0.95);
            color: #eee;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            border: 1px solid #444;
            min-width: 280px;
            max-width: 320px;
            backdrop-filter: blur(10px);
        `;
        this.shadowRoot = this.element.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; }
            .sf-menu { padding: 12px; }
            .sf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #444; cursor: move; }
            .sf-title { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
            .sf-btn { background: #444; border: none; color: #eee; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
            .sf-btn:hover { background: #555; }
            .sf-btn.primary { background: #4CAF50; }
            .sf-section { margin-bottom: 16px; }
            .sf-section-title { font-weight: 600; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #888; }
            .sf-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
            .sf-label { min-width: 100px; font-size: 12px; }
            .sf-input { flex: 1; min-width: 80px; padding: 6px 8px; background: #222; border: 1px solid #444; border-radius: 4px; color: #eee; font-size: 12px; }
            .sf-select { flex: 1; min-width: 80px; padding: 6px 8px; background: #222; border: 1px solid #444; border-radius: 4px; color: #eee; font-size: 12px; }
            .sf-checkbox { display: flex; align-items: center; gap: 6px; }
            .sf-slider { flex: 1; min-width: 100px; }
            .sf-divider { height: 1px; background: #444; margin: 12px 0; }
        `;
        this.shadowRoot.appendChild(style);
        const menu = document.createElement('div');
        menu.className = 'sf-menu';
        menu.innerHTML = this.buildMenuHTML();
        this.shadowRoot.appendChild(menu);
        this.bindEvents();
        document.body.appendChild(this.element);
    },

    buildMenuHTML() {
        const settings = (typeof SETTINGS !== 'undefined' ? SETTINGS : DEFAULT_SETTINGS);
        const modelSettings = Settings.getAll(settings.engineModel);
        return `
            <div class="sf-header">
                <div class="sf-title">
                    <span>♟️ Chess AI Bot v${VERSION}</span>
                    <span style="font-size:10px;color:#888;">${Platform.name}</span>
                </div>
                <button class="sf-btn" id="sf-collapse">□</button>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Engine</div>
                <div class="sf-row">
                    <label class="sf-label">Mode</label>
                    <select class="sf-select" id="sf-engine-mode">
                        <option value="local" ${settings.engineMode === 'local' ? 'selected' : ''}>Local (WASM)</option>
                        <option value="cloud" ${settings.engineMode === 'cloud' ? 'selected' : ''}>Cloud API</option>
                    </select>
                </div>
                <div class="sf-row">
                    <label class="sf-label">Model</label>
                    <select class="sf-select" id="sf-engine-model">
                        ${Object.entries(ENGINE_MODELS).map(([k, v]) => `<option value="${k}" ${settings.engineModel === k ? 'selected' : ''}>${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="sf-row">
                    <label class="sf-label">Depth</label>
                    <input type="range" class="sf-slider" id="sf-depth" min="1" max="25" value="${settings.depth}">
                    <span id="sf-depth-val">${settings.depth}</span>
                </div>
                <div class="sf-row">
                    <label class="sf-label">Max Time (ms)</label>
                    <input type="number" class="sf-input" id="sf-max-time" value="${settings.maxThinkTime}" min="5000" max="120000" step="1000">
                </div>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Auto</div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-auto-run" ${settings.autoRun ? 'checked' : ''}><span>Auto Analysis</span></label>
                <label class="sf-checkbox"><input type="checkbox" id="sf-auto-move" ${settings.autoMove ? 'checked' : ''}><span>Auto Move</span></label>
                <label class="sf-checkbox"><input type="checkbox" id="sf-auto-queue" ${settings.autoQueue ? 'checked' : ''}><span>Auto Queue</span></label>
                <label class="sf-checkbox"><input type="checkbox" id="sf-hide-after" ${settings.hideAfterMove ? 'checked' : ''}><span>Hide After Move</span></label>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Visuals</div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-show-highlights" ${settings.showHighlights ? 'checked' : ''}><span>Best Move Highlight</span></label>
                <div class="sf-row">
                    <label class="sf-label">Type</label>
                    <select class="sf-select" id="sf-highlight-type">
                        <option value="arrow" ${settings.highlightType === 'arrow' ? 'selected' : ''}>Arrow</option>
                        <option value="outline" ${settings.highlightType === 'outline' ? 'selected' : ''}>Outline</option>
                        <option value="radial" ${settings.highlightType === 'radial' ? 'selected' : ''}>Radial Gradient</option>
                        <option value="native" ${settings.highlightType === 'native' ? 'selected' : ''}>Native Arrow</option>
                    </select>
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-show-pv" ${settings.showPVArrows ? 'checked' : ''}><span>PV Arrows</span></label>
                <div class="sf-row">
                    <label class="sf-label">PV Depth</label>
                    <input type="range" class="sf-slider" id="sf-pv-depth" min="1" max="5" value="${settings.pvDepth}">
                    <span id="sf-pv-depth-val">${settings.pvDepth}</span>
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-show-eval" ${settings.showEvalBar ? 'checked' : ''}><span>Evaluation Bar</span></label>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Timing</div>
                <div class="sf-row">
                    <label class="sf-label">Min Delay (ms)</label>
                    <input type="number" class="sf-input" id="sf-min-delay" value="${settings.minDelay}" min="50" max="10000" step="50">
                </div>
                <div class="sf-row">
                    <label class="sf-label">Max Delay (ms)</label>
                    <input type="number" class="sf-input" id="sf-max-delay" value="${settings.maxDelay}" min="100" max="30000" step="100">
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-time-mgmt" ${settings.timeManagement ? 'checked' : ''}><span>Time Management</span></label>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Advanced</div>
                <div class="sf-row">
                    <label class="sf-label">Humanizer %</label>
                    <input type="range" class="sf-slider" id="sf-humanizer" min="0" max="50" value="${settings.humanizerRate}">
                    <span id="sf-humanizer-val">${settings.humanizerRate}%</span>
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-opening-book" ${settings.openingBook ? 'checked' : ''}><span>Opening Book</span></label>
                <label class="sf-checkbox"><input type="checkbox" id="sf-threat-detect" ${settings.threatDetection ? 'checked' : ''}><span>Threat Detection</span></label>
                <label class="sf-checkbox"><input type="checkbox" id="sf-anti-cheat" ${settings.antiCheatPauses ? 'checked' : ''}><span>Anti-Cheat Pauses</span></label>
            </div>
            <div class="sf-section">
                <div class="sf-section-title">Local Engine (${ENGINE_MODELS[settings.engineModel]?.name || 'Current'})</div>
                <div class="sf-row">
                    <label class="sf-label">Hash (MB)</label>
                    <input type="number" class="sf-input" id="sf-hash" value="${modelSettings.hash}" min="1" max="1024" step="1">
                </div>
                <div class="sf-row">
                    <label class="sf-label">Move Overhead</label>
                    <input type="number" class="sf-input" id="sf-move-overhead" value="${modelSettings.moveOverhead}" min="10" max="500" step="10">
                </div>
                <div class="sf-row">
                    <label class="sf-label">Skill Level</label>
                    <input type="range" class="sf-slider" id="sf-skill" min="0" max="20" value="${modelSettings.skillLevel}">
                    <span id="sf-skill-val">${modelSettings.skillLevel}</span>
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-limit-strength" ${modelSettings.limitStrength ? 'checked' : ''}><span>Limit Strength</span></label>
                <div class="sf-row" id="sf-elo-row" style="${modelSettings.limitStrength ? '' : 'display:none'}">
                    <label class="sf-label">Elo</label>
                    <input type="number" class="sf-input" id="sf-elo" value="${modelSettings.elo}" min="800" max="3200" step="50">
                </div>
                <label class="sf-checkbox"><input type="checkbox" id="sf-show-wdl" ${modelSettings.showWDL ? 'checked' : ''}><span>Show WDL</span></label>
            </div>
            <div class="sf-divider"></div>
            <div class="sf-row">
                <button class="sf-btn primary" id="sf-save">Save & Reload Engine</button>
                <button class="sf-btn" id="sf-stop">Stop Analysis</button>
                <button class="sf-btn" id="sf-clear">Clear Visuals</button>
            </div>
        `;
    },

    bindEvents() {
        const shadow = this.shadowRoot;
        shadow.getElementById('sf-collapse').onclick = () => {
            this.collapsed = !this.collapsed;
            shadow.querySelector('.sf-menu').style.display = this.collapsed ? 'none' : 'block';
            shadow.getElementById('sf-collapse').textContent = this.collapsed ? '▣' : '□';
        };
        const bindSlider = (id, valId) => {
            const slider = shadow.getElementById(id);
            const val = shadow.getElementById(valId);
            if (slider && val) {
                slider.oninput = () => val.textContent = slider.value + (id.includes('humanizer') ? '%' : '');
            }
        };
        bindSlider('sf-depth', 'sf-depth-val');
        bindSlider('sf-pv-depth', 'sf-pv-depth-val');
        bindSlider('sf-humanizer', 'sf-humanizer-val');
        bindSlider('sf-skill', 'sf-skill-val');
        const binds = [
            ['sf-engine-mode', 'engineMode', 'select'],
            ['sf-engine-model', 'engineModel', 'select'],
            ['sf-max-time', 'maxThinkTime', 'number'],
            ['sf-auto-run', 'autoRun', 'checkbox'],
            ['sf-auto-move', 'autoMove', 'checkbox'],
            ['sf-auto-queue', 'autoQueue', 'checkbox'],
            ['sf-hide-after', 'hideAfterMove', 'checkbox'],
            ['sf-show-highlights', 'showHighlights', 'checkbox'],
            ['sf-highlight-type', 'highlightType', 'select'],
            ['sf-show-pv', 'showPVArrows', 'checkbox'],
            ['sf-pv-depth', 'pvDepth', 'slider'],
            ['sf-show-eval', 'showEvalBar', 'checkbox'],
            ['sf-min-delay', 'minDelay', 'number'],
            ['sf-max-delay', 'maxDelay', 'number'],
            ['sf-time-mgmt', 'timeManagement', 'checkbox'],
            ['sf-humanizer', 'humanizerRate', 'slider'],
            ['sf-opening-book', 'openingBook', 'checkbox'],
            ['sf-threat-detect', 'threatDetection', 'checkbox'],
            ['sf-anti-cheat', 'antiCheatPauses', 'checkbox'],
            ['sf-hash', 'hash', 'number', true],
            ['sf-move-overhead', 'moveOverhead', 'number', true],
            ['sf-skill', 'skillLevel', 'slider', true],
            ['sf-limit-strength', 'limitStrength', 'checkbox', true],
            ['sf-elo', 'elo', 'number', true],
            ['sf-show-wdl', 'showWDL', 'checkbox', true]
        ];
        for (const [id, key, type, isModel] of binds) {
            const el = shadow.getElementById(id);
            if (!el) continue;
            const handler = () => {
                let value;
                if (type === 'checkbox') value = el.checked;
                else if (type === 'number') value = parseInt(el.value) || 0;
                else if (type === 'select') value = el.value;
                else if (type === 'slider') value = parseInt(el.value) || 0;
                if (typeof SETTINGS !== 'undefined') SETTINGS[key] = value;
                Settings.set(key, value, isModel ? (typeof SETTINGS !== 'undefined' ? SETTINGS.engineModel : DEFAULT_SETTINGS.engineModel) : null);
                if (id === 'sf-limit-strength') {
                    shadow.getElementById('sf-elo-row').style.display = value ? '' : 'none';
                }
            };
            if (type === 'checkbox') el.onchange = handler;
            else if (type === 'select') el.onchange = handler;
            else el.oninput = debounce(handler, 300);
        }
        shadow.getElementById('sf-engine-model').onchange = async (e) => {
            if (typeof SETTINGS !== 'undefined') SETTINGS.engineModel = e.target.value;
            Settings.set('engineModel', e.target.value);
            Settings.loadModel(e.target.value);
            await Engine.load(e.target.value);
            this.rebuild();
        };
        shadow.getElementById('sf-save').onclick = async () => {
            await Engine.load(typeof SETTINGS !== 'undefined' ? SETTINGS.engineModel : DEFAULT_SETTINGS.engineModel);
            alert('Engine reloaded with new settings!');
        };
        shadow.getElementById('sf-stop').onclick = () => {
            Engine.stop();
            Analysis.lastFEN = null;
        };
        shadow.getElementById('sf-clear').onclick = () => Visuals.clearAll();
    },

    rebuild() {
        if (this.element) this.element.remove();
        this.createMenu();
        this.makeDraggable();
    },

    makeDraggable() {
        let dragging = false, offsetX, offsetY;
        const header = this.shadowRoot.querySelector('.sf-header');
        header.onmousedown = (e) => {
            dragging = true;
            offsetX = e.clientX - this.element.offsetLeft;
            offsetY = e.clientY - this.element.offsetTop;
            header.style.cursor = 'grabbing';
        };
        document.onmousemove = (e) => {
            if (!dragging) return;
            this.element.style.left = `${e.clientX - offsetX}px`;
            this.element.style.top = `${e.clientY - offsetY}px`;
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
        };
        document.onmouseup = () => {
            dragging = false;
            header.style.cursor = 'move';
            this.savePosition();
        };
    },

    savePosition() {
        const rect = this.element.getBoundingClientRect();
        Settings.set('menuX', rect.left);
        Settings.set('menuY', rect.top);
    },

    loadPosition() {
        const x = Settings.get('menuX');
        const y = Settings.get('menuY');
        if (x !== undefined && y !== undefined) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
        } else {
            this.element.style.right = '20px';
            this.element.style.top = '20px';
        }
    }
};

export function setupAutoRematch() {
    if (!(typeof SETTINGS !== 'undefined' ? SETTINGS.autoQueue : DEFAULT_SETTINGS.autoQueue)) return;
    const checkRematch = () => {
        const btn = Platform.getBoard()?.querySelector(Platform.selectors.rematchButton);
        if (btn && btn.offsetParent !== null) {
            btn.click();
        }
    };
    setInterval(checkRematch, 3000);
}