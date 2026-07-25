/* ==========================================================================
   Plebbian — hero wordmark sequence

     Pleb
     Pleb AI
     PlebbAIn
     PlebbIAn      the pair spins clockwise and swaps
     PlebbiAn      first letter lowercases
     Plebbian      second letter lowercases
     Plebbian      + the .com stamp

   The joke is that "Plebbian" already contains "ai" (Plebb·ia·n), so the two
   glyphs that arrive as a glowing "AI" are the same two that swap and
   lowercase into the finished name.

   Two things are deliberate about the layout:

   · Each slot is sized to its OWN character, never to a shared box. A shared
     box made "I" float in a gap as wide as "A" — the letter spacing looked
     broken.
   · Nothing is ever clipped. Letters that have not arrived are hidden with
     opacity; width only makes room for them. Clipping a growing, centred slot
     was shaving the second "b" into a sliver.

   The markup in the HTML is the FINAL state, so no-JS visitors and anyone
   with prefers-reduced-motion simply keep the settled wordmark. Runs once per
   session; the replay control re-runs it.
   ========================================================================== */
(function () {
    'use strict';

    var root = document.getElementById('wordmark');
    if (!root) return;

    var domain = document.getElementById('wmDomain');
    var replay = document.getElementById('wmReplay');
    var SESSION_KEY = 'pleb.wordmark.played';

    var glyphs = Array.prototype.slice.call(root.querySelectorAll('.g'));
    var slotB = root.querySelector('[data-role="b2"]');
    var slotN = root.querySelector('[data-role="n"]');
    var slotSpace = root.querySelector('[data-role="space"]');
    var ai1 = root.querySelector('[data-role="ai1"]');   // rests as "i"
    var ai2 = root.querySelector('[data-role="ai2"]');   // rests as "a"

    if (!slotB || !slotN || !slotSpace || !ai1 || !ai2) return;

    var base = glyphs.filter(function (g) {
        return g !== slotB && g !== slotN && g !== slotSpace && g !== ai1 && g !== ai2;
    });

    var timers = [];
    var animations = [];
    var running = false;

    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function clearPending() {
        timers.forEach(clearTimeout);
        timers = [];
        animations.forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } });
        animations = [];
    }

    function prefersReduced() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* The overlays that draw the glass edge and the travelling glow are
       pseudo-elements using content:attr(data-char), so the attribute has to
       track the character. */
    function setChar(slot, ch) {
        slot.textContent = ch;
        slot.setAttribute('data-char', ch);
    }

    /* Natural advance width of one character in this slot. */
    function widthOf(slot, ch) {
        var prevText = slot.textContent;
        var prevWidth = slot.style.width;
        slot.style.width = 'auto';
        slot.textContent = ch;
        var w = slot.getBoundingClientRect().width;
        slot.textContent = prevText;
        slot.style.width = prevWidth;
        return w;
    }

    /* Strip everything the animation added — back to plain, reflowable text. */
    function settle() {
        clearPending();
        running = false;
        root.classList.remove('animating');
        glyphs.forEach(function (g) {
            g.removeAttribute('style');
            g.classList.remove('lit', 'filling', 'swapping');
        });
        // DOM order is restored to match the visual order, so textContent
        // reads "Plebbian" regardless of how the swap left things.
        setChar(ai1, 'i');
        setChar(ai2, 'a');
        slotSpace.textContent = '';
        root.classList.add('settled');
        if (domain) domain.classList.remove('pending', 'revealing');
        if (replay) replay.hidden = false;
    }

    function play() {
        if (running) return;
        if (prefersReduced()) { settle(); return; }

        running = true;
        clearPending();
        root.classList.remove('settled');

        /* ---- measure the resting layout before touching anything ---- */
        var natural = glyphs.map(function (g) { return g.getBoundingClientRect().width; });

        var W = {
            A: widthOf(ai1, 'A'),
            I: widthOf(ai1, 'I'),
            i: widthOf(ai1, 'i'),
            a: widthOf(ai2, 'a'),
            b: widthOf(slotB, 'b'),
            n: widthOf(slotN, 'n')
        };
        // A single space collapses to nothing inside an inline-block, so the
        // "Pleb AI" gap comes from the font size instead of a measurement.
        var gap = parseFloat(getComputedStyle(root).fontSize) * 0.3;

        root.classList.add('animating');

        // Explicit order on every slot. Flex sorts by order group, so if only
        // the two AI slots carried an order they would jump ahead of "n".
        glyphs.forEach(function (g, i) {
            g.style.order = String(i + 1);
            g.style.width = natural[i] + 'px';
        });

        /* ---- beat 1: "Pleb" ------------------------------------------- */
        [slotB, slotN].forEach(function (g) {
            g.style.width = '0px';
            g.style.opacity = '0';
            g.style.transform = 'translateY(-0.34em)';
        });
        slotSpace.style.width = '0px';
        [ai1, ai2].forEach(function (g) {
            g.style.width = '0px';
            g.style.opacity = '0';
        });
        setChar(ai1, 'A');
        setChar(ai2, 'I');

        base.forEach(function (g, i) {
            g.style.transition = 'none';
            g.style.opacity = '0';
            g.style.transform = 'translateY(0.22em)';
            at(60 + i * 100, function () {
                g.style.transition = 'opacity 0.5s ease, transform 0.6s var(--ease)';
                g.style.opacity = '1';
                g.style.transform = 'none';
            });
        });

        /* ---- beat 2: "Pleb AI" — the pair drifts in from the right ---- */
        at(640, function () {
            slotSpace.style.width = gap + 'px';

            [[ai1, W.A], [ai2, W.I]].forEach(function (pair, i) {
                var g = pair[0];
                g.classList.add('lit');
                // Offset so the pink/gold drift reads as a wave through the
                // pair rather than one flat blink.
                g.style.animationDelay = (i * -0.9) + 's, ' + (i * -1.2) + 's';
                g.style.transition = 'none';
                g.style.width = pair[1] + 'px';
                g.style.transform = 'translateX(' + (320 + i * 110) + 'px)';
                g.style.opacity = '0';

                at(30, function () {
                    g.style.transition =
                        'transform 1s cubic-bezier(0.16, 1, 0.3, 1) ' + (i * 0.1) + 's,' +
                        'opacity 0.7s ease ' + (i * 0.1) + 's';
                    g.style.transform = 'none';
                    g.style.opacity = '1';
                });
            });
        });

        /* ---- beat 3: "PlebbAIn" — b and n drop in --------------------
           Held first so the glass letters get a moment on their own. */
        at(2050, function () {
            slotSpace.style.width = '0px';
            [[slotB, W.b], [slotN, W.n]].forEach(function (pair, i) {
                var g = pair[0];
                at(i * 120, function () {
                    g.style.transition =
                        'width 0.5s var(--ease), opacity 0.5s ease, transform 0.6s var(--ease)';
                    g.style.width = pair[1] + 'px';
                    g.style.opacity = '1';
                    g.style.transform = 'none';
                });
            });
        });

        /* ---- beat 4: "PlebbIAn" — spin clockwise and swap ------------
           Done by exchanging the two slots' flex order and playing a FLIP:
           read positions, reorder, then animate each glyph from where it used
           to be along a clockwise semicircle. Because flex recomputes the
           layout, the letters keep their own widths and land exactly. */
        at(2900, function () {
            var before1 = ai1.getBoundingClientRect().left;
            var before2 = ai2.getBoundingClientRect().left;

            var o1 = ai1.style.order;
            ai1.style.order = ai2.style.order;
            ai2.style.order = o1;

            var delta1 = before1 - ai1.getBoundingClientRect().left;
            var delta2 = before2 - ai2.getBoundingClientRect().left;

            ai1.classList.add('swapping');
            ai2.classList.add('swapping');
            ai1.style.transition = 'none';
            ai2.style.transition = 'none';

            var DUR = 800;

            // lift is negative for the glyph travelling right (it arcs over
            // the top) and positive for the one travelling left, which makes
            // the pair rotate clockwise. Each glyph also spins a full turn
            // clockwise, ending upright.
            function orbit(el, delta, lift) {
                var frames = [
                    { transform: 'translate(' + delta + 'px, 0) rotate(0deg)' },
                    { transform: 'translate(' + (delta * 0.5) + 'px, ' + lift + 'em) rotate(180deg)' },
                    { transform: 'translate(0px, 0) rotate(360deg)' }
                ];
                if (!el.animate) {
                    el.style.transform = 'none';
                    return null;
                }
                var anim = el.animate(frames, {
                    duration: DUR,
                    easing: 'cubic-bezier(0.5, 0, 0.5, 1)',
                    fill: 'both'
                });
                animations.push(anim);
                return anim;
            }

            // delta is where the glyph came FROM, so the sign tells us which
            // way it is travelling: negative delta means it moves right.
            orbit(ai1, delta1, delta1 < 0 ? -0.42 : 0.34);
            orbit(ai2, delta2, delta2 < 0 ? -0.42 : 0.34);

            at(DUR + 20, function () {
                animations.forEach(function (a) { try { a.cancel(); } catch (e) {} });
                animations = [];
                ai1.style.transform = 'none';
                ai2.style.transform = 'none';
                ai1.classList.remove('swapping');
                ai2.classList.remove('swapping');
            });
        });

        /* ---- beat 5: "PlebbiAn" — the leading letter lowercases -------
           After the swap ai2 sits first, so it is the one that changes. */
        at(3880, function () {
            ai2.style.transition = 'width 0.45s var(--ease)';
            setChar(ai2, 'i');
            ai2.style.width = W.i + 'px';
        });

        /* ---- beat 6: "Plebbian" — and the second ---------------------- */
        at(4230, function () {
            ai1.style.transition = 'width 0.45s var(--ease)';
            setChar(ai1, 'a');
            ai1.style.width = W.a + 'px';
        });

        /* ---- the glass retires into the settled gradient ------------- */
        at(4600, function () {
            root.classList.add('settled');
            [ai1, ai2].forEach(function (g) {
                g.classList.add('filling');
                g.classList.remove('lit');
            });
        });

        /* ---- beat 7: the domain stamp -------------------------------- */
        at(4880, function () {
            if (!domain) return;
            domain.classList.add('revealing');
            domain.classList.remove('pending');
        });

        /* ---- cleanup: hand layout back to normal text flow ----------- */
        at(5400, function () {
            settle();
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* private mode */ }
        });
    }

    /* ---------------------------------------------------------------- boot */
    var alreadyPlayed = false;
    try { alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { /* ignore */ }

    if (replay) {
        replay.addEventListener('click', function () {
            if (!running) play();
        });
    }

    if (alreadyPlayed || prefersReduced()) {
        settle();
    } else {
        if (domain) domain.classList.add('pending');
        if (replay) replay.hidden = true;
        // Wait for the webfonts, or every width measurement is taken against
        // the fallback face and the letters visibly shift when Archivo lands.
        var start = function () { requestAnimationFrame(play); };
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(start).catch(start);
        } else {
            window.addEventListener('load', start);
        }
    }
}());
