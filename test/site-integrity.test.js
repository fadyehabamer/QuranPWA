'use strict';

// Static checks for a no-build static site: nothing compiles these files, so
// a typo in a path, a JSON file or a script only shows up in production.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readSource } = require('./helpers');

const HTML_PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

function listJs(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(rel);
    return entry.name.endsWith('.js') ? [rel] : [];
  });
}

/** Resolve a site URL the way Vercel serves it (cleanUrls: /quran -> quran.html). */
function existsOnSite(url) {
  const clean = url.split(/[?#]/)[0].replace(/^\//, '');
  const candidates = clean === '' ? ['index.html'] : [clean, `${clean}.html`];
  return candidates.some((rel) => fs.existsSync(path.join(ROOT, rel)));
}

const isLocal = (url) => !/^(https?:|tel:|mailto:|data:|#|javascript:)/.test(url) && !url.startsWith('//');

function scriptsOf(page) {
  return [...readSource(page).matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
    .map((m) => m[1].replace(/^\//, ''));
}

test('every JavaScript file parses as a classic script', () => {
  const files = [...listJs('js'), 'sw.js'];
  assert.ok(files.length > 20);
  for (const file of files) {
    assert.doesNotThrow(() => new vm.Script(readSource(file), { filename: file }), file);
  }
});

test('every local src/href in the HTML pages points at a real file or page', () => {
  const broken = [];
  for (const page of HTML_PAGES) {
    const html = readSource(page);
    for (const [, url] of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
      if (isLocal(url) && !existsOnSite(url)) broken.push(`${page}: ${url}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('pages load the shared data/engine scripts their page script depends on, first', () => {
  const dependencies = [
    [/\bPrayerEngine\b/, 'js/prayer-core.js'],
    [/\bQURAN_INDEX\b/, 'js/data/quran-index.js'],
    [/\bQURAN_SURAH|\bgetSurah(Name|Info|Juz)\b/, 'js/data/surahs.js'],
    [/\bOfflineQuran\b/, 'js/offline-quran.js']
  ];
  const problems = [];

  for (const page of HTML_PAGES) {
    const scripts = scriptsOf(page);
    const pageScript = scripts.find((s) => s.startsWith('js/page-scripts/'));
    if (!pageScript) continue;
    const source = readSource(pageScript);

    for (const [pattern, dep] of dependencies) {
      if (!pattern.test(source)) continue;
      const depAt = scripts.indexOf(dep);
      if (depAt === -1) problems.push(`${page} uses ${dep} but does not load it`);
      else if (depAt > scripts.indexOf(pageScript)) problems.push(`${page} loads ${dep} after ${pageScript}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('notifications.js is always preceded by the store it reads', () => {
  for (const page of HTML_PAGES) {
    const scripts = scriptsOf(page);
    const at = scripts.indexOf('js/notifications.js');
    if (at === -1) continue;
    const store = scripts.indexOf('js/notify-store.js');
    // Pages without the store are tolerated by notifications.js (it no-ops),
    // but when present the store must load first.
    if (store !== -1) assert.ok(store < at, page);
  }
});

test('the web app manifest is valid and its icons and shortcuts resolve', () => {
  const manifest = JSON.parse(readSource('data/manifest.json'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);

  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'installable icon sizes');
  for (const icon of manifest.icons) assert.ok(existsOnSite(icon.src), icon.src);
  for (const shortcut of manifest.shortcuts || []) assert.ok(existsOnSite(shortcut.url), shortcut.url);
});

test('vercel rewrites point at pages that exist', () => {
  const config = JSON.parse(readSource('vercel.json'));
  for (const { source, destination } of config.rewrites) {
    assert.ok(fs.existsSync(path.join(ROOT, destination)), `${source} -> ${destination}`);
  }
});

test('azkar data is well-formed', () => {
  const categories = JSON.parse(readSource('data/azkar.json'));
  assert.ok(Array.isArray(categories) && categories.length > 0);

  const ids = new Set();
  for (const category of categories) {
    assert.ok(!ids.has(category.id), `duplicate category id ${category.id}`);
    ids.add(category.id);
    assert.equal(typeof category.category, 'string');
    assert.ok(category.category.trim().length > 0);
    assert.ok(Array.isArray(category.array) && category.array.length > 0, category.category);

    for (const zikr of category.array) {
      assert.equal(typeof zikr.text, 'string', `${category.category} #${zikr.id}`);
      assert.ok(zikr.text.trim().length > 0, `${category.category} #${zikr.id}`);
      assert.ok(Number.isInteger(zikr.count) && zikr.count >= 1, `${category.category} #${zikr.id} count`);
    }
  }
});
