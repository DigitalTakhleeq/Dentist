/* =========================================================
   Ivora Dental demo | vanilla JS, no dependencies
   Everything is driven by one rAF-throttled scroll loop.
   ========================================================= */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => matchMedia('(max-width: 900px)').matches;
  const vh = () => window.innerHeight;

  /* ---------- nav ---------- */
  const nav = $('[data-nav]');
  const burger = $('[data-burger]');
  const drawer = $('[data-drawer]');
  burger?.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open);
    drawer.classList.toggle('open', open);
  });
  $$('a', drawer).forEach(a => a.addEventListener('click', () => {
    burger.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('open');
  }));

  /* ---------- word split (headline reveal: blur + rise, 0.06s stagger) ---------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const s = document.createElement('span');
            s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part;
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.trim());
  });

  /* ---------- in-view reveals (fire once at 30% visible) ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.25, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .split').forEach(el => {
    if (el.closest('.hero')) return;
    io.observe(el);
  });
  const heroTitle = $('.hero [data-split]');
  heroTitle?.style.setProperty('--base', '.3s');
  window.addEventListener('load', () => requestAnimationFrame(() => heroTitle?.classList.add('in')));
  setTimeout(() => heroTitle?.classList.add('in'), 1200); // safety net

  /* ---------- hero: scroll-driven "clean the tooth" ---------- */
  const hero = $('[data-hero]');
  const stage = $('.hero-stage', hero);
  const words = $$('[data-word]', hero);
  const stateLabel = $('[data-state-label]', hero);
  const status = $('[data-status]', hero);
  let heroIdx = -1, heroStatus = '';
  const WORDS = ['Plaque.', 'Polish.', 'Brilliant.'];

  function updateHero() {
    const total = hero.offsetHeight - stage.offsetHeight;
    const p = reduced ? 1 : clamp(-hero.getBoundingClientRect().top / total);
    window.Tooth?.setProgress(p);                                 // 3D tooth eases toward this scroll value
    if (!window.Tooth) paintHero(clamp((p - 0.08) / 0.77));
  }
  function paintHero(c) {                                          // c = smoothed clean amount from the tooth
    hero.style.setProperty('--c', c.toFixed(4));
    const idx = c < 0.35 ? 0 : c < 0.9 ? 1 : 2;
    if (idx !== heroIdx) {
      heroIdx = idx;
      words.forEach((w, i) => w.classList.toggle('is-on', i === idx));
      stateLabel.textContent = WORDS[idx];
    }
    const s = c < 0.02 ? 'Scroll to clean' : c < 0.98 ? 'Removing plaque' : 'Polished and sparkling';
    if (s !== heroStatus) { heroStatus = s; status.textContent = s; }
  }
  if (window.Tooth) window.Tooth.onFrame = paintHero;
  if (reduced) paintHero(1);

  /* ---------- about: words darken as you scroll ---------- */
  const about = $('[data-about]');
  const aboutText = $('[data-reveal-words]', about);
  const rw = [];
  (function wrap() {
    const walk = node => Array.from(node.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const s = document.createElement('span'); s.className = 'rw'; s.textContent = part;
          rw.push(s); frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(aboutText);
  })();
  let aboutOn = -1;
  function updateAbout() {
    let p;
    if (reduced) p = 1;
    else if (mobile()) {
      const r = aboutText.getBoundingClientRect();
      p = clamp((vh() * 0.85 - r.top) / (vh() * 0.45 + r.height * 0.6));
    } else {
      const r = about.getBoundingClientRect();
      p = clamp(-r.top / (about.offsetHeight - vh()) * 1.25);
    }
    const n = Math.round(p * rw.length);
    if (n === aboutOn) return;
    aboutOn = n;
    rw.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  /* ---------- treatments: vertical scroll drives a horizontal track ---------- */
  const treat = $('[data-treat]');
  const track = $('[data-track]', treat);
  const viewport = $('.treat-viewport', treat);
  let treatDist = 0;
  function sizeTreat() {
    if (mobile()) { treat.style.height = ''; track.style.transform = ''; return; }
    const padL = parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
    treatDist = Math.max(0, track.scrollWidth - (window.innerWidth - padL));
    treat.style.height = (vh() + treatDist) + 'px';
  }
  function updateTreat() {
    if (mobile()) return;
    const p = clamp(-treat.getBoundingClientRect().top / (treatDist || 1));
    track.style.transform = `translate3d(${(-p * treatDist).toFixed(1)}px,0,0)`;
  }

  /* ---------- technology: three pinned steps ---------- */
  const tech = $('[data-tech]');
  const tms = $$('.tm', tech);
  const steps = $$('.step', tech);
  let techIdx = -1;
  function updateTech() {
    if (mobile()) return;
    const p = clamp(-tech.getBoundingClientRect().top / (tech.offsetHeight - vh()));
    const idx = Math.min(2, Math.floor(p * 3));
    if (idx === techIdx) return;
    techIdx = idx;
    tms.forEach((t, i) => t.classList.toggle('is-on', i === idx));
    steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
  }

  /* ---------- scroll loop ---------- */
  let ticking = false;
  function frame() {
    ticking = false;
    nav.classList.toggle('is-scrolled', window.scrollY > 10);
    updateHero(); updateAbout(); updateTreat(); updateTech();
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { sizeTreat(); techIdx = -1; aboutOn = -1; request(); });
  window.addEventListener('load', () => { sizeTreat(); request(); });
  sizeTreat(); frame();
  if (document.fonts?.ready) document.fonts.ready.then(() => { sizeTreat(); request(); });

  /* ---------- results: tabs + before/after slider ---------- */
  const px = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
  const ba = $('[data-ba]');
  const handle = $('[data-handle]', ba);
  const before = $('[data-before]', ba), after = $('[data-after]', ba);
  const statA = $('[data-stat-a]'), statB = $('[data-stat-b]');
  const setPos = v => {
    v = clamp(v, 2, 98);
    ba.style.setProperty('--pos', v + '%');
    handle.setAttribute('aria-valuenow', Math.round(v));
  };
  const fromEvent = e => { const r = ba.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
  let dragging = false;
  ba.addEventListener('pointerdown', e => { dragging = true; ba.setPointerCapture(e.pointerId); fromEvent(e); });
  ba.addEventListener('pointermove', e => { if (dragging) fromEvent(e); });
  ['pointerup', 'pointercancel'].forEach(t => ba.addEventListener(t, () => { dragging = false; }));
  handle.addEventListener('keydown', e => {
    const cur = parseFloat(getComputedStyle(ba).getPropertyValue('--pos')) || 50;
    if (e.key === 'ArrowLeft') { setPos(cur - 4); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos(cur + 4); e.preventDefault(); }
  });
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.toggle('is-on', t === tab));
    statA.textContent = tab.dataset.a; statB.textContent = tab.dataset.b;
    before.src = after.src = px(tab.dataset.img);
    setPos(50);
  }));

  /* ---------- stories: seamless two-row marquee ---------- */
  function buildMarquee() {
    $$('.m-row').forEach(row => {
      $$('[data-clone]', row).forEach(n => n.remove());
      const originals = Array.from(row.children);
      const gap = parseFloat(getComputedStyle(row).columnGap) || 20;
      const setW = originals.reduce((s, n) => s + n.getBoundingClientRect().width + gap, 0);
      if (!setW) return;
      const copies = Math.ceil(window.innerWidth / setW) + 1;
      for (let i = 0; i < copies; i++) originals.forEach(n => {
        const c = n.cloneNode(true); c.dataset.clone = '1'; c.setAttribute('aria-hidden', 'true'); row.append(c);
      });
      row.style.setProperty('--shift', setW + 'px');
      row.style.setProperty('--dur', (setW / 45).toFixed(1) + 's');
    });
  }
  buildMarquee();
  let mt; window.addEventListener('resize', () => { clearTimeout(mt); mt = setTimeout(buildMarquee, 250); });

  /* ---------- FAQ accordion ---------- */
  const items = $$('.acc-item');
  items.forEach(item => $('.acc-q', item).addEventListener('click', () => {
    const open = !item.classList.contains('is-open');
    items.forEach(i => { i.classList.remove('is-open'); $('.acc-q', i).setAttribute('aria-expanded', 'false'); });
    if (open) { item.classList.add('is-open'); $('.acc-q', item).setAttribute('aria-expanded', 'true'); }
  }));

  /* ---------- booking form (demo only: nothing is sent) ---------- */
  const form = $('[data-form]');
  const label = $('[data-form-label]', form);
  const note = $('[data-form-note]', form);
  const sel = $('select', form);
  sel.addEventListener('change', () => sel.classList.toggle('has-val', !!sel.value));
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = $('.form-btn', form);
    btn.disabled = true; label.textContent = 'Request received';
    note.textContent = 'Demo form: no data was sent. Connect your own backend to go live.';
    setTimeout(() => { form.reset(); sel.classList.remove('has-val'); btn.disabled = false; label.textContent = 'Book my visit'; note.textContent = ''; }, 4500);
  });
})();
