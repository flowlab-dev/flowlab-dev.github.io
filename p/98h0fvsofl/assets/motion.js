/* Company Seven concept — motion. Reveal everywhere; GSAP scenes only on desktop without reduced motion. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  // ?static — final state at once (for screenshots and reviewers)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]static\b/.test(location.search);
  const desktop = matchMedia('(min-width: 1024px)').matches;

  if (/[?&]static\b/.test(location.search)) { root.classList.add('static'); document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); }

  // 1. Reveal on scroll (all devices)
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach(e => e.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  // 2. Floating price bar on the product page
  const bar = document.querySelector('.stickybar');
  const after = document.querySelector('[data-bar-after]');
  if (bar && after && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      bar.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(after);
  }

  // 3. Exploded view: static on phones and with reduced motion
  const explode = document.querySelector('[data-scene="explode"]');
  if (explode && (reduced || !desktop)) explode.classList.add('exploded');
  if (reduced || !desktop) return;

  const load = src => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });

  const start = async () => {
    try {
      await load('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
      await load('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js');
      await load('https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js');
    } catch (e) {
      if (explode) explode.classList.add('exploded');
      return;
    }
    const { gsap, ScrollTrigger, Lenis } = window;
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('gs');

    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    // Scene A (home): the refractor arrives and extends its dew shield
    document.querySelectorAll('[data-scene="arrive"]').forEach(sec => {
      const scope = sec.querySelector('.scope-tilt');
      const dew = sec.querySelector('.dew');
      const head = sec.querySelector('.scene-head');
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: sec, start: 'top top', end: '+=110%', pin: true, scrub: 0.6 }
      });
      tl.fromTo(scope, { xPercent: -30, opacity: 0.1 }, { xPercent: 0, opacity: 1, duration: 1 })
        .fromTo(dew, { x: 150 }, { x: 0, duration: 0.6 }, 0.45)
        .fromTo(sec.querySelector('.dims'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.95)
        .fromTo(head, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.1);
    });

    // Scene B (home): NASA missions light up one after another
    document.querySelectorAll('[data-scene="missions"]').forEach(sec => {
      const items = sec.querySelectorAll('.missions li');
      gsap.fromTo(items, { opacity: 0.18 }, {
        opacity: 1, stagger: 0.5, ease: 'none',
        scrollTrigger: { trigger: sec.querySelector('.missions'), start: 'top 75%', end: 'bottom 55%', scrub: 0.5 }
      });
    });

    // Scene C (product): the telescope comes apart into three sections
    if (explode) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: explode, start: 'top top', end: '+=120%', pin: true, scrub: 0.6 }
      });
      tl.to(explode.querySelector('.dims'), { opacity: 0, duration: 0.3 }, 0)
        .to(explode.querySelector('.dew'), { x: -80, duration: 1 }, 0)
        .to(explode.querySelector('.rear'), { x: 80, duration: 1 }, 0)
        .fromTo(explode.querySelectorAll('.labels > div'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.25, duration: 0.5 }, 0.5);
    }

    // Scene E (any): pinned; [data-spin="deg"] rotates to 0 around data-origin="x y" (SVG), [data-fade] appear in turn
    document.querySelectorAll('[data-scene="spin"]').forEach(sec => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: sec, start: 'top top', end: '+=110%', pin: true, scrub: 0.6 }
      });
      sec.querySelectorAll('[data-spin]').forEach(el => {
        tl.fromTo(el, { rotation: +el.dataset.spin, svgOrigin: el.dataset.origin }, { rotation: 0, svgOrigin: el.dataset.origin, duration: 1 }, 0);
      });
      const fades = sec.querySelectorAll('[data-fade]');
      if (fades.length) tl.fromTo(fades, { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.2, duration: 0.4 }, 0.4);
    });

    // Scene D (product): specification rows settle in
    const rows = document.querySelectorAll('.specs > div');
    if (rows.length) {
      gsap.set(rows, { opacity: 0, y: 16 });
      ScrollTrigger.batch(rows, {
        start: 'top 92%',
        onEnter: b => gsap.to(b, { opacity: 1, y: 0, stagger: 0.05, duration: 0.5, ease: 'power2.out' })
      });
    }
    ScrollTrigger.refresh();
  };
  ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 600);
})();
