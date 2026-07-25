#!/usr/bin/env node
/* ==========================================================================
   Pre-flight checks for plebbian.com

   Runs in CI on every pull request into live-website, and is worth running
   locally before opening one:

       node scripts/verify.js

   Exits non-zero on the first category that fails, listing every problem.
   These are the checks that have actually caught real breakage on this repo:
   dead asset references, unresolvable anchors, emoji sneaking back in as
   icons, and text colours dropping below WCAG AA.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'portfolio.html', '404.html'];
const SOURCES = ['assets/style.css', 'assets/app.js', 'assets/wordmark.js'];
const REQUIRED_ASSETS = [
    'assets/style.css',
    'assets/app.js',
    'assets/wordmark.js',
    'assets/favicon.svg',
    'assets/apple-touch-icon.png',
    'assets/og-image.png',
    'assets/fonts/archivo-latin-var.woff2',
    'assets/fonts/space-grotesk-latin-var.woff2',
    'assets/fonts/LICENSE.md',
    'CNAME'
];

const problems = [];
const fail = (category, detail) => problems.push(`${category}: ${detail}`);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/* ---------------------------------------------------------------- 1. files */
for (const rel of REQUIRED_ASSETS.concat(PAGES)) {
    if (!exists(rel)) fail('missing file', rel);
}

/* ------------------------------------------------- 2. HTML well-formedness */
const VOID = new Set(['meta', 'link', 'br', 'img', 'input', 'hr', 'source', 'use',
    'path', 'rect', 'circle', 'ellipse', 'polyline', 'polygon', 'line', 'stop']);

function checkStructure(file, html) {
    const stack = [];
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
    let m;
    while ((m = re.exec(html))) {
        const [, closing, rawName, , selfClose] = m;
        const tag = rawName.toLowerCase();
        if (VOID.has(tag) || selfClose === '/') continue;
        if (!closing) stack.push(tag);
        else {
            const top = stack.pop();
            if (top !== tag) fail('malformed html', `${file}: </${tag}> closed <${top}>`);
        }
    }
    if (stack.length) fail('malformed html', `${file}: unclosed ${stack.join(', ')}`);
}

/* --------------------------------------------- 3. local references resolve */
function checkReferences(file, html) {
    const dir = path.dirname(file);
    const re = /(?:href|src)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
        const ref = m[1];
        if (/^(https?:|mailto:|tel:|data:|#)/i.test(ref)) continue;

        const [target, frag] = ref.split('#');
        // Root-absolute paths (404.html uses them) resolve from the repo root.
        const rel = target.startsWith('/')
            ? target.slice(1)
            : path.posix.join(dir === '.' ? '' : dir, target);
        const resolved = rel === '' ? 'index.html' : rel;

        if (!exists(resolved)) {
            fail('dead reference', `${file} -> ${ref}`);
            continue;
        }
        if (frag && resolved.endsWith('.html')) {
            if (!new RegExp(`id="${frag}"`).test(read(resolved))) {
                fail('dead anchor', `${file} -> ${ref} (no id="${frag}" in ${resolved})`);
            }
        }
    }

    // Same-page anchors, plus icon sprite references.
    let a;
    const anchors = /href="#([^"]+)"/g;
    while ((a = anchors.exec(html))) {
        const id = a[1];
        if (!new RegExp(`id="${id}"`).test(html)) {
            fail('dead anchor', `${file} -> #${id} not found in the same page`);
        }
    }
}

/* ------------------------------------------------------ 4. no emoji icons */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

function checkEmoji(file, text) {
    const found = text.match(EMOJI);
    if (found) {
        fail('emoji used as icon', `${file}: ${[...new Set(found)].join(' ')} — use the SVG sprite`);
    }
}

/* ------------------------------------------------------- 5. WCAG contrast */
function luminance(hex) {
    const chan = (i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(1) + 0.7152 * chan(3) + 0.0722 * chan(5);
}

function ratio(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function tokensIn(css, startMarker) {
    const start = css.indexOf(startMarker);
    if (start === -1) return null;
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);
    const out = {};
    let m;
    const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g;
    while ((m = re.exec(block))) out[m[1]] = m[2].toLowerCase();
    return out;
}

function checkContrast() {
    const css = read('assets/style.css');
    const themes = {
        dark: tokensIn(css, ":root[data-theme='dark']"),
        light: tokensIn(css, ":root[data-theme='light']")
    };

    for (const [name, tokens] of Object.entries(themes)) {
        if (!tokens) { fail('contrast', `could not parse the ${name} token block`); continue; }
        const bg = tokens['bg-0'];
        if (!bg) { fail('contrast', `${name} theme has no --bg-0`); continue; }

        for (const [key, value] of Object.entries(tokens)) {
            if (!key.startsWith('text')) continue;
            const r = ratio(value, bg);
            if (r < 4.5) {
                fail('contrast', `${name} --${key} (${value}) on ${bg} is ${r.toFixed(2)}:1, below AA 4.5:1`);
            }
        }
    }
}

/* -------------------------------------------------------------- 6. wiring */
function checkWiring() {
    for (const page of PAGES) {
        const html = read(page);

        // Icons come from the inline sprite; a <use> with no matching symbol
        // renders as nothing at all, silently.
        const used = new Set([...html.matchAll(/<use href="#(i-[a-z-]+)"/g)].map((m) => m[1]));
        for (const id of used) {
            if (!html.includes(`<symbol id="${id}"`)) {
                fail('missing icon', `${page}: <use href="#${id}"> has no matching <symbol>`);
            }
        }

        if (!/<a class="skip-link" href="#main">/.test(html)) {
            fail('accessibility', `${page}: skip link missing`);
        }
        if (!/id="main"/.test(html)) {
            fail('accessibility', `${page}: no #main landmark for the skip link`);
        }
        const h1s = (html.match(/<h1[\s>]/g) || []).length;
        if (h1s !== 1) fail('accessibility', `${page}: expected exactly one <h1>, found ${h1s}`);
    }
}

/* ------------------------------------------------------------------- run */
for (const page of PAGES) {
    if (!exists(page)) continue;
    const html = read(page);
    checkStructure(page, html);
    checkReferences(page, html);
    checkEmoji(page, html);
}
for (const src of SOURCES) {
    if (exists(src)) checkEmoji(src, read(src));
}
checkContrast();
checkWiring();

/* ---------------------------------------------------------------- report */
if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found:\n`);
    for (const p of problems) console.error('  ' + p);
    console.error('\nThe live site is served from live-website. Fix these before merging.\n');
    process.exit(1);
}

console.log('All checks passed: structure, references, anchors, icons, emoji, contrast, landmarks.');
