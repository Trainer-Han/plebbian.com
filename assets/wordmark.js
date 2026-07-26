/* ==========================================================================
   Plebbian — hero wordmark sequence

     Pleb
     Pleb AI
     PlebbAIn
     PlebbIAn      the pair swaps places, travelling clockwise
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

    var SVGNS = 'http://www.w3.org/2000/svg';
    var svgSeq = 0;

    /* Distance from the top of the slot's content box down to the text
       baseline. A zero-sized inline-block aligned to the baseline sits
       exactly on it, so its offset reports the baseline directly — more
       reliable than deriving it from line-height and font metrics. */
    function baselineOf(slot) {
        var strut = document.createElement('span');
        strut.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        slot.appendChild(strut);
        var y = strut.getBoundingClientRect().top - slot.getBoundingClientRect().top;
        slot.removeChild(strut);
        return y;
    }

    /* Draws one letter as: a white body with a genuine inner glow, plus a
       dash running around the glyph's contour. Both are SVG because the
       contour is the whole point — a CSS conic mask sweeps a wedge from the
       centre and reads as a sonar sweep, not as light following the outline. */
    function buildSVG(slot, ch) {
        var old = slot.querySelector('.ai-svg');
        if (old) old.remove();

        var cs = getComputedStyle(slot);
        var size = parseFloat(cs.fontSize);
        var pad = size * 0.5;                 // room for the glow to spill
        var box = slot.getBoundingClientRect();
        var baseline = baselineOf(slot);
        var w = box.width + pad * 2;
        var h = box.height + pad * 2;
        var uid = 'wm' + (++svgSeq);

        var svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('class', 'ai-svg');
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText =
            'left:' + (-pad) + 'px;top:' + (-pad) + 'px;width:' + w + 'px;height:' + h + 'px';

        // Inner glow: invert the alpha, blur it, tint it, then composite the
        // result back inside the glyph so the light sits within the edges.
        svg.innerHTML =
            '<defs><filter id="' + uid + '" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feComponentTransfer in="SourceAlpha" result="inv">' +
                    '<feFuncA type="table" tableValues="1 0"/>' +
                '</feComponentTransfer>' +
                '<feGaussianBlur in="inv" stdDeviation="' + (size * 0.04).toFixed(2) + '" result="spread"/>' +
                // Softer and less saturated, so the letters read as white with
                // a hint of colour at the edges rather than pink-filled.
                '<feFlood flood-color="#ff5cb0" flood-opacity="0.62" result="tint"/>' +
                '<feComposite in="tint" in2="spread" operator="in" result="glow"/>' +
                '<feComposite in="glow" in2="SourceAlpha" operator="in" result="inner"/>' +
                '<feMerge>' +
                    '<feMergeNode in="SourceGraphic"/>' +
                    '<feMergeNode in="inner"/>' +
                '</feMerge>' +
            '</filter></defs>';

        function text(cls) {
            var t = document.createElementNS(SVGNS, 'text');
            t.setAttribute('class', cls);
            t.setAttribute('x', String(pad));
            t.setAttribute('y', String(pad + baseline));
            t.setAttribute('font-family', cs.fontFamily);
            t.setAttribute('font-size', cs.fontSize);
            t.setAttribute('font-weight', cs.fontWeight);
            t.textContent = ch;
            return t;
        }

        var body = text('ai-body');
        body.setAttribute('filter', 'url(#' + uid + ')');
        svg.appendChild(body);

        var snake = text('ai-snake');
        // A short dash on a long gap: one light travelling the contour rather
        // than a dotted outline. Lengths scale with the type size.
        var dash = size * 0.55;
        var gap = size * 4.2;
        snake.setAttribute('stroke-width', (size * 0.045).toFixed(2));
        snake.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + gap.toFixed(1));
        snake.style.setProperty('--snake-travel', (-(dash + gap)).toFixed(1));
        svg.appendChild(snake);

        slot.appendChild(svg);
    }

    /* Keeps the visible character and its SVG overlay in step. */
    function setChar(slot, ch) {
        slot.textContent = ch;
        slot.setAttribute('data-char', ch);
        if (slot.classList.contains('lit')) buildSVG(slot, ch);
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

        /* Switch to the animating layout BEFORE measuring. The settled rule
           also matches `:not(.animating)`, so measuring first captured the
           padding it adds — every "natural" width came back 0.16em too wide,
           and the padding was then added a second time later. That is what
           made the ending lurch. */
        root.classList.add('animating');

        /* ---- measure, now free of the settled padding ---- */
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
            at(70 + i * 118, function () {
                g.style.transition = 'opacity 0.62s ease, transform 0.72s var(--ease-soft)';
                g.style.opacity = '1';
                g.style.transform = 'none';
            });
        });

        /* ---- beat 2: "Pleb AI" — the pair drifts in from the right ----
           Both letters carry the same distance and the same timing, so the
           pair reads as the word "AI" arriving rather than an "A" that the
           "I" then chases in after.

           The distance is in ems. It used to be a flat 320px and 430px, and
           the hero is clamp(46px, 9vw, 104px) — so on a phone the pair flew
           roughly seven letter-heights across the screen where a desktop saw
           three. */
        at(720, function () {
            slotSpace.style.width = gap + 'px';
            var travel = parseFloat(getComputedStyle(root).fontSize) * 3.1;

            [[ai1, W.A], [ai2, W.I]].forEach(function (pair, i) {
                var g = pair[0];
                g.classList.add('lit');
                g.style.transition = 'none';
                g.style.width = pair[1] + 'px';
                g.style.transform = 'translateX(' + travel + 'px)';
                g.style.opacity = '0';

                // Built after the width is set, so the overlay is sized to the
                // real slot. Offsetting the second letter's phase keeps the two
                // snakes from running in lockstep.
                buildSVG(g, g.textContent);
                var snake = g.querySelector('.ai-snake');
                if (snake) snake.style.animationDelay = (i * -1.1) + 's, ' + (i * -1.7) + 's';

                at(30, function () {
                    // No per-letter delay: they travel and fade as one.
                    g.style.transition =
                        'transform 1.24s cubic-bezier(0.33, 0, 0.2, 1),' +
                        'opacity 0.85s ease';
                    g.style.transform = 'none';
                    g.style.opacity = '1';
                });
            });
        });

        /* ---- beat 3: "PlebbAIn" — b and n drop in --------------------
           Held first so the glass letters get a moment on their own. */
        at(2340, function () {
            slotSpace.style.width = '0px';
            [[slotB, W.b], [slotN, W.n]].forEach(function (pair, i) {
                var g = pair[0];
                at(i * 150, function () {
                    // Matched durations so the letter finishes arriving at the
                    // same moment the space for it finishes opening.
                    g.style.transition =
                        'width 0.66s var(--ease-soft), opacity 0.66s ease, transform 0.72s var(--ease-soft)';
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
        at(3320, function () {
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

            var DUR = 940;

            // The pair orbits clockwise: the glyph travelling right arcs over
            // the top, the one travelling left dips under. The letters stay
            // upright throughout — they change places, they do not spin.
            //
            // The path is sampled from a real semicircle rather than a handful
            // of waypoints. Interpolation between keyframes is linear, so a
            // sparse arc shows its corners; 24 samples reads as a curve.
            function orbit(el, delta, lift) {
                var STEPS = 24;
                var frames = [];
                for (var s = 0; s <= STEPS; s++) {
                    var t = s / STEPS;
                    // x eases naturally at both ends because it follows the
                    // cosine of the angle, which is what circular travel does.
                    var x = delta * (1 + Math.cos(Math.PI * t)) / 2;
                    var y = lift * Math.sin(Math.PI * t);
                    frames.push({
                        transform: 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(3) + 'em)',
                        offset: t
                    });
                }
                if (!el.animate) {
                    el.style.transform = 'none';
                    return null;
                }
                var anim = el.animate(frames, {
                    duration: DUR,
                    // Mild, symmetric. A stronger curve on top of the cosine
                    // path double-eases the ends and reads as hesitation.
                    easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
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
        at(4420, function () {
            ai2.style.transition = 'width 0.58s var(--ease-soft)';
            setChar(ai2, 'i');
            ai2.style.width = W.i + 'px';
        });

        /* ---- beat 6: "Plebbian" — and the second ---------------------- */
        at(4830, function () {
            ai1.style.transition = 'width 0.58s var(--ease-soft)';
            setChar(ai1, 'a');
            ai1.style.width = W.a + 'px';
        });

        /* ---- the glass retires into the settled gradient ------------- */
        /* Waits for beat 6's width transition (4830ms + 0.58s) to finish.
           Handing over while it was still in flight snapped it short and
           shunted everything after the pair sideways by ~4.5px. */
        at(5470, function () {
            // The settled rule adds padding-inline so background-clip:text has
            // room to paint the glyph's overhang, with a negative margin
            // cancelling it out. The explicit widths set above are border-box,
            // so they have to grow by the same amount or the padding eats the
            // content box and clips the "a" tail for the rest of the sequence.
            // Width, padding and margin all change in this one frame, so the
            // glyph does not visibly move.
            // The settled rule pads 0.08em on EACH side, so the border-box
            // width has to grow by twice that; the box itself only moves by
            // one side's worth.
            var padSide = parseFloat(getComputedStyle(root).fontSize) * 0.08;
            var padAllow = padSide * 2;
            // Read the width from the character each slot actually holds. The
            // swap exchanges the slots' ORDER, not their contents, so after it
            // ai1 holds "a" and ai2 holds "i" — assuming otherwise gave each
            // letter the other's width and threw the ending 30px out.
            // dataset.char is the reliable source: textContent also picks up
            // the SVG overlay's own text nodes.
            [ai1, ai2].forEach(function (g) {
                g.style.transition = 'none';
                g.style.width = (W[g.dataset.char] + padAllow) + 'px';

                // The negative margin drags the whole slot — and with it the
                // absolutely positioned overlay — one padSide to the left,
                // while the matching padding keeps the glyph itself put. Left
                // uncorrected the white overlay spends its entire half-second
                // fade sitting a visible 8px adrift of the gradient letter it
                // is handing over to, which reads as a doubled, smeared "ia".
                var svg = g.querySelector('.ai-svg');
                if (svg) svg.style.transform = 'translateX(' + padSide + 'px)';
            });

            root.classList.add('settled');
            [ai1, ai2].forEach(function (g) {
                g.classList.add('filling');
                g.classList.remove('lit');
            });
        });

        /* ---- beat 7: the domain stamp -------------------------------- */
        at(5620, function () {
            if (!domain) return;
            domain.classList.add('revealing');
            domain.classList.remove('pending');
        });

        /* ---- cleanup: hand layout back to normal text flow ----------- */
        at(6240, function () {
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
