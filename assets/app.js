/* ==========================================================================
   Plebbian — shared behaviour
   Loaded by index.html, portfolio.html and 404.html. No dependencies.
   ========================================================================== */
(function () {
    'use strict';

    var GH_USER = 'Trainer-Han';
    var CACHE_KEY = 'pleb.gh.v1';
    var CACHE_TTL = 6 * 60 * 60 * 1000;   // 6h — the API allows 60 req/hr per IP
    var THEME_KEY = 'pleb.theme';

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduceMotion = motionQuery.matches;
    motionQuery.addEventListener('change', function (e) { reduceMotion = e.matches; });

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    };

    function icon(name, cls) {
        return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ======================================================================
       Theme
       ====================================================================== */
    var themeBtn = $('#themeToggle');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeBtn) {
            var isDark = theme === 'dark';
            themeBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            themeBtn.innerHTML = icon(isDark ? 'sun' : 'moon');
        }
        var meta = $('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f4f6fb');
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    applyTheme(currentTheme());

    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
            applyTheme(next);
        });
    }

    /* ======================================================================
       Navigation — shared across pages, so links are page-qualified
       ====================================================================== */
    var navShell = $('#navShell');
    var thisPage = location.pathname.split('/').pop() || 'index.html';
    var spyItems = [];

    function pageOf(url) {
        return url.pathname.split('/').pop() || 'index.html';
    }

    $$('a[href]').forEach(function (a) {
        var href = a.getAttribute('href');
        if (!href) return;

        // A bare "#" would jump to the top; querySelector('#') also throws.
        if (href === '#') {
            a.addEventListener('click', function (e) { e.preventDefault(); });
            return;
        }
        if (/^(https?:|mailto:|tel:)/i.test(href)) return;

        var url = new URL(a.href, location.href);
        if (!url.hash || url.hash.length < 2 || pageOf(url) !== thisPage) return;

        var target = document.querySelector(url.hash);
        if (!target) return;

        a.addEventListener('click', function (e) {
            e.preventDefault();
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
            history.replaceState(null, '', url.hash);
        });

        if (a.closest('.nav-links, .nav-panel')) spyItems.push({ link: a, section: target });
    });

    function spy() {
        if (!spyItems.length) return;
        var probe = window.scrollY + window.innerHeight * 0.35;
        var current = spyItems[0];
        spyItems.forEach(function (item) {
            if (item.section.getBoundingClientRect().top + window.scrollY <= probe) current = item;
        });
        spyItems.forEach(function (item) {
            item.link.classList.toggle('active', item.section === current.section);
        });
    }

    var progressEl = $('#navProgress');

    function onScroll() {
        var y = window.scrollY;
        if (navShell) navShell.classList.toggle('scrolled', y > 20);
        if (progressEl) {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            progressEl.style.setProperty('--progress', max > 0 ? Math.min(1, y / max) : 0);
        }
        spy();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    /* Mobile panel */
    var navToggle = $('#navToggle');
    var navPanel = $('#navPanel');

    if (navToggle && navPanel) {
        navToggle.addEventListener('click', function () {
            var open = navPanel.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', String(open));
        });
        $$('a', navPanel).forEach(function (a) {
            a.addEventListener('click', function () {
                navPanel.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
        document.addEventListener('click', function (e) {
            if (navShell && !navShell.contains(e.target) && navPanel.classList.contains('open')) {
                navPanel.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /* ======================================================================
       Scroll reveal
       ====================================================================== */
    var revealables = $$('.reveal');

    function revealAll() {
        revealables.forEach(function (el) { el.classList.add('visible'); });
    }

    if (!('IntersectionObserver' in window) || reduceMotion) {
        revealAll();
    } else {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry, i) {
                if (!entry.isIntersecting) return;
                entry.target.style.transitionDelay = Math.min(i * 0.06, 0.3) + 's';
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        revealables.forEach(function (el) { io.observe(el); });
    }

    function observeReveal(el) {
        if (!('IntersectionObserver' in window) || reduceMotion) {
            el.classList.add('visible');
        } else {
            io.observe(el);
        }
    }

    /* ======================================================================
       Interactive dot field
       Replaces the three always-looping blur blobs: it only moves in
       response to the cursor, sleeps when off-screen, and never runs
       under prefers-reduced-motion.
       ====================================================================== */
    (function dotField() {
        var canvas = $('#dots');
        if (!canvas || reduceMotion) return;

        var ctx = canvas.getContext('2d');
        var dots = [];
        var mouse = { x: -9999, y: -9999 };
        var raf = null;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var GAP = 34;
        var RADIUS = 150;

        function build() {
            var w = canvas.clientWidth;
            var h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            dots = [];
            for (var y = GAP; y < h; y += GAP) {
                for (var x = GAP; x < w; x += GAP) {
                    dots.push({ x: x, y: y });
                }
            }
        }

        function colour() {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--dot').trim() || 'rgba(148,163,184,0.5)';
        }

        var dotColour = colour();

        function draw() {
            raf = null;
            var w = canvas.clientWidth;
            var h = canvas.clientHeight;
            ctx.clearRect(0, 0, w, h);

            for (var i = 0; i < dots.length; i++) {
                var d = dots[i];
                var dx = d.x - mouse.x;
                var dy = d.y - mouse.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                var push = 0;
                var alpha = 0.22;
                var size = 1;

                if (dist < RADIUS) {
                    var force = 1 - dist / RADIUS;
                    push = force * 13;
                    alpha = 0.22 + force * 0.75;
                    size = 1 + force * 1.7;
                }

                var nx = d.x, ny = d.y;
                if (push && dist > 0.01) {
                    nx += (dx / dist) * push;
                    ny += (dy / dist) * push;
                }

                ctx.globalAlpha = alpha;
                ctx.fillStyle = dotColour;
                ctx.beginPath();
                ctx.arc(nx, ny, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        function schedule() {
            if (raf == null) raf = requestAnimationFrame(draw);
        }

        window.addEventListener('pointermove', function (e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            schedule();
        }, { passive: true });

        // Fingers shouldn't leave a stuck hotspot behind.
        window.addEventListener('pointerleave', function () {
            mouse.x = mouse.y = -9999;
            schedule();
        });
        window.addEventListener('pointercancel', function () {
            mouse.x = mouse.y = -9999;
            schedule();
        });

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { build(); schedule(); }, 150);
        });

        // Re-read the dot colour when the theme flips.
        new MutationObserver(function () {
            dotColour = colour();
            schedule();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        build();
        schedule();
    }());

    /* ======================================================================
       Card 3D tilt — pointer only, so touch scrolling is unaffected
       ====================================================================== */
    function bindTilt(card) {
        if (reduceMotion) return;
        var inner = $('.card-tilt', card);
        if (!inner) return;

        card.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            var r = card.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            inner.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg');
            inner.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
        });

        card.addEventListener('pointerleave', function () {
            inner.style.setProperty('--ry', '0deg');
            inner.style.setProperty('--rx', '0deg');
        });
    }

    /* ======================================================================
       GitHub — real repo data for the project grid and stat strip.
       Unauthenticated (60 req/hr per IP), cached in localStorage, and every
       failure path degrades to a visible message rather than an empty grid.
       ====================================================================== */
    var LANG_COLOURS = {
        HTML: '#e34c26', CSS: '#563d7c', JavaScript: '#f1e05a', TypeScript: '#3178c6',
        Python: '#3572a5', Java: '#b07219', 'C++': '#f34b7d', C: '#555555',
        'C#': '#178600', Go: '#00add8', Rust: '#dea584', Shell: '#89e051',
        Ruby: '#701516', PHP: '#4f5d95', Swift: '#f05138', Kotlin: '#a97bff',
        Vue: '#41b883', Svelte: '#ff3e00', Dart: '#00b4ab', Lua: '#000080'
    };

    function langColour(lang) {
        return LANG_COLOURS[lang] || '#8b5cf6';
    }

    /* Projects that aren't public GitHub repositories.
       The grid is otherwise entirely API-driven, so work living in a private
       repo would never appear in it. These are kept in the same shape as a
       GitHub repo object — name, description, language — so the card, filter
       and modal renderers treat them no differently.

       Deliberately carrying no dates or counts: nothing here can go stale,
       which is the only way a hand-written entry earns its place beside live
       data. They sort ahead of the fetched repos. */
    var MANUAL_PROJECTS = [
        {
            name: 'syntaxx.lol',
            description: 'Discord bot for community servers — moderation and automod, ' +
                'levelling and economy, private join-to-create voice channels, ' +
                'cross-server calls, and a desktop dashboard for remote server support.',
            language: 'JavaScript',
            homepage: 'https://syntaxx.lol',
            manual: true,
            cover: 'assets/syntaxx-hero.webp',
            note: 'syntaxx.lol',
            badge: 'Co-built',
            modalDesc: 'A Discord bot run across community servers, plus the desktop ' +
                'app used to support them. Moderation, automod, warns and infractions, ' +
                'levelling and economy, private join-to-create voice channels with an ' +
                'owner control panel, and text "calls" relayed between servers. The ' +
                'companion dashboard lets a developer manage a server\'s settings ' +
                'remotely, but only after its owner grants consent over DM.',
            facts: [
                { label: 'Language', value: 'JavaScript' },
                { label: 'Stack', value: 'discord.js · MongoDB' },
                { label: 'Desktop app', value: 'Python · PySide6' },
                { label: 'Source', value: 'Private' }
            ],
            credit: 'Built with Louis (lode787).'
        },
        {
            name: 'Deco Designs',
            description: 'WooCommerce rebuild for an authorised Brother sewing and ' +
                'embroidery dealership — bespoke theme, an 89-product catalogue ' +
                'rebuilt after the old site went offline, and service-enquiry and ' +
                'coupon flows.',
            language: 'PHP',
            homepage: 'https://demo.plebbian.com/',
            homepageLabel: 'Open the demo',
            manual: true,
            cover: 'assets/decodesigns-cover.webp',
            // The demo host sits behind HTTP Basic auth, so say so before the
            // click rather than after it.
            note: 'Password-protected demo',
            badge: 'Client work',
            modalDesc: 'A full rebuild of a South African Brother sewing and embroidery ' +
                'dealership\'s shop on WordPress and WooCommerce. Bespoke "Atelier" ' +
                'theme over a mu-plugin split one file per concern — store config, ' +
                'taxonomy, policy pages, payment wiring, service and repair enquiries, ' +
                'welcome coupons, review automation and redirects. The previous site ' +
                'had already gone offline, so the catalogue was rebuilt from ' +
                'archive captures with the old slugs kept intact for SEO continuity, ' +
                'and has grown to 89 since. ' +
                'Runs on a Docker Compose environment that provisions itself from ' +
                'scratch. The demo is password protected, one password per client.',
            facts: [
                { label: 'Platform', value: 'WordPress · WooCommerce' },
                { label: 'Catalogue', value: '89 products' },
                { label: 'Dev env', value: 'Docker Compose' },
                { label: 'Source', value: 'Private' }
            ],
            credit: 'Client project · the demo needs the password you were sent.'
        }
    ];

    function relativeDate(iso) {
        var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
        if (days <= 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 30) return days + ' days ago';
        var months = Math.round(days / 30);
        if (months < 12) return months + (months === 1 ? ' month' : ' months') + ' ago';
        var years = (days / 365).toFixed(1).replace(/\.0$/, '');
        return years + (years === '1' ? ' year' : ' years') + ' ago';
    }

    function readCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || Date.now() - parsed.at > CACHE_TTL) return null;
            return parsed.data;
        } catch (e) { return null; }
    }

    function writeCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
        } catch (e) { /* quota or private mode — cache is optional */ }
    }

    function fetchGitHub() {
        var cached = readCache();
        if (cached) return Promise.resolve(cached);

        return Promise.all([
            fetch('https://api.github.com/users/' + GH_USER),
            fetch('https://api.github.com/users/' + GH_USER + '/repos?per_page=100&sort=pushed')
        ]).then(function (responses) {
            var bad = responses.filter(function (r) { return !r.ok; })[0];
            if (bad) {
                var err = new Error('GitHub API responded ' + bad.status);
                err.status = bad.status;
                throw err;
            }
            return Promise.all(responses.map(function (r) { return r.json(); }));
        }).then(function (parts) {
            var data = { user: parts[0], repos: parts[1] };
            writeCache(data);
            return data;
        });
    }

    /* ---------------------------------------------------------------- stats */
    function renderStats(data) {
        var host = $('#statStrip');
        if (!host) return;

        var repos = data.repos.filter(function (r) { return !r.fork; });
        var langs = {};
        repos.forEach(function (r) { if (r.language) langs[r.language] = true; });

        var lastPush = repos.reduce(function (acc, r) {
            return !acc || r.pushed_at > acc ? r.pushed_at : acc;
        }, null);

        var stars = repos.reduce(function (n, r) { return n + r.stargazers_count; }, 0);
        var since = new Date(data.user.created_at).getFullYear();

        var stats = [
            { value: repos.length, label: 'Public repos' },
            { value: Object.keys(langs).length || '—', label: 'Languages' },
            { value: lastPush ? relativeDate(lastPush) : '—', label: 'Last push' },
            { value: stars > 0 ? stars : since, label: stars > 0 ? 'Stars' : 'Building since' }
        ];

        host.innerHTML = stats.map(function (s) {
            return '<div class="stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
        }).join('');
    }

    function renderStatsFallback() {
        var host = $('#statStrip');
        if (!host) return;
        // Keep the strip present but honest — no invented numbers.
        host.innerHTML = [
            { v: '—', l: 'Public repos' },
            { v: '—', l: 'Languages' },
            { v: '—', l: 'Last push' },
            { v: 'GitHub', l: 'Stats unavailable' }
        ].map(function (s) {
            return '<div class="stat"><b>' + s.v + '</b><span>' + esc(s.l) + '</span></div>';
        }).join('');
    }

    /* ------------------------------------------------------------- projects */
    var allRepos = [];

    function cardMarkup(repo) {
        var lang = repo.language;
        var glyph = repo.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'PB';

        // Fetched repos are stamped with how long ago they were pushed;
        // manual entries carry a fixed note instead, since a hand-written
        // date is exactly the kind of thing that quietly goes out of date.
        var stamp = repo.manual
            ? '<span class="chip-mono">' + icon('globe') + esc(repo.note) + '</span>'
            : '<span class="chip-mono">' + icon('clock') + esc(relativeDate(repo.pushed_at)) + '</span>';

        var flag = '';
        if (repo.manual && repo.badge) {
            flag = '<span class="chip-mono">' + icon('users') + esc(repo.badge) + '</span>';
        } else if (!repo.manual && repo.stargazers_count > 0) {
            flag = '<span class="chip-mono">' + icon('star') + esc(repo.stargazers_count) + '</span>';
        }

        // A real cover image replaces the initials, and takes the engineering
        // grid overlay off with it — the pattern sitting on top of artwork
        // reads as a screen door rather than as texture.
        var shot = repo.cover
            ? '<img class="card-shot" src="' + esc(repo.cover) + '" alt="" ' +
              'loading="lazy" decoding="async" width="1200" height="801">'
            : '';
        var initials = repo.cover
            ? ''
            : '<span class="card-glyph">' + esc(glyph) + '</span>';

        return '' +
            '<article class="card reveal" data-lang="' + esc(lang || 'Other') + '">' +
              '<div class="card-tilt">' +
                '<div class="card-cover' + (repo.cover ? ' has-shot' : '') + '">' +
                  // The artwork is a backdrop, so it comes first. The language
                  // and meta chips are absolutely positioned too, and with no
                  // z-index between them paint order is DOM order — put the
                  // image last and it covers the very chips it sits behind.
                  shot +
                  (lang
                    ? '<span class="card-lang" style="--lang-color:' + esc(langColour(lang)) + '"><i></i>' + esc(lang) + '</span>'
                    : '') +
                  '<span class="card-meta">' + flag + '</span>' +
                  initials +
                '</div>' +
                '<div class="card-body">' +
                  '<h3>' + esc(repo.name) + '</h3>' +
                  '<p class="card-desc">' + esc(repo.description || 'No description yet.') + '</p>' +
                  '<div class="card-foot">' +
                    stamp +
                    '<span class="spacer"></span>' +
                    '<button class="card-open" type="button" data-repo="' + esc(repo.name) + '">' +
                      'Details' + icon('arrow-right') +
                    '</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</article>';
    }

    function paintProjects(repos) {
        var grid = $('#projectGrid');
        if (!grid) return;

        if (!repos.length) {
            grid.innerHTML = '<p class="notice">No public repositories to show yet. ' +
                'Follow along at <a href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener noreferrer">github.com/' + GH_USER + '</a>.</p>';
            return;
        }

        grid.innerHTML = repos.map(cardMarkup).join('');
        $$('.card', grid).forEach(function (card) {
            bindTilt(card);
            observeReveal(card);
        });
    }

    function renderFilters(repos) {
        var host = $('#projectFilters');
        if (!host) return;

        var langs = [];
        repos.forEach(function (r) {
            var l = r.language || 'Other';
            if (langs.indexOf(l) === -1) langs.push(l);
        });

        // A filter bar with one option is just noise.
        if (langs.length < 2) { host.hidden = true; return; }

        host.hidden = false;
        host.innerHTML = ['All'].concat(langs).map(function (l, i) {
            return '<button class="filter" type="button" aria-pressed="' + (i === 0) + '" data-filter="' + esc(l) + '">' +
                esc(l) + '</button>';
        }).join('');

        $$('.filter', host).forEach(function (btn) {
            btn.addEventListener('click', function () {
                $$('.filter', host).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
                btn.setAttribute('aria-pressed', 'true');
                var want = btn.dataset.filter;
                paintProjects(want === 'All' ? allRepos : allRepos.filter(function (r) {
                    return (r.language || 'Other') === want;
                }));
            });
        });
    }

    function renderProjects(data) {
        var grid = $('#projectGrid');
        if (!grid) return;

        var fetched = data.repos
            .filter(function (r) { return !r.fork && !r.archived; })
            .sort(function (a, b) {
                if (b.stargazers_count !== a.stargazers_count) {
                    return b.stargazers_count - a.stargazers_count;
                }
                return b.pushed_at.localeCompare(a.pushed_at);
            });

        allRepos = MANUAL_PROJECTS.concat(fetched);

        renderFilters(allRepos);
        paintProjects(allRepos);
    }

    function renderProjectsFallback(err) {
        var grid = $('#projectGrid');
        if (!grid) return;
        var rateLimited = err && err.status === 403;

        // The manual entries don't come from the API, so a dead API is no
        // reason to hide them — only the fetched repos are actually missing.
        allRepos = MANUAL_PROJECTS.slice();

        grid.innerHTML = '<p class="notice">' +
            (rateLimited
                ? 'GitHub’s API rate limit is hit for your network, so the live project list can’t load right now. '
                : 'Couldn’t reach the GitHub API just now. ') +
            'The repositories are all at <a href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener noreferrer">github.com/' + GH_USER + '</a>.' +
            '</p>' + allRepos.map(cardMarkup).join('');

        $$('.card', grid).forEach(function (card) {
            bindTilt(card);
            observeReveal(card);
        });

        var filters = $('#projectFilters');
        if (filters) filters.hidden = true;
    }

    /* ---------------------------------------------------------------- modal */
    var modal = $('#projectModal');
    var lastFocused = null;

    function openModal(repo) {
        if (!modal) return;
        lastFocused = document.activeElement;

        $('#modalTitle').textContent = repo.name;
        $('#modalDesc').textContent = repo.modalDesc || repo.description ||
            'No description provided for this repository.';

        var facts = repo.facts || [
            { label: 'Language', value: repo.language || '—' },
            { label: 'Stars', value: repo.stargazers_count },
            { label: 'Last push', value: relativeDate(repo.pushed_at) },
            { label: 'Created', value: new Date(repo.created_at).getFullYear() }
        ];
        $('#modalFacts').innerHTML = facts.map(function (f) {
            return '<div><span>' + esc(f.label) + '</span><b>' + esc(f.value) + '</b></div>';
        }).join('');

        // A private repo has no source link to offer, so the live site is
        // promoted rather than sitting behind a "View source" that 404s.
        var actions = [];
        if (repo.html_url) {
            actions.push('<a class="btn btn-primary" href="' + esc(repo.html_url) +
                '" target="_blank" rel="noopener noreferrer">' + icon('github') + 'View source</a>');
        }
        if (repo.homepage) {
            // Not everything linked here is a public live site — a demo behind a
            // password should not be labelled as one.
            actions.push('<a class="btn ' + (repo.html_url ? 'btn-ghost' : 'btn-primary') +
                '" href="' + esc(repo.homepage) +
                '" target="_blank" rel="noopener noreferrer">' + icon('external') +
                esc(repo.homepageLabel || 'Live site') + '</a>');
        }
        $('#modalActions').innerHTML = actions.join('');

        var credit = $('#modalCredit');
        if (credit) {
            credit.textContent = repo.credit || '';
            credit.hidden = !repo.credit;
        }

        modal.classList.add('open');
        document.body.classList.add('no-scroll');
        $('#modalClose').focus();
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        document.body.classList.remove('no-scroll');
        if (lastFocused) lastFocused.focus();
    }

    if (modal) {
        $('#modalClose').addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.card-open') : null;
            if (!btn) return;
            var repo = allRepos.filter(function (r) { return r.name === btn.dataset.repo; })[0];
            if (repo) openModal(repo);
        });
    }

    /* ------------------------------------------------------------ languages */
    function renderLanguages(data) {
        var track = $('#langTrack');
        if (!track) return;

        var counts = {};
        data.repos.forEach(function (r) {
            if (!r.fork && r.language) counts[r.language] = (counts[r.language] || 0) + 1;
        });

        var langs = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
        if (!langs.length) return;   // leave the authored fallback chips in place

        var set = langs.map(function (l) {
            return '<span class="chip"><i style="background:' + esc(langColour(l)) + '"></i>' + esc(l) + '</span>';
        }).join('');

        // Repeat until each half is wider than the viewport, or the reverse
        // row starts at translateX(-50%) with a visible gap on the right.
        track.innerHTML = set;
        var per = Math.max(1, Math.ceil(window.innerWidth / Math.max(1, track.scrollWidth)) + 1);
        track.innerHTML = new Array(per * 2 + 1).join(set);
    }

    function padMarquees() {
        $$('[data-marquee]').forEach(function (track) {
            var base = track.innerHTML;
            var w = track.scrollWidth;
            if (!w) return;
            var per = Math.max(1, Math.ceil(track.parentElement.clientWidth / w) + 1);
            track.innerHTML = new Array(per * 2 + 1).join(base);
        });
    }

    padMarquees();

    /* ------------------------------------------------------------------ run */
    if ($('#projectGrid') || $('#statStrip') || $('#langTrack')) {
        fetchGitHub().then(function (data) {
            renderStats(data);
            renderProjects(data);
            renderLanguages(data);
        }).catch(function (err) {
            renderStatsFallback();
            renderProjectsFallback(err);
        });
    }

    /* ======================================================================
       Command palette
       ====================================================================== */
    (function palette() {
        var box = $('#palette');
        if (!box) return;

        var input = $('#paletteInput');
        var list = $('#paletteList');
        var items = [];
        var filtered = [];
        var cursor = 0;
        var opener = null;

        // Built from the nav, so it can never drift out of sync with it.
        $$('.nav-panel a, .nav-links a').forEach(function (a) {
            var label = a.textContent.trim().replace(/\s*↗$/, '');
            if (!label) return;
            if (items.some(function (it) { return it.label === label; })) return;
            items.push({ label: label, href: a.getAttribute('href'), icon: 'arrow-right' });
        });

        items.push(
            { label: 'Toggle theme', action: function () { themeBtn && themeBtn.click(); }, icon: 'moon' },
            { label: 'GitHub profile', href: 'https://github.com/' + GH_USER, icon: 'github', external: true },
            { label: 'Email me', href: 'mailto:hello@plebbian.com', icon: 'mail', external: true }
        );

        function render() {
            if (!filtered.length) {
                list.innerHTML = '<li class="palette-empty">No matches</li>';
                return;
            }
            list.innerHTML = filtered.map(function (it, i) {
                return '<li role="option" aria-selected="' + (i === cursor) + '">' +
                    '<button type="button" data-i="' + i + '">' + icon(it.icon) +
                    '<span>' + esc(it.label) + '</span>' +
                    (it.external ? '<span class="hint">open</span>' : '') +
                    '</button></li>';
            }).join('');
        }

        function filter(q) {
            q = q.trim().toLowerCase();
            filtered = q ? items.filter(function (it) {
                return it.label.toLowerCase().indexOf(q) !== -1;
            }) : items.slice();
            cursor = 0;
            render();
        }

        function open() {
            opener = document.activeElement;
            box.classList.add('open');
            document.body.classList.add('no-scroll');
            input.value = '';
            filter('');
            input.focus();
        }

        function close() {
            box.classList.remove('open');
            document.body.classList.remove('no-scroll');
            if (opener) opener.focus();
        }

        function run(it) {
            close();
            if (!it) return;
            if (it.action) { it.action(); return; }
            if (it.external) { window.open(it.href, '_blank', 'noopener'); return; }

            var url = new URL(it.href, location.href);
            if (url.hash && pageOf(url) === thisPage) {
                var target = document.querySelector(url.hash);
                if (target) {
                    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
                    history.replaceState(null, '', url.hash);
                    return;
                }
            }
            location.href = it.href;
        }

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                box.classList.contains('open') ? close() : open();
                return;
            }
            if (!box.classList.contains('open')) return;

            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                cursor = Math.min(cursor + 1, filtered.length - 1);
                render();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                cursor = Math.max(cursor - 1, 0);
                render();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                run(filtered[cursor]);
            }
        });

        input.addEventListener('input', function () { filter(input.value); });

        list.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-i]');
            if (btn) run(filtered[Number(btn.dataset.i)]);
        });

        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        $$('[data-palette-open]').forEach(function (b) { b.addEventListener('click', open); });
    }());

    /* ======================================================================
       Footer year
       ====================================================================== */
    var yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}());
