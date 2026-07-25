#!/usr/bin/env node
/* ==========================================================================
   Loads every page in a real browser and fails on anything the static
   checks in verify.js cannot see: console errors, failed requests, uncaught
   exceptions, horizontal overflow, and a wordmark that does not settle.

   Uses puppeteer-core against an already-installed Chrome, so there is no
   browser download. Point CHROME_PATH at it, or let the defaults below find
   it. Run locally with:

       CHROME_PATH="/path/to/chrome" node scripts/browser-check.js
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8099;
const PAGES = ['index.html', 'portfolio.html', '404.html'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.md': 'text/plain; charset=utf-8'
};

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].filter(Boolean);

function findChrome() {
    for (const candidate of CHROME_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error('No Chrome found. Set CHROME_PATH.\nTried:\n  ' + CHROME_CANDIDATES.join('\n  '));
}

/* A static server that mirrors how GitHub Pages behaves, including serving
   404.html for unknown paths — which is what makes its root-absolute asset
   paths testable. */
function serve() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let rel = decodeURIComponent(req.url.split('?')[0]);
            if (rel === '/') rel = '/index.html';
            const full = path.join(ROOT, rel);

            if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
                const body = fs.existsSync(path.join(ROOT, '404.html'))
                    ? fs.readFileSync(path.join(ROOT, '404.html'))
                    : 'not found';
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(body);
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
            res.end(fs.readFileSync(full));
        });
        server.listen(PORT, () => resolve(server));
    });
}

(async () => {
    let puppeteer;
    try {
        puppeteer = require('puppeteer-core');
    } catch (e) {
        console.error('puppeteer-core is not installed. In CI this is handled by the workflow;');
        console.error('locally run:  npm install --no-save puppeteer-core');
        process.exit(1);
    }

    const server = await serve();
    const browser = await puppeteer.launch({
        executablePath: findChrome(),
        args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
    });

    const failures = [];

    for (const page of PAGES) {
        const tab = await browser.newPage();

        tab.on('console', (m) => {
            if (m.type() === 'error') failures.push(`${page}: console error — ${m.text()}`);
        });
        tab.on('pageerror', (e) => failures.push(`${page}: uncaught exception — ${e.message}`));
        tab.on('requestfailed', (r) => {
            // The page is built to degrade when the GitHub API is unreachable,
            // and CI runners are frequently rate-limited, so that is not a fault.
            if (!r.url().includes('api.github.com')) {
                failures.push(`${page}: failed request — ${r.url()}`);
            }
        });

        await tab.goto(`http://localhost:${PORT}/${page}`, { waitUntil: 'load', timeout: 20000 });
        // The wordmark sequence settles at ~6.25s, and it only starts once the
        // webfonts have loaded. Wait well past that: sampling mid-sequence
        // would report the overlay's text nodes and fail confusingly.
        await new Promise((r) => setTimeout(r, 9000));

        const state = await tab.evaluate(() => {
            const de = document.documentElement;
            return {
                overflow: de.scrollWidth - de.clientWidth,
                h1: document.querySelectorAll('h1').length,
                unnamed: Array.from(document.querySelectorAll('button, a')).filter((el) =>
                    !el.textContent.trim() &&
                    !el.getAttribute('aria-label') &&
                    !el.getAttribute('title')).length,
                wordmark: document.getElementById('wordmark')
                    ? document.getElementById('wordmark').textContent.trim()
                    : null,
                leftoverInline: document.getElementById('wordmark')
                    ? Array.from(document.querySelectorAll('#wordmark .g'))
                        .filter((g) => g.getAttribute('style')).length
                    : 0,
                stylesheetLoaded: getComputedStyle(document.body).fontFamily.includes('Space Grotesk')
            };
        });

        if (state.overflow > 1) failures.push(`${page}: horizontal overflow of ${state.overflow}px`);
        if (state.h1 !== 1) failures.push(`${page}: expected 1 <h1>, found ${state.h1}`);
        if (state.unnamed) failures.push(`${page}: ${state.unnamed} control(s) with no accessible name`);
        if (!state.stylesheetLoaded) failures.push(`${page}: stylesheet did not apply`);
        if (state.wordmark !== null) {
            if (state.wordmark !== 'Plebbian') {
                failures.push(`${page}: wordmark settled as "${state.wordmark}", expected "Plebbian"`);
            }
            if (state.leftoverInline) {
                failures.push(`${page}: wordmark left ${state.leftoverInline} inline style(s) behind, so it will not reflow`);
            }
        }

        await tab.close();
    }

    await browser.close();
    server.close();

    if (failures.length) {
        console.error(`\n${failures.length} browser problem${failures.length === 1 ? '' : 's'}:\n`);
        failures.forEach((f) => console.error('  ' + f));
        console.error('');
        process.exit(1);
    }

    console.log('Browser checks passed: no console errors, no failed requests, no overflow, wordmark settles.');
})().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
