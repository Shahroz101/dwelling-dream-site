/**
 * Dwelling Dream — interactions.js
 * ---------------------------------------------------------------------------
 * Framework-agnostic, dependency-free implementation of every interaction in
 * the Dwelling Dream design. Extracted from the HTML design references so a
 * developer can port behaviour 1:1 without reverse-engineering the prototypes.
 *
 * USAGE (vanilla / Astro / plain HTML):
 *     import { initDwellingDream } from './interactions.js';
 *     initDwellingDream();                       // wires everything present
 *
 * USAGE (React / Vue): call the individual init* functions from an effect and
 * call the returned teardown on unmount:
 *     useEffect(() => initStyleExplorer(rootEl), []);
 *
 * Every init function:
 *   - is safe to call when its markup is absent (returns a no-op teardown)
 *   - returns a function that removes all listeners/observers it created
 *   - respects prefers-reduced-motion
 *
 * The markup contract is documented above each function. All hooks are
 * data-attributes so styling stays entirely in your CSS layer.
 * ---------------------------------------------------------------------------
 */

/* ========================================================================== *
 * Shared helpers
 * ========================================================================== */

export const EASE_SPRING = 'cubic-bezier(.22,1,.36,1)';
export const EASE_COLOR = 'cubic-bezier(.4,0,.2,1)';

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canHover = () => window.matchMedia('(hover: hover)').matches;

/** Collect listeners/observers/timers so a single call tears everything down. */
function createBin() {
  const jobs = [];
  return {
    on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      jobs.push(() => target.removeEventListener(type, handler, options));
    },
    add(fn) { jobs.push(fn); },
    observe(observer) { jobs.push(() => observer.disconnect()); },
    timer(id) { jobs.push(() => clearTimeout(id)); },
    destroy() { jobs.splice(0).forEach(fn => fn()); }
  };
}

/** rAF-throttled scroll/resize callback. */
function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...args); });
  };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Cubic ease-out, used by counters and the comparison intro. */
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);

/** Perceived luminance — decides light vs dark text over a swatch. */
export function isDarkHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 150;
}

/** Copy text, resolving true/false rather than throwing on denied permission. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ========================================================================== *
 * 1. Scroll progress bar
 * Markup: <div data-progress></div>  (2px tall, transform-origin: 0 50%)
 * ========================================================================== */

export function initScrollProgress(root = document) {
  const bar = root.querySelector('[data-progress]');
  if (!bar) return () => {};
  const bin = createBin();

  const update = rafThrottle(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
  });

  bin.on(window, 'scroll', update, { passive: true });
  bin.on(window, 'resize', update);
  update();
  return bin.destroy;
}

/* ========================================================================== *
 * 2. Nav: transparent over hero -> solid on scroll
 * Markup: <header data-nav> with optional
 *         <img data-logo-light> / <img data-logo-dark> stacked absolutely,
 *         and <a data-navcta>.
 * `threshold` is a fraction of viewport height (homepage 0.72; interior 0.04).
 * ========================================================================== */

export function initNav(root = document, { threshold = 0.72 } = {}) {
  const nav = root.querySelector('[data-nav]');
  if (!nav) return () => {};
  const bin = createBin();

  const logoLight = root.querySelector('[data-logo-light]');
  const logoDark = root.querySelector('[data-logo-dark]');
  const cta = root.querySelector('[data-navcta]');
  let solidNow = null;

  const update = rafThrottle(() => {
    const solid = window.scrollY > window.innerHeight * threshold;
    if (solid === solidNow) return;          // only write on state flip
    solidNow = solid;

    nav.dataset.solid = solid ? 'true' : 'false';   // hook your CSS off this
    nav.style.background = solid ? 'rgba(245,242,234,.9)' : 'rgba(245,242,234,0)';
    nav.style.borderBottomColor = solid ? 'rgba(216,210,200,1)' : 'rgba(216,210,200,0)';
    nav.style.backdropFilter = solid ? 'blur(14px)' : 'blur(0px)';
    nav.style.paddingTop = nav.style.paddingBottom = solid ? '14px' : '22px';
    nav.style.color = solid ? '#292825' : '#F5F2EA';

    if (logoLight && logoDark) {
      logoLight.style.opacity = solid ? '0' : '1';
      logoDark.style.opacity = solid ? '1' : '0';
    }
    if (cta) {
      cta.style.borderColor = solid ? '#D8D2C8' : 'rgba(245,242,234,.5)';
      cta.style.background = solid ? 'rgba(255,255,255,.5)' : 'rgba(245,242,234,.1)';
    }
  });

  bin.on(window, 'scroll', update, { passive: true });
  bin.on(window, 'resize', update);
  update();
  return bin.destroy;
}

/* ========================================================================== *
 * 3. Reveal on scroll
 * Markup: any element with [data-reveal].
 * Includes a 4s failsafe: if observers never fire, everything is revealed.
 * ========================================================================== */

export function initReveal(root = document, { stagger = 70, groupSize = 5 } = {}) {
  const els = Array.from(root.querySelectorAll('[data-reveal]'));
  if (!els.length || prefersReducedMotion()) return () => {};
  const bin = createBin();

  els.forEach((el, i) => {
    const delay = (i % groupSize) * stagger;
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition =
      `opacity .9s ease ${delay}ms, transform .9s ${EASE_SPRING} ${delay}ms`;
  });

  const show = el => { el.style.opacity = '1'; el.style.transform = 'none'; };

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  els.forEach(el => io.observe(el));
  bin.observe(io);
  bin.timer(setTimeout(() => els.forEach(show), 4000));   // failsafe
  return bin.destroy;
}

/* ========================================================================== *
 * 4. Animated counters
 * Markup: <span data-count="1000" data-format="plus|int|rating" data-from="0">
 * Formats: plus -> "1,000+"   int -> "9"   rating -> "4.9/5"
 * ========================================================================== */

export function initCounters(root = document, { duration = 1800 } = {}) {
  const els = Array.from(root.querySelectorAll('[data-count]'));
  if (!els.length) return () => {};
  const bin = createBin();
  const reduced = prefersReducedMotion();

  const format = (value, kind) => {
    if (kind === 'plus') return `${Math.round(value).toLocaleString('en-US')}+`;
    if (kind === 'rating') return `${value.toFixed(1)}/5`;
    return String(Math.round(value));
  };

  const run = el => {
    const to = parseFloat(el.dataset.count);
    const from = parseFloat(el.dataset.from || '0');
    const kind = el.dataset.format;
    if (reduced) { el.textContent = format(to, kind); return; }

    const start = performance.now();
    const step = now => {
      const p = clamp((now - start) / duration, 0, 1);
      el.textContent = format(from + (to - from) * easeOutCubic(p), kind);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      run(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.4 });

  els.forEach(el => io.observe(el));
  bin.observe(io);
  return bin.destroy;
}

/* ========================================================================== *
 * 5. Cursor parallax for floating decorative objects
 * Markup: <div data-depth="1.4"> — higher depth = more movement.
 * Uses the `translate` property so it composes with CSS `transform` animations.
 * ========================================================================== */

export function initCursorParallax(root = document, { intensity = 1, amount = 24 } = {}) {
  if (prefersReducedMotion()) return () => {};
  const objects = Array.from(root.querySelectorAll('[data-depth]')).map(el => ({
    el, depth: parseFloat(el.dataset.depth) || 1, x: 0, y: 0, tx: 0, ty: 0
  }));
  if (!objects.length) return () => {};

  const bin = createBin();
  let raf = null;

  const tick = () => {
    let moving = false;
    objects.forEach(o => {
      o.x += (o.tx - o.x) * 0.07;           // lerp toward target
      o.y += (o.ty - o.y) * 0.07;
      if (Math.abs(o.tx - o.x) > 0.1 || Math.abs(o.ty - o.y) > 0.1) moving = true;
      o.el.style.translate = `${o.x.toFixed(2)}px ${o.y.toFixed(2)}px`;
    });
    raf = moving ? requestAnimationFrame(tick) : null;   // idle when settled
  };

  bin.on(window, 'pointermove', e => {
    const cx = e.clientX / window.innerWidth - 0.5;
    const cy = e.clientY / window.innerHeight - 0.5;
    objects.forEach(o => {
      o.tx = -cx * amount * o.depth * intensity;
      o.ty = -cy * (amount * 0.75) * o.depth * intensity;
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

  bin.add(() => { if (raf) cancelAnimationFrame(raf); });
  return bin.destroy;
}

/* ========================================================================== *
 * 6. Magnetic buttons
 * Markup: any element with [data-magnetic].
 * ========================================================================== */

export function initMagnetic(root = document, { intensity = 1 } = {}) {
  if (prefersReducedMotion()) return () => {};
  const bin = createBin();

  root.querySelectorAll('[data-magnetic]').forEach(el => {
    bin.on(el, 'pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform =
        `translate(${(dx * 12 * intensity).toFixed(1)}px, ${(dy * 8 * intensity).toFixed(1)}px)`;
    });
    bin.on(el, 'pointerleave', () => { el.style.transform = 'none'; });
  });

  return bin.destroy;
}

/* ========================================================================== *
 * 7. Hero parallax (image scale on scroll + copy drift)
 * Markup: [data-hero-media] (image wrapper), [data-hero-copy] (text layer)
 * ========================================================================== */

export function initHeroParallax(root = document, { intensity = 1 } = {}) {
  const media = root.querySelector('[data-hero-media]');
  const copy = root.querySelector('[data-hero-copy]');
  if ((!media && !copy) || prefersReducedMotion()) return () => {};
  const bin = createBin();

  const update = rafThrottle(() => {
    const p = clamp(window.scrollY / window.innerHeight, 0, 1);
    if (media) {
      media.style.transformOrigin = '50% 30%';
      media.style.transform = `scale(${(1 + p * 0.05).toFixed(4)})`;
    }
    if (copy) {
      copy.style.transform = `translate3d(0, ${(-p * 40).toFixed(2)}px, 0)`;
      copy.style.opacity = String(1 - p * 0.7);
    }
  });

  bin.on(window, 'scroll', update, { passive: true });
  bin.on(window, 'resize', update);

  // Subtle horizontal lean of the copy with the cursor.
  if (copy) {
    bin.on(window, 'pointermove', e => {
      const cx = e.clientX / window.innerWidth - 0.5;
      copy.style.marginLeft = `${(cx * -6 * intensity).toFixed(2)}px`;
    }, { passive: true });
  }

  update();
  return bin.destroy;
}

/** Section-scoped parallax for any full-bleed media (closing CTA, portraits). */
export function initSectionParallax(root = document) {
  const items = Array.from(root.querySelectorAll('[data-parallax]'));
  if (!items.length || prefersReducedMotion()) return () => {};
  const bin = createBin();

  const update = rafThrottle(() => {
    const vh = window.innerHeight;
    items.forEach(el => {
      const strength = parseFloat(el.dataset.parallax) || 1;
      const section = el.parentElement;
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const q = 1 - (r.top + r.height / 2) / (vh + r.height / 2);
      el.style.transform =
        `translate3d(0, ${(q * 6 * strength).toFixed(2)}%, 0) scale(${(1.04 + q * 0.05).toFixed(3)})`;
    });
  });

  bin.on(window, 'scroll', update, { passive: true });
  bin.on(window, 'resize', update);
  update();
  return bin.destroy;
}

/* ========================================================================== *
 * 8. Style explorer — the signature interaction
 * Markup:
 *   <div data-style-list role="tablist">
 *     <button data-style="0" role="tab" aria-selected="true">
 *       <span data-num>01</span><span data-title>…</span><span data-line></span>
 *       <span data-body>…<span title="#HEX"></span>…</span>
 *     </button> …
 *   </div>
 *   <div data-style-media>
 *     <div data-simg="0">…</div> …
 *     <p data-sname></p>
 *   </div>
 *   <div data-cursor-chip>View style →</div>   (optional pointer follower)
 *
 * Image transition is DIRECTION-AWARE: moving down the list reveals from the
 * top (inset 14% 0 0 0), moving up reveals from the bottom.
 * ========================================================================== */

export function initStyleExplorer(root = document, { names = [], intensity = 1 } = {}) {
  const list = root.querySelector('[data-style-list]');
  if (!list) return () => {};

  const bin = createBin();
  const reduced = prefersReducedMotion();
  const items = Array.from(root.querySelectorAll('[data-style]'));
  const images = Array.from(root.querySelectorAll('[data-simg]'));
  const label = root.querySelector('[data-sname]');
  const media = root.querySelector('[data-style-media]');
  const chip = root.querySelector('[data-cursor-chip]');
  let current = 0;

  // One-time transition setup on animated children.
  items.forEach(item => {
    const title = item.querySelector('[data-title]');
    if (title) {
      title.style.display = 'inline-block';
      title.style.transition =
        `color .4s ease, transform .6s ${EASE_SPRING}, letter-spacing .6s ${EASE_SPRING}, opacity .4s ease`;
    }
    item.style.transition = `background .5s ease, padding-left .6s ${EASE_SPRING}`;
    item.querySelectorAll('[data-body] [title]').forEach(sw => {
      sw.style.transformOrigin = '50% 100%';
      sw.style.transition = `transform .6s ${EASE_SPRING}, opacity .5s ease`;
    });
  });

  const setStyle = (index, { scrollIntoView = false } = {}) => {
    const direction = index > current ? 1 : -1;
    current = index;

    items.forEach((item, i) => {
      const active = i === index;
      item.setAttribute('aria-selected', active ? 'true' : 'false');

      const title = item.querySelector('[data-title]');
      if (title) {
        title.style.color = active ? '#292825' : '#9B958D';
        title.style.transform = active ? 'translateX(14px)' : 'translateX(0)';
        title.style.letterSpacing = active ? '.005em' : '-.005em';
        title.style.opacity = active ? '1' : '.82';
      }
      const num = item.querySelector('[data-num]');
      if (num) num.style.color = active ? '#292825' : '#A9A29A';
      const line = item.querySelector('[data-line]');
      if (line) line.style.transform = active ? 'scaleX(1)' : 'scaleX(0)';

      item.style.background = active ? 'rgba(245,242,234,.6)' : 'transparent';
      item.style.paddingLeft = active ? '14px' : '0';

      const body = item.querySelector('[data-body]');
      if (body) {
        body.style.maxHeight = active ? '160px' : '0';
        body.style.opacity = active ? '1' : '0';
      }
      // Swatches spring up in sequence when the row opens.
      item.querySelectorAll('[data-body] [title]').forEach((sw, k) => {
        sw.style.transitionDelay = active ? `${60 + k * 45}ms` : '0ms';
        sw.style.transform = active ? 'scaleY(1)' : 'scaleY(.15)';
        sw.style.opacity = active ? '1' : '0';
      });
    });

    images.forEach((img, i) => {
      const active = i === index;
      img.style.transition =
        `opacity .55s ease, transform .8s ${EASE_SPRING}, filter .6s ease, clip-path .75s ${EASE_SPRING}`;
      img.style.opacity = active ? '1' : '0';
      img.style.transform = active
        ? 'scale(1) translateY(0)'
        : `scale(1.04) translateY(${direction * 3}%)`;
      img.style.filter = active ? 'blur(0px) saturate(1)' : 'blur(10px) saturate(.85)';
      img.style.clipPath = active
        ? 'inset(0% 0 0% 0)'
        : `inset(${direction > 0 ? '14% 0 0% 0' : '0% 0 14% 0'})`;
      img.style.zIndex = active ? '2' : '1';
    });

    if (label && names[index]) label.textContent = names[index];

    if (scrollIntoView) {
      const section = list.closest('section');
      if (section) {
        window.scrollTo({
          top: section.getBoundingClientRect().top + window.scrollY - 80,
          behavior: reduced ? 'auto' : 'smooth'
        });
      }
    }
  };

  items.forEach((item, i) => {
    bin.on(item, 'pointerenter', () => { if (canHover()) setStyle(i); });
    bin.on(item, 'focus', () => setStyle(i));
    bin.on(item, 'click', () => setStyle(i));
  });

  // Deep links from elsewhere on the page: <button data-goto="3">
  root.querySelectorAll('[data-goto]').forEach(btn => {
    bin.on(btn, 'click', () =>
      setStyle(parseInt(btn.dataset.goto, 10), { scrollIntoView: true }));
  });

  // Pointer-following "View style →" chip.
  if (chip && !reduced) {
    bin.on(list, 'pointermove', e => {
      chip.style.left = `${e.clientX}px`;
      chip.style.top = `${e.clientY}px`;
      chip.style.opacity = '1';
      chip.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    bin.on(list, 'pointerleave', () => {
      chip.style.opacity = '0';
      chip.style.transform = 'translate(-50%, -50%) scale(.7)';
    });
  }

  // Cursor tilt on the image frame.
  if (media && !reduced) {
    bin.on(media, 'pointermove', e => {
      const r = media.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      media.style.transition = 'transform .25s ease-out';
      media.style.transform =
        `perspective(1200px) rotateY(${(dx * 3 * intensity).toFixed(2)}deg) ` +
        `rotateX(${(-dy * 2.4 * intensity).toFixed(2)}deg) scale(1.01)`;
    });
    bin.on(media, 'pointerleave', () => {
      media.style.transition = `transform .8s ${EASE_SPRING}`;
      media.style.transform = 'none';
    });
  }

  setStyle(0);
  bin.add(() => {});
  const destroy = bin.destroy;
  destroy.setStyle = setStyle;      // expose for external control
  return destroy;
}

/* ========================================================================== *
 * 9. Card hover lift + slow image zoom
 * Markup: [data-hover-card] wrapping an optional [data-hover-media]
 * ========================================================================== */

export function initHoverCards(root = document, {
  lift = 8, shadow = '0 26px 48px rgba(41,40,37,.13)', zoom = 1.04
} = {}) {
  if (prefersReducedMotion()) return () => {};
  const bin = createBin();

  root.querySelectorAll('[data-hover-card]').forEach(card => {
    const media = card.querySelector('[data-hover-media]');
    card.style.transition = `transform .6s ${EASE_SPRING}, box-shadow .6s ease`;
    if (media) media.style.transition = `transform .8s ${EASE_SPRING}`;

    bin.on(card, 'pointerenter', () => {
      card.style.transform = `translateY(-${lift}px)`;
      card.style.boxShadow = shadow;
      if (media) media.style.transform = `scale(${zoom})`;
    });
    bin.on(card, 'pointerleave', () => {
      card.style.transform = 'none';
      card.style.boxShadow = 'none';
      if (media) media.style.transform = 'none';
    });
  });

  return bin.destroy;
}

/* ========================================================================== *
 * 10. Testimonial carousel
 * Markup: [data-quote] wrapper containing [data-qtext], [data-qwho],
 *         [data-qidx], plus [data-qprev] / [data-qnext] buttons.
 * `quotes`: [{ text, who }]
 * ========================================================================== */

export function initTestimonials(root = document, quotes = []) {
  const wrap = root.querySelector('[data-quote]');
  if (!wrap || !quotes.length) return () => {};

  const bin = createBin();
  const reduced = prefersReducedMotion();
  const textEl = root.querySelector('[data-qtext]');
  const whoEl = root.querySelector('[data-qwho]');
  const idxEl = root.querySelector('[data-qidx]');
  const pad = n => String(n).padStart(2, '0');
  let index = 0;

  const go = next => {
    index = (next + quotes.length) % quotes.length;
    const quote = quotes[index];

    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(14px)';

    const swap = () => {
      if (textEl) textEl.textContent = quote.text;
      if (whoEl) whoEl.textContent = quote.who;
      if (idxEl) idxEl.textContent = `${pad(index + 1)} / ${pad(quotes.length)}`;
      wrap.style.opacity = '1';
      wrap.style.transform = 'none';
    };

    if (reduced) swap();
    else bin.timer(setTimeout(swap, 260));
  };

  const prev = root.querySelector('[data-qprev]');
  const next = root.querySelector('[data-qnext]');
  if (prev) bin.on(prev, 'click', () => go(index - 1));
  if (next) bin.on(next, 'click', () => go(index + 1));

  go(0);
  return bin.destroy;
}

/* ========================================================================== *
 * 11. Before / after comparison slider
 * Markup:
 *   <div data-compare>
 *     <div>…after image…</div>
 *     <div data-cmp-before style="width:50%">
 *       <div data-cmp-beforeinner>…before image…</div>
 *     </div>
 *     <div data-cmp-strip></div>                (optional, fades in on reveal)
 *     <div data-cmp-handle><span data-cmp-grab></span></div>
 *     <input data-cmp-input type="range" min="4" max="96" value="50">
 *   </div>
 *
 * Notes that matter:
 *   - the inner "before" layer is pinned to the PANEL's pixel width, so the
 *     image is revealed rather than squashed;
 *   - dragging works anywhere on the panel with a 3px threshold, so ordinary
 *     clicks still reach the images beneath;
 *   - the range input is the keyboard path (visually hidden, not display:none).
 * ========================================================================== */

export function initComparisonSlider(root = document) {
  const wrap = root.querySelector('[data-compare]');
  if (!wrap) return () => {};

  const bin = createBin();
  const reduced = prefersReducedMotion();
  const before = wrap.querySelector('[data-cmp-before]');
  const inner = wrap.querySelector('[data-cmp-beforeinner]');
  const handle = wrap.querySelector('[data-cmp-handle]');
  const grab = wrap.querySelector('[data-cmp-grab]');
  const input = wrap.querySelector('[data-cmp-input]');
  const strip = wrap.querySelector('[data-cmp-strip]');

  const sizeInner = () => {
    if (inner) inner.style.width = `${wrap.getBoundingClientRect().width}px`;
  };
  sizeInner();
  bin.on(window, 'resize', sizeInner);

  const set = value => {
    if (before) before.style.width = `${value}%`;
    if (handle) handle.style.left = `${value}%`;
    if (strip) strip.style.opacity = String(clamp((value - 20) / 40, 0, 1));
  };

  const fromClientX = x => {
    const r = wrap.getBoundingClientRect();
    const value = clamp(((x - r.left) / r.width) * 100, 4, 96);
    if (input) input.value = String(value);
    set(value);
  };

  if (input) bin.on(input, 'input', () => set(parseFloat(input.value)));
  set(50);

  let dragging = false;
  let startX = 0;

  bin.on(wrap, 'pointerdown', e => {
    dragging = true;
    startX = e.clientX;
    if (handle) handle.style.transition = 'none';
    wrap.style.cursor = 'ew-resize';
    if (e.target === grab) { fromClientX(e.clientX); e.preventDefault(); }
  });

  bin.on(window, 'pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 3) {     // threshold preserves clicks
      fromClientX(e.clientX);
      e.preventDefault();
    }
  }, { passive: false });

  const end = () => {
    dragging = false;
    wrap.style.cursor = '';
    if (handle) handle.style.transition = `left .35s ${EASE_SPRING}`;
  };
  bin.on(window, 'pointerup', end);
  bin.on(window, 'pointercancel', end);

  // One-time entrance sweep, 88% -> 50%.
  if (!reduced) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || wrap.dataset.played) return;
        wrap.dataset.played = '1';
        const start = performance.now();
        const step = now => {
          const p = clamp((now - start) / 1500, 0, 1);
          const value = 88 - easeOutCubic(p) * 38;
          if (input) input.value = String(value);
          set(value);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.35 });
    io.observe(wrap);
    bin.observe(io);
  }

  return bin.destroy;
}

/* ========================================================================== *
 * 12. Accordion
 * Markup:
 *   <div data-acc>
 *     <button data-acc-btn aria-expanded="false">…<span data-acc-icon>+</span></button>
 *     <div data-acc-body>…</div>
 *   </div>
 * `aria-expanded` is the single source of truth.
 * ========================================================================== */

export function initAccordions(root = document, { maxHeight = 340 } = {}) {
  const bin = createBin();

  root.querySelectorAll('[data-acc]').forEach(acc => {
    const btn = acc.querySelector('[data-acc-btn]');
    const body = acc.querySelector('[data-acc-body]');
    const icon = acc.querySelector('[data-acc-icon]');
    if (!btn || !body) return;

    body.style.overflow = 'hidden';
    body.style.transition = `max-height .55s ${EASE_SPRING}, opacity .4s ease`;
    if (icon) icon.style.transition = `transform .45s ${EASE_SPRING}`;

    const set = open => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.style.maxHeight = open ? `${maxHeight}px` : '0';
      body.style.opacity = open ? '1' : '0';
      if (icon) icon.style.transform = open ? 'rotate(45deg)' : 'none';
    };

    set(btn.getAttribute('aria-expanded') === 'true');
    bin.on(btn, 'click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  });

  return bin.destroy;
}

/* ========================================================================== *
 * 13. Palette catalogue: brand filter
 * Markup: [data-filter="all|sherwin|behr|benjamin"] buttons,
 *         [data-card data-tags="sherwin"] cards,
 *         [data-count] live count, [data-empty] empty state.
 * ========================================================================== */

export function initBrandFilter(root = document) {
  const buttons = Array.from(root.querySelectorAll('[data-filter]'));
  const cards = Array.from(root.querySelectorAll('[data-card]'));
  if (!buttons.length || !cards.length) return () => {};

  const bin = createBin();
  const countEl = root.querySelector('[data-count]');
  const emptyEl = root.querySelector('[data-empty]');

  const apply = tag => {
    buttons.forEach(btn => {
      const active = btn.dataset.filter === tag;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.style.background = active ? '#292825' : 'transparent';
      btn.style.color = active ? '#F5F2EA' : '#292825';
      btn.style.borderColor = active ? '#292825' : '#D8D2C8';
    });

    let shown = 0;
    cards.forEach(card => {
      const tags = (card.dataset.tags || '').split(' ');
      const visible = tag === 'all' || tags.includes(tag);
      // The card is often wrapped in a clickable <a> that is the actual CSS
      // grid item; hiding only the inner card leaves that wrapper's grid
      // cell reserved, showing up as empty gaps where filtered items were.
      const gridItem = card.parentElement && card.parentElement.tagName === 'A' ? card.parentElement : card;
      gridItem.style.display = visible ? 'flex' : 'none';
      if (visible) shown++;
    });

    if (countEl) {
      countEl.textContent = shown === 1
        ? '1 palette · 9 colors'
        : `${shown} palettes · ${shown * 9} colors`;
    }
    if (emptyEl) {
      emptyEl.hidden = shown > 0;
      emptyEl.style.display = shown > 0 ? 'none' : 'block';
    }
  };

  buttons.forEach(btn => bin.on(btn, 'click', () => apply(btn.dataset.filter)));
  apply('all');
  return bin.destroy;
}

/* ========================================================================== *
 * 14. Palette detail slide-over
 * Markup:
 *   <button data-open> inside each [data-card data-name data-brand data-hexes]
 *   <div data-modal hidden style="display:none">
 *     <div data-scrim></div>
 *     <div data-panel>
 *       <button data-close>✕</button>
 *       <p data-mbrand></p><h2 data-mname></h2><p data-mmood></p>
 *       <div data-mcolors></div>
 *     </div>
 *   </div>
 *
 * CRITICAL: when closed the dialog must be BOTH `hidden` and `display:none`.
 * A transparent full-screen scrim left in the layout swallows the first click
 * anywhere on the page — this was a real bug in the prototype.
 * ========================================================================== */

export function initPaletteModal(root = document) {
  const modal = root.querySelector('[data-modal]');
  if (!modal) return () => {};

  const bin = createBin();
  const scrim = modal.querySelector('[data-scrim]');
  const panel = modal.querySelector('[data-panel]');
  const closeBtn = modal.querySelector('[data-close]');
  let lastFocused = null;

  const hide = () => { modal.hidden = true; modal.style.display = 'none'; };
  hide();

  const open = card => {
    const hexes = (card.dataset.hexes || '').split(',').filter(Boolean);
    const paragraphs = card.querySelectorAll('p');

    const nameEl = modal.querySelector('[data-mname]');
    const brandEl = modal.querySelector('[data-mbrand]');
    const moodEl = modal.querySelector('[data-mmood]');
    if (nameEl) nameEl.textContent = card.dataset.name || '';
    if (brandEl) brandEl.textContent = card.dataset.brand || 'Palette';
    if (moodEl && paragraphs.length) {
      moodEl.textContent = paragraphs[paragraphs.length - 1].textContent;
    }

    const box = modal.querySelector('[data-mcolors]');
    if (box) {
      box.textContent = '';
      hexes.forEach(hex => {
        const dark = isDarkHex(hex);
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;gap:16px;' +
          `padding:16px 18px;cursor:pointer;background:${hex};color:${dark ? '#F5F2EA' : '#292825'}`;

        const value = document.createElement('span');
        value.textContent = hex;
        value.style.cssText = 'font-size:12.5px;letter-spacing:.12em';

        const action = document.createElement('span');
        action.textContent = 'Copy';
        action.style.cssText =
          'font-size:10px;letter-spacing:.2em;text-transform:uppercase;opacity:.7';

        row.append(value, action);
        row.addEventListener('click', async () => {
          await copyText(hex);
          action.textContent = 'Copied';
          setTimeout(() => { action.textContent = 'Copy'; }, 1400);
        });
        box.append(row);
      });
    }

    modal.hidden = false;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      if (scrim) scrim.style.opacity = '1';
      if (panel) panel.style.transform = 'translateX(0)';
    });

    lastFocused = document.activeElement;
    if (closeBtn) closeBtn.focus();
  };

  const close = () => {
    if (scrim) scrim.style.opacity = '0';
    if (panel) panel.style.transform = 'translateX(100%)';
    bin.timer(setTimeout(hide, 620));
    if (lastFocused) lastFocused.focus();
  };

  root.querySelectorAll('[data-open]').forEach(btn => {
    bin.on(btn, 'click', () => {
      const card = btn.closest('[data-card]');
      if (card) open(card);
    });
  });
  if (scrim) bin.on(scrim, 'click', close);
  if (closeBtn) bin.on(closeBtn, 'click', close);
  bin.on(document, 'keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  const destroy = bin.destroy;
  destroy.open = open;
  destroy.close = close;
  return destroy;
}

/* ========================================================================== *
 * 15. Swatch hover: expand + hex tooltip + click to copy
 * Markup: [data-swatches] containing [data-hex] buttons; a floating
 *         [data-tip] element positioned fixed.
 * ========================================================================== */

export function initSwatches(root = document) {
  const tip = root.querySelector('[data-tip]');
  const bin = createBin();

  root.querySelectorAll('[data-swatches]').forEach(group => {
    const card = group.closest('[data-card]');
    const paletteName = card ? card.dataset.name || '' : '';
    const swatches = Array.from(group.children);

    swatches.forEach(swatch => {
      const hex = swatch.dataset.hex;
      if (!hex) return;
      swatch.setAttribute('aria-label', `${hex}${paletteName ? `, ${paletteName}` : ''}`);
      swatch.style.transition = `flex-grow .5s ${EASE_SPRING}`;

      const enter = () => {
        swatches.forEach(other => { other.style.flexGrow = other === swatch ? '2.2' : '.88'; });
        if (tip) {
          tip.textContent = paletteName ? `${hex}  ·  ${paletteName}` : hex;
          tip.style.opacity = '1';
        }
      };
      const leave = () => {
        swatches.forEach(other => { other.style.flexGrow = '1'; });
        if (tip) tip.style.opacity = '0';
      };

      bin.on(swatch, 'pointerenter', enter);
      bin.on(swatch, 'pointerleave', leave);
      bin.on(swatch, 'blur', leave);
      bin.on(swatch, 'focus', () => {
        enter();
        if (!tip) return;
        const r = swatch.getBoundingClientRect();
        tip.style.left = `${r.left + r.width / 2}px`;
        tip.style.top = `${r.top}px`;
      });
      bin.on(swatch, 'pointermove', e => {
        if (!tip) return;
        tip.style.left = `${e.clientX}px`;
        tip.style.top = `${e.clientY - 6}px`;
      });
      bin.on(swatch, 'click', async () => {
        await copyText(hex);
        if (tip) tip.textContent = `Copied ${hex}`;
      });
    });
  });

  return bin.destroy;
}

/* ========================================================================== *
 * 16. Product gallery
 * Markup: [data-view="0..n"] stacked images, [data-thumb="0..n"] buttons.
 * ========================================================================== */

export function initProductGallery(root = document) {
  const views = Array.from(root.querySelectorAll('[data-view]'));
  const thumbs = Array.from(root.querySelectorAll('[data-thumb]'));
  if (!views.length) return () => {};
  const bin = createBin();

  const show = index => {
    views.forEach((view, i) => {
      const active = i === index;
      view.style.transition = 'opacity .5s ease';
      view.style.opacity = active ? '1' : '0';
      view.style.pointerEvents = active ? 'auto' : 'none';
    });
    thumbs.forEach((thumb, i) => {
      const active = i === index;
      thumb.setAttribute('aria-selected', active ? 'true' : 'false');
      thumb.style.borderColor = active ? '#292825' : '#D8D2C8';
      thumb.style.opacity = active ? '1' : '.72';
    });
  };

  thumbs.forEach((thumb, i) => {
    bin.on(thumb, 'click', () => show(i));
    bin.on(thumb, 'focus', () => show(i));
  });

  show(0);
  return bin.destroy;
}

/* ========================================================================== *
 * 17. Cart stub  — REPLACE with real commerce state
 * Markup: [data-cart] button containing [data-cart-count];
 *         any number of [data-add] buttons; optional [data-added] live region.
 * ========================================================================== */

export function initCart(root = document, { onAdd } = {}) {
  const button = root.querySelector('[data-cart]');
  const count = root.querySelector('[data-cart-count]');
  if (!button || !count) return () => {};

  const bin = createBin();
  const message = root.querySelector('[data-added]');
  const reduced = prefersReducedMotion();
  let items = 0;

  const bump = () => {
    items += 1;
    count.textContent = String(items);
    button.setAttribute('aria-label', `Cart, ${items} ${items === 1 ? 'item' : 'items'}`);
    if (message) message.textContent = 'Added to cart';
    if (!reduced) {
      count.animate(
        [{ transform: 'translateY(-6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 420, easing: EASE_SPRING }
      );
    }
    if (typeof onAdd === 'function') onAdd(items);
  };

  bin.on(button, 'pointerenter', () => {
    button.style.background = 'rgba(245,242,234,.14)';
    button.style.borderColor = 'currentColor';
  });
  bin.on(button, 'pointerleave', () => {
    button.style.background = 'transparent';
    button.style.borderColor = 'transparent';
  });
  bin.on(button, 'click', bump);
  root.querySelectorAll('[data-add]').forEach(btn => bin.on(btn, 'click', bump));

  return bin.destroy;
}

/* ========================================================================== *
 * 18. Newsletter form
 * Markup: <form data-news><input data-news-input type="email" required></form>
 *         plus <p data-news-msg role="status">
 * ========================================================================== */

export function initNewsletter(root = document, { onSubmit } = {}) {
  const form = root.querySelector('[data-news]');
  if (!form) return () => {};

  const bin = createBin();
  const input = form.querySelector('[data-news-input]');
  const message = root.querySelector('[data-news-msg]');

  if (input) {
    bin.on(input, 'focus', () => {
      input.style.borderColor = 'rgba(245,242,234,.7)';
      input.style.background = 'rgba(245,242,234,.12)';
    });
    bin.on(input, 'blur', () => {
      input.style.borderColor = 'rgba(245,242,234,.34)';
      input.style.background = 'rgba(245,242,234,.06)';
    });
  }

  bin.on(form, 'submit', e => {
    e.preventDefault();
    if (!input || !input.value || !input.checkValidity()) {
      if (message) message.textContent = 'Please enter a valid email';
      return;
    }
    if (message) message.textContent = 'Thank you — the next palette is on its way';
    if (typeof onSubmit === 'function') onSubmit(input.value);
    input.value = '';
  });

  return bin.destroy;
}

/* ========================================================================== *
 * 19. Responsive grid switch — PORTING NOTE
 * The prototype had to drive breakpoints from JS because it could only use
 * inline styles. In a real codebase, DELETE this and use CSS media queries or
 * Tailwind breakpoints. Kept only so the reference behaviour is complete.
 * Markup: [data-responsive-grid='{"wide":"1.05fr 1fr","narrow":"1fr"}']
 * ========================================================================== */

export function initResponsiveGrids(root = document, { breakpoint = 900 } = {}) {
  const grids = Array.from(root.querySelectorAll('[data-responsive-grid]'));
  if (!grids.length) return () => {};
  const bin = createBin();

  const apply = () => {
    const narrow = window.innerWidth < breakpoint;
    grids.forEach(grid => {
      let config;
      try { config = JSON.parse(grid.dataset.responsiveGrid); } catch { return; }
      grid.style.gridTemplateColumns = narrow ? config.narrow : config.wide;
    });
  };

  bin.on(window, 'resize', apply);
  apply();
  return bin.destroy;
}

/* ========================================================================== *
 * Content data — mirrors what the prototype hard-codes.
 * In production these come from your database. Hex values are exact and are
 * product content: do not adjust them for visual reasons.
 * ========================================================================== */

export const PALETTES = [
  { name: 'Sea Salt', brand: 'Sherwin Williams',
    description: 'Cool ivory and sea glass, grounded by deep navy and charcoal.',
    colors: ['#DCDDD8','#EDEAE0','#F0E1D8','#D1C7B8','#CDD2CA','#C8CBC4','#596E79','#2F3D4C','#434341'] },
  { name: 'Greek Villa', brand: 'Sherwin Williams',
    description: 'Sunlit plaster, soft olive and a quiet slate blue.',
    colors: ['#EDECE6','#F0ECE2','#DFD3C3','#C8BCAB','#95978A','#CDD2CA','#708D9E','#7B8070','#5D6F7F'] },
  { name: 'Redend Point', brand: 'Sherwin Williams',
    description: 'Warm plaster and stone lifting into soft brick and clay.',
    colors: ['#EDEAE0','#E6DFD3','#D1C7B8','#95978A','#C0B2A2','#AE8E7E','#AC6B53','#7A8076','#434341'] },
  { name: 'Anew Gray', brand: 'Sherwin Williams',
    description: 'Greige, mist and muted sage — restrained and architectural.',
    colors: ['#E2DED8','#D3CEC4','#C8CBC4','#A6B2B5','#BFB6AA','#95978A','#92948D','#908A83','#5D6F7F'] },
  { name: 'Iron Ore', brand: 'Sherwin Williams',
    description: 'Wheat and olive grounded by near-black iron.',
    colors: ['#EDECE6','#EDEAE0','#D1CBC1','#CDB592','#95978A','#AA866E','#7C8E87','#434341','#2F3D4C'] },
  { name: 'Naval', brand: 'Sherwin Williams',
    description: 'Chalky whites and coastal greys resolving into deep navy.',
    colors: ['#EDECE6','#F0ECE2','#E5DFD2','#CDD2CA','#D1CBC1','#ADBBB2','#A6B2B5','#98A9B7','#2F3D4C'] }
];

export const STYLES = [
  { name: 'French Country', blurb: 'Soft, timeless and quietly romantic.',
    colors: ['#EDEAE0','#DFD3C3','#ACAD97','#C2DAE0','#D1C6D2','#EBD1CF','#817A6E','#9BBFC9','#78736E'] },
  { name: 'Coastal Farmhouse', blurb: 'Bright, breezy and grounded in deep navy.',
    colors: ['#EDEAE0','#E6DFD3','#DCD8D0','#DFD3C3','#CDD2D2','#BCCBCE','#CDD2CA','#98A9B7','#2F3D4C'] },
  { name: 'Beach House', blurb: 'Sandy neutrals holding late afternoon light.',
    colors: ['#F2EFE8','#EEE8DD','#E4D7C4','#F2E4DE','#D6DBD4','#ABBFB4','#A6B2B5','#98A9B7','#465667'] },
  { name: 'Cottagecore', blurb: 'Pressed flowers, old books, mauve dusk.',
    colors: ['#EDEAE0','#E6DFD3','#D1C7B8','#CBB8C0','#BFC9D0','#DECABD','#CDD2CA','#7B8070','#708D9E'] },
  { name: 'Cozy Neutral', blurb: 'The quietest room in the house.',
    colors: ['#EDEAE0','#F5F2E8','#DFD3C3','#BFC9D0','#EADCD2','#ACAD97','#7B8070','#9E8F7C','#78736E'] },
  { name: 'Bohemian', blurb: 'Layered, collected, warmly lived in.',
    colors: ['#F0ECE2','#DFD3C3','#CDB592','#BFC9D0','#CDD2CA','#DECABD','#AC6B53','#7B8070','#54504A'] },
  { name: 'Mid-Century', blurb: 'Warm woods, ochre and confident lines.',
    colors: ['#EDEAE0','#D6CEC3','#CBA576','#A0AEAF','#AE8E7E','#AC6B53','#596E79','#7B8070','#54504A'] }
];

export const TESTIMONIALS = [
  { text: 'The palette made choosing colors for our entire living room so much easier. Everything finally feels cohesive.', who: 'Verified Customer' },
  { text: 'I stopped second-guessing paint chips. Nine colors, one mood, and the whole house reads as one idea.', who: 'Verified Customer' },
  { text: 'Our contractor asked who our designer was. It was a palette and an afternoon.', who: 'Verified Customer' },
  { text: 'Every room feels warmer without feeling beige. That balance is exactly what we could not find alone.', who: 'Verified Customer' }
];

/* ========================================================================== *
 * Bootstrap — wires up whatever is present on the current page.
 * Returns a single teardown function.
 * ========================================================================== */

export function initDwellingDream(root = document, options = {}) {
  const {
    navThreshold = 0.72,
    intensity = 1,
    styleNames = STYLES.map(s => s.name),
    testimonials = TESTIMONIALS,
    onAddToCart,
    onNewsletterSubmit
  } = options;

  const teardowns = [
    initScrollProgress(root),
    initNav(root, { threshold: navThreshold }),
    initReveal(root),
    initCounters(root),
    initCursorParallax(root, { intensity }),
    initMagnetic(root, { intensity }),
    initHeroParallax(root, { intensity }),
    initSectionParallax(root),
    initStyleExplorer(root, { names: styleNames, intensity }),
    initHoverCards(root),
    initTestimonials(root, testimonials),
    initComparisonSlider(root),
    initAccordions(root),
    initBrandFilter(root),
    initPaletteModal(root),
    initSwatches(root),
    initProductGallery(root),
    initCart(root, { onAdd: onAddToCart }),
    initNewsletter(root, { onSubmit: onNewsletterSubmit }),
    initResponsiveGrids(root)
  ];

  return () => teardowns.forEach(fn => { if (typeof fn === 'function') fn(); });
}

export default initDwellingDream;
