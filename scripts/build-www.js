#!/usr/bin/env node
/**
 * Copies the static web app into ./www so Capacitor can bundle it
 * into the iOS / Android native projects. Run before `npx cap sync`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');

const INCLUDE_FILES = [
    'index.html',
    'azkar.html',
    'bio.html',
    'bookmarks.html',
    'features.html',
    'home-more.html',
    'khatma.html',
    'masbaha.html',
    'prayer-times.html',
    'quran.html',
    'settings.html',
    'sunan.html',
    'sw.js',
];

const INCLUDE_DIRS = ['css', 'js', 'data', 'assets'];

function rmrf(target) {
    if (!fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else if (entry.isFile()) fs.copyFileSync(s, d);
    }
}

console.log(`[build-www] cleaning ${OUT}`);
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

for (const file of INCLUDE_FILES) {
    const src = path.join(ROOT, file);
    if (!fs.existsSync(src)) {
        console.warn(`[build-www] skip missing file: ${file}`);
        continue;
    }
    fs.copyFileSync(src, path.join(OUT, file));
}

for (const dir of INCLUDE_DIRS) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) {
        console.warn(`[build-www] skip missing dir: ${dir}`);
        continue;
    }
    copyDir(src, path.join(OUT, dir));
}

console.log(`[build-www] done -> ${OUT}`);
