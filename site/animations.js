// Page motion, built on Motion (the vanilla JS version of Framer Motion).
// Everything is skipped when the visitor prefers reduced motion, and the page
// is fully readable if Motion fails to load.
(function () {
  const root = document.documentElement;
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!M || reduce) {
    root.classList.remove('motion-pending');
    return;
  }

  const { animate, inView, scroll, stagger, press } = M;
  const EASE_OUT = [0.22, 1, 0.36, 1];
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  // ---------- Page-load sequence ----------

  const heroItems = $$('[data-hero]');
  if (heroItems.length) {
    animate(
      heroItems,
      { opacity: [0, 1], y: [18, 0], filter: ['blur(8px)', 'blur(0px)'] },
      { duration: 0.9, delay: stagger(0.08), ease: EASE_OUT }
    );
  }

  const panel = $('.showcase-panel');
  if (panel) {
    animate(panel, { opacity: [0, 1], y: [48, 0] }, { type: 'spring', stiffness: 70, damping: 18, delay: 0.35 });
  }

  const card = $('.result-card');
  if (card) {
    animate(card, { opacity: [0, 1], y: [24, 0], scale: [0.94, 1] }, { type: 'spring', stiffness: 180, damping: 16, delay: 1.1 });
  }

  root.classList.remove('motion-pending');

  // ---------- Scroll-linked: the demo window settles flat as it scrolls in ----------

  const windowEl = $('.showcase-panel > .window');
  if (windowEl && window.matchMedia('(min-width: 720px)').matches) {
    scroll(
      animate(windowEl, { rotateX: [16, 0], scale: [0.93, 1], y: [24, 0] }, { ease: 'linear' }),
      { target: $('.showcase'), offset: ['start end', 'start 0.25'] }
    );
  }

  // ---------- Demo: the result card responds when the link changes ----------

  const form = document.getElementById('demo-form');
  if (form && card) {
    const status = document.getElementById('demo-status');
    let lastSummary = status ? status.textContent : '';
    form.addEventListener('demo:update', () => {
      const summary = status ? status.textContent : '';
      if (summary === lastSummary) return;
      lastSummary = summary;
      animate(card, { scale: [0.97, 1] }, { type: 'spring', stiffness: 400, damping: 15 });
      animate($$('#demo-status li', card), { opacity: [0, 1], x: [-6, 0] }, { duration: 0.35, delay: stagger(0.04), ease: EASE_OUT });
    });
  }

  // ---------- Logo marquee ----------

  const logos = $('.runs .logos');
  if (logos) {
    const viewport = document.createElement('div');
    viewport.className = 'logos-viewport';
    logos.parentNode.insertBefore(viewport, logos);
    viewport.appendChild(logos);
    $$('li', logos).forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      logos.appendChild(copy);
    });
    logos.classList.add('is-marquee');
    const marquee = animate(logos, { x: ['0%', '-50%'] }, { duration: 36, repeat: Infinity, ease: 'linear' });
    viewport.addEventListener('pointerenter', () => { marquee.speed = 0.25; });
    viewport.addEventListener('pointerleave', () => { marquee.speed = 1; });
  }

  // ---------- Reveals as sections scroll into view ----------

  function reveal(targets, keyframes, options, amount) {
    const els = Array.isArray(targets) ? targets : $$(targets);
    if (!els.length) return;
    els.forEach((el) => { el.style.opacity = '0'; });
    els.forEach((el) => {
      inView(el, () => {
        animate(el, keyframes, options);
      }, { amount: amount || 0.25 });
    });
  }

  function revealGroup(container, items, keyframes, options) {
    const host = $(container);
    if (!host) return;
    const els = $$(items, host);
    els.forEach((el) => { el.style.opacity = '0'; });
    inView(host, () => {
      animate(els, keyframes, options);
    }, { amount: 0.3 });
  }

  reveal('.section-head h2, .split-copy h2, .cta h2',
    { opacity: [0, 1], y: [16, 0], filter: ['blur(6px)', 'blur(0px)'] },
    { duration: 0.8, ease: EASE_OUT });

  reveal('.step .panel',
    { opacity: [0, 1], y: [40, 0], scale: [0.97, 1] },
    { type: 'spring', stiffness: 80, damping: 18 });

  revealGroup('.points', 'li',
    { opacity: [0, 1], y: [12, 0] },
    { duration: 0.6, delay: stagger(0.1), ease: EASE_OUT });

  revealGroup('.console-card', '.console-lines li',
    { opacity: [0, 1], x: [-8, 0] },
    { duration: 0.35, delay: stagger(0.22, { startDelay: 0.2 }), ease: 'easeOut' });

  revealGroup('.rules-grid', '.rule',
    { opacity: [0, 1], y: [20, 0] },
    { duration: 0.6, delay: stagger(0.08), ease: EASE_OUT });

  // ---------- Tactile buttons ----------

  press('.button, .preset', (el) => {
    animate(el, { scale: 0.96 }, { type: 'spring', stiffness: 600, damping: 30 });
    return () => animate(el, { scale: 1 }, { type: 'spring', stiffness: 400, damping: 18 });
  });
})();
