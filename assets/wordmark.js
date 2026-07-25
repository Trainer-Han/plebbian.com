/* ==========================================================================
   Plebbian — hero wordmark sequence

     Pleb  ->  Pleb AI  ->  PlebbAIn  ->  PlebbIAn  ->  Plebbian  ->  .com

   The joke is that "Plebbian" already contains "ai" (Plebb·ia·n), so the
   two glyphs that arrive as a glowing "AI" are the same two that swap and
   lowercase into the finished name.

   The markup in the HTML is the FINAL state. Everything here is additive,
   so no-JS visitors and anyone with prefers-reduced-motion simply keep the
   settled wordmark. Runs once per session; the replay control re-runs it.
   ========================================================================== */
(function () {
    'use strict';

    var root = document.getElementById('wordmark');
    if (!root) return;

    var domain = document.getElementById('wmDomain');
    var replay = document.getElementById('wmReplay');
    var SESSION_KEY = 'pleb.wordmark.played';

    var glyphs = Array.prototype.slice.call(root.querySelectorAll('.g'));
    var slotB = root.querySelector('[data-role="b2"]');    // the second "b"
    var slotN = root.querySelector('[data-role="n"]');     // trailing "n"
    var slotSpace = root.querySelector('[data-role="space"]');
    var ai1 = root.querySelector('[data-role="ai1"]');     // rests as "i"
    var ai2 = root.querySelector('[data-role="ai2"]');     // rests as "a"

    if (!slotB || !slotN || !slotSpace || !ai1 || !ai2) return;

    var base = glyphs.filter(function (g) {
        return g !== slotB && g !== slotN && g !== slotSpace && g !== ai1 && g !== ai2;
    });

    var timers = [];
    var running = false;

    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function prefersReduced() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* Measure a slot's natural width for a given character. */
    function widthOf(el, text) {
        var prevText = el.textContent;
        var prevWidth = el.style.width;
        el.style.width = 'auto';
        el.textContent = text;
        var w = el.getBoundingClientRect().width;
        el.textContent = prevText;
        el.style.width = prevWidth;
        return w;
    }

    /* Strip every inline style and animation class — back to plain text. */
    function settle() {
        clearTimers();
        running = false;
        root.classList.remove('animating');
        glyphs.forEach(function (g) {
            g.removeAttribute('style');
            g.classList.remove('lit', 'filling', 'swapping');
        });
        ai1.textContent = 'i';
        ai2.textContent = 'a';
        slotSpace.textContent = '';
        root.classList.add('settled');
        if (domain) {
            domain.classList.remove('pending');
            domain.classList.remove('revealing');
        }
        if (replay) replay.hidden = false;
    }

    function play() {
        if (running) return;
        if (prefersReduced()) { settle(); return; }

        running = true;
        clearTimers();
        root.classList.remove('settled');

        /* ---- measure the resting layout before touching anything ---- */
        var natural = {};
        glyphs.forEach(function (g, i) {
            natural[i] = g.getBoundingClientRect().width;
        });

        // One uniform box for both AI slots, wide enough for A, I, a and i,
        // so swapping character and case never nudges the letters around it.
        var uniform = Math.max(
            widthOf(ai1, 'A'), widthOf(ai1, 'I'),
            widthOf(ai1, 'a'), widthOf(ai1, 'i')
        ) * 1.06;

        var spaceWidth = widthOf(slotSpace, ' ') * 0.9;
        var naturalAi1 = widthOf(ai1, 'i');
        var naturalAi2 = widthOf(ai2, 'a');
        var naturalB = widthOf(slotB, 'b');
        var naturalN = widthOf(slotN, 'n');

        root.classList.add('animating');
        glyphs.forEach(function (g, i) {
            g.style.width = natural[i] + 'px';
        });

        /* ---- beat 1: "Pleb" ------------------------------------------- */
        // Collapse everything that hasn't arrived yet.
        [slotB, slotN].forEach(function (g) {
            g.style.width = '0px';
            g.style.opacity = '0';
            g.style.transform = 'translateY(-0.34em)';
        });
        slotSpace.style.width = '0px';
        ai1.style.width = '0px';
        ai2.style.width = '0px';
        ai1.style.opacity = '0';
        ai2.style.opacity = '0';
        ai1.textContent = 'A';
        ai2.textContent = 'I';

        base.forEach(function (g, i) {
            g.style.transition = 'none';
            g.style.opacity = '0';
            g.style.transform = 'translateY(0.22em)';
            at(60 + i * 105, function () {
                g.style.transition = 'opacity 0.5s ease, transform 0.6s var(--ease)';
                g.style.opacity = '1';
                g.style.transform = 'none';
            });
        });

        /* ---- beat 2: "Pleb AI" — AI drifts in from the right ---------- */
        at(700, function () {
            slotSpace.style.width = spaceWidth + 'px';

            [ai1, ai2].forEach(function (g, i) {
                g.classList.add('lit');
                // Offset the two glyphs' pulse so the pink/gold drift reads as
                // a wave moving through the pair rather than one flat blink.
                g.style.animationDelay = (i * -0.9) + 's';
                g.style.transition = 'none';
                g.style.width = uniform + 'px';
                // Off to the right, the far letter trailing behind.
                g.style.transform = 'translateX(' + (330 + i * 110) + 'px)';
                g.style.opacity = '0';

                at(30, function () {
                    // Long, decelerating glide — the "chill" part.
                    g.style.transition =
                        'transform 1.05s cubic-bezier(0.16, 1, 0.3, 1) ' + (i * 0.1) + 's,' +
                        'opacity 0.75s ease ' + (i * 0.1) + 's';
                    g.style.transform = 'none';
                    g.style.opacity = '1';
                });
            });
        });

        /* ---- beat 3: "PlebbAIn" — b and n float in -------------------
           Held a moment first so the outline glow gets to breathe alone. */
        at(2050, function () {
            slotSpace.style.width = '0px';
            [[slotB, naturalB], [slotN, naturalN]].forEach(function (pair, i) {
                var g = pair[0];
                at(i * 130, function () {
                    g.style.transition =
                        'width 0.55s var(--ease), opacity 0.5s ease, transform 0.6s var(--ease)';
                    g.style.width = pair[1] + 'px';
                    g.style.opacity = '1';
                    g.style.transform = 'none';
                });
            });
        });

        /* ---- beat 4: "PlebbIAn" — the swap, on an arc ---------------- */
        at(2950, function () {
            // Both slots share `uniform` width, so the centre-to-centre
            // distance is symmetric and the exchange is exact.
            var d = ai2.getBoundingClientRect().left - ai1.getBoundingClientRect().left;
            var dur = 760;

            function arc(el, dx, lift) {
                if (!el.animate) {
                    el.style.transition = 'transform ' + dur + 'ms var(--ease)';
                    el.style.transform = 'translateX(' + dx + 'px)';
                    return null;
                }
                return el.animate([
                    { transform: 'translateX(0) translateY(0)' },
                    { transform: 'translateX(' + (dx / 2) + 'px) translateY(' + lift + 'em)' },
                    { transform: 'translateX(' + dx + 'px) translateY(0)' }
                ], { duration: dur, easing: 'cubic-bezier(0.5, 0, 0.5, 1)', fill: 'forwards' });
            }

            ai1.classList.add('swapping');
            ai2.classList.add('swapping');

            // "A" arcs over the top, "I" dips under — they never collide.
            var a1 = arc(ai1, d, -0.42);
            var a2 = arc(ai2, -d, 0.3);

            at(dur + 20, function () {
                // FLIP snap: exchange the characters and drop the transforms
                // in the same frame, so nothing appears to move.
                [a1, a2].forEach(function (anim) { if (anim) anim.cancel(); });
                ai1.style.transition = 'none';
                ai2.style.transition = 'none';
                ai1.style.transform = 'none';
                ai2.style.transform = 'none';
                ai1.textContent = 'I';
                ai2.textContent = 'A';
                ai1.classList.remove('swapping');
                ai2.classList.remove('swapping');
            });
        });

        /* ---- beat 5: case cycles down to "Plebbian" ------------------ */
        at(3820, function () {
            var frames = [
                ['i', 'a'], ['I', 'A'], ['i', 'a'], ['I', 'A'], ['i', 'a']
            ];
            var step = 115;

            frames.forEach(function (pair, i) {
                at(i * step, function () {
                    ai1.textContent = pair[0];
                    ai2.textContent = pair[1];

                    // Swap outline for the settled gradient on a flicker frame:
                    // the character change covers the handover, so the fill-in
                    // reads as intentional rather than as a pop.
                    if (i === 2) {
                        root.classList.add('settled');
                        [ai1, ai2].forEach(function (g) {
                            g.classList.add('filling');
                            g.classList.remove('lit');
                        });
                    }
                });
            });

            // Slots relax from the uniform box back to their true widths.
            at(frames.length * step + 70, function () {
                [[ai1, naturalAi1], [ai2, naturalAi2]].forEach(function (pair) {
                    pair[0].style.transition = 'width 0.5s var(--ease)';
                    pair[0].style.width = pair[1] + 'px';
                });
            });
        });

        /* ---- beat 6: the domain stamp -------------------------------- */
        at(4380, function () {
            if (!domain) return;
            domain.classList.add('revealing');
            domain.classList.remove('pending');
        });

        /* ---- cleanup: hand layout back to normal text flow ----------- */
        at(4980, function () {
            settle();
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* private mode */ }
        });
    }

    /* ---------------------------------------------------------------- boot */
    var alreadyPlayed = false;
    try { alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { /* ignore */ }

    if (replay) {
        replay.addEventListener('click', function () {
            if (running) return;
            play();
        });
    }

    if (alreadyPlayed || prefersReduced()) {
        settle();
    } else {
        if (domain) domain.classList.add('pending');
        if (replay) replay.hidden = true;
        // Wait for the webfonts so glyph measurements aren't taken against
        // the fallback face — a wrong measurement means visible jitter.
        var start = function () { requestAnimationFrame(play); };
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(start).catch(start);
        } else {
            window.addEventListener('load', start);
        }
    }
}());
