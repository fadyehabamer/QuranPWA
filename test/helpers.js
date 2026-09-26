'use strict';

// The app ships classic browser scripts (no modules, no bundler) that attach
// their API to window / self. These helpers run the real source files inside a
// function scope whose parameters shadow the browser globals they touch, so
// each test controls localStorage, fetch, the clock, caches, etc.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/**
 * Execute `source` with the given globals in scope. `expose` names top-level
 * bindings (e.g. functions declared in sw.js) to hand back to the caller.
 */
function runSource(source, globals = {}, expose = []) {
  const names = Object.keys(globals);
  const body = expose.length
    ? `${source}\n;return { ${expose.join(', ')} };`
    : source;
  const fn = new Function(...names, body);
  return fn(...names.map((name) => globals[name]));
}

function loadScript(relPath, globals, expose) {
  return runSource(readSource(relPath), globals, expose);
}

/** Map-backed stand-in for window.localStorage. */
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    get length() { return map.size; },
    _map: map
  };
}

/** A localStorage whose every access throws, as in a blocked/private context. */
function createBlockedStorage() {
  const fail = () => { throw new Error('SecurityError: storage blocked'); };
  return { getItem: fail, setItem: fail, removeItem: fail, clear: fail };
}

/**
 * A Date class frozen at `instant`: `new Date()` and `Date.now()` return it,
 * while `new Date(...args)` behaves normally.
 */
function frozenDate(instant) {
  const fixed = new Date(instant).getTime();
  return class FrozenDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }

    static now() {
      return fixed;
    }
  };
}

/**
 * In-memory CacheStorage. Keys are absolute URLs; root-relative strings are
 * resolved against `origin`, and `{ ignoreSearch: true }` drops the query.
 */
function createCaches(origin = 'https://app.test') {
  const stores = new Map();
  const keyOf = (req, opts) => {
    let url = typeof req === 'string' ? req : req.url;
    if (url.startsWith('/')) url = origin + url;
    return opts && opts.ignoreSearch ? url.split('?')[0] : url;
  };
  function cacheFor(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      match: async (req, opts) => map.get(keyOf(req, opts)),
      put: async (req, response) => { map.set(keyOf(req), response); },
      delete: async (req, opts) => map.delete(keyOf(req, opts)),
      keys: async () => [...map.keys()].map((url) => ({ url }))
    };
  }
  return {
    open: async (name) => cacheFor(name),
    delete: async (name) => stores.delete(name),
    keys: async () => [...stores.keys()],
    match: async (req, opts) => {
      for (const map of stores.values()) {
        const hit = map.get(keyOf(req, opts));
        if (hit) return hit;
      }
      return undefined;
    },
    urls: (name) => [...(stores.get(name) || new Map()).keys()]
  };
}

module.exports = {
  createCaches,
  ROOT,
  readSource,
  runSource,
  loadScript,
  createStorage,
  createBlockedStorage,
  frozenDate
};
