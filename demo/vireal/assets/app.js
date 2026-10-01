// Vireal Aero — язык, тема, прокрутка, связь страницы со сценой
const doc = document.documentElement;
doc.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

/* ---------- тексты ---------- */
const EN = {
  skip: 'Skip to content', sections: 'Sections',
  'nav.lens': 'Lenses', 'nav.build': 'Design', 'nav.colors': 'Colors', 'nav.specs': 'Specs',
  langBtn: 'RU', langAria: 'RU — переключить на русский', themeAria: 'Switch theme',
  stageAria: '3D model of Vireal Aero sunglasses that turns as you scroll',
  'hero.title': 'See the light.', 'hero.lead': 'A slim metal frame and lenses that shimmer like a soap bubble.',
  'hero.cta': 'Choose a color', 'hero.more': 'Specs', 'hero.hint': 'Scroll',
  'lens.eyebrow': 'Lenses', 'lens.t1': 'Color that', 'lens.t2': 'moves.',
  'lens.b1': 'A coating thinner than a soap film splits light into hues.',
  'lens.b2': 'Turn your head and the tint flows from violet to teal.',
  'lens.b3': 'And your eyes stay fully covered: UV400 filter.',
  'build.eyebrow': 'Design', 'build.title': 'Built with precision.',
  'build.c1b': '5 links', 'build.c1': 'in every hinge', 'build.c2b': '0.8 mm', 'build.c2': 'of metal in each temple', 'build.c3b': '21 g', 'build.c3': 'all in',
  'colors.eyebrow': 'Colors', 'colors.title': 'Your shade.', 'colors.frame': 'Frame', 'colors.lens': 'Lenses',
  'colors.silver': 'Silver', 'colors.graphite': 'Graphite', 'colors.gold': 'Gold', 'colors.iris': 'Iris', 'colors.ocean': 'Ocean', 'colors.amber': 'Amber',
  'specs.eyebrow': 'Specs', 'specs.title': 'The essentials, in numbers.', 'specs.w': 'Weight', 'specs.uv': 'Protection', 'specs.t': 'Temple thickness',
  'specs.h': 'Links per hinge', 'specs.f': 'Frame colors', 'specs.l': 'Lens coatings', 'u.g': 'g', 'u.mm': 'mm',
  'final.title': 'Your product can have a page like this.',
  'final.lead': 'Built by FlowLab with Claude Code: a real 3D model, scroll animation, two languages and two themes.',
  'final.cta': 'Contact FlowLab', 'final.more': 'More work',
  'foot.demo': 'Concept demo: the Vireal brand, product and specs are fictional.',
  'foot.model': '3D model: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SunglassesKhronos">Sunglasses Khronos</a> (Khronos Group; Eric Chadwick, Darmstadt Graphics Group), <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Modified: temple logos replaced, materials changed.',
  title: 'Vireal Aero — see the light · FlowLab demo', pick: (f, l) => `Frame: ${f} · lenses: ${l}`,
};
const RU = { title: document.title, pick: (f, l) => `Оправа: ${f} · линзы: ${l}`, langAria: 'EN — switch to English', themeAria: 'Сменить тему', sections: 'Разделы', stageAria: '3D-модель очков Vireal Aero: прокрутка поворачивает её' };
// русские тексты берём из разметки
document.querySelectorAll('[data-i18n]').forEach((el) => { RU[el.dataset.i18n] = el.textContent; });
document.querySelectorAll('[data-i18n-html]').forEach((el) => { RU[el.dataset.i18nHtml] = el.innerHTML; });

function setLang(l) {
  const D = l === 'en' ? EN : RU;
  doc.lang = l;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const v = D[el.dataset.i18n]; if (v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { const v = D[el.dataset.i18nHtml]; if (v != null) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = D[el.dataset.i18nAria]; if (v != null) el.setAttribute('aria-label', v); });
  document.title = D.title;
  updatePickNote();
}

/* ---------- тема ---------- */
let stage = null;
function setTheme(t) {
  doc.dataset.theme = t;
  stage && stage.setTheme(t);
}
document.getElementById('theme').addEventListener('click', () => {
  const t = doc.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(t); store.set('vireal-theme', t);
});
document.getElementById('lang').addEventListener('click', () => {
  const l = doc.lang === 'en' ? 'ru' : 'en';
  setLang(l); store.set('vireal-lang', l);
});

/* ---------- цвета ---------- */
const pick = { frame: 'silver', lens: 'iris' };
function updatePickNote() {
  const D = doc.lang === 'en' ? EN : RU;
  const n = document.getElementById('pick-note');
  n.textContent = D.pick(D['colors.' + pick.frame], D['colors.' + pick.lens]);
}
document.querySelectorAll('.swatches').forEach((group) => {
  const btns = [...group.querySelectorAll('button')];
  btns.forEach((b, i) => {
    b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
    b.addEventListener('click', () => choose(b));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const nb = btns[(i + d + btns.length) % btns.length];
      choose(nb); nb.focus();
    });
  });
  function choose(b) {
    btns.forEach((x) => { const on = x === b; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
    if (b.dataset.frame) { pick.frame = b.dataset.frame; stage && stage.setFrame(pick.frame); }
    if (b.dataset.lens) { pick.lens = b.dataset.lens; stage && stage.setLens(pick.lens); }
    updatePickNote();
  }
});
updatePickNote();
if (doc.lang === 'en') setLang('en');

/* ---------- шапка, появление, счётчики ---------- */
const nav = document.getElementById('nav');
const onScrollNav = () => nav.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.2 });
document.querySelectorAll('[data-anim]').forEach((el, i) => { el.style.transitionDelay = (i * 90) + 'ms'; io.observe(el); });

const fmt = (v, dec) => (doc.lang === 'en' ? v.toFixed(dec) : v.toFixed(dec).replace('.', ','));
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
  if (reduced) return;
  const t0 = performance.now(), dur = 1100;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt(to * k, dec);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => cio.observe(el));

/* ---------- состояния сцены по прокрутке ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);
const band = (p, a, b) => smooth(clamp01((p - a) / (b - a)));
function mix(A, B, t) { const o = {}; for (const k in A) o[k] = lerp(A[k], k in B ? B[k] : A[k], t); return o; }

// место модели считаем по вёрстке: свободная полоса экрана (px) → поза вписывается в неё по настоящим границам модели
// align: 0 — прижать к верху полосы, 0.5 — по центру; maxW — предельная ширина в долях экрана (0…2)
function place(pose, top, bottom, maxScale, x = pose.x, align = 0.5, maxW = wideNow() ? 0.9 : 1.7) {
  if (!stage) return pose;
  const H = innerHeight;
  const b = stage.measure(pose);
  const t = 1 - 2 * top / H, btm = 1 - 2 * bottom / H; // в −1…1
  const s = Math.min(maxScale, (t - btm) / (b.y1 - b.y0) * 0.94, maxW / (b.x1 - b.x0));
  const slack = (t - btm) - s * (b.y1 - b.y0);
  return { ...pose, scale: s, x: x - s * (b.x0 + b.x1) / 2 * (x === 0 ? 1 : 0), y: t - slack * align - s * b.y1 };
}
const wideNow = () => innerWidth >= 900;

function poses() {
  const wide = wideNow();
  const H = innerHeight;
  const base = { x: 0, y: 0, scale: 1, rx: 0, ry: 0, rz: 0, fold: 0, shift: 0, idle: 0, pz: 0, ex: 0 };
  const cta = document.querySelector('.hero .cta').getBoundingClientRect().bottom + scrollY;
  const col = document.getElementById('colors');
  const eb = col.querySelector('.eyebrow');
  const ebTop = H - (col.offsetTop + col.offsetHeight - (eb.getBoundingClientRect().top + scrollY));
  const st = document.querySelector('#build .sticky').getBoundingClientRect();
  const tb = document.querySelector('#build .chapter__copy--top').getBoundingClientRect().bottom - st.top;
  const ct = document.querySelector('#build .callouts').getBoundingClientRect().top - st.top;
  const lensCopy = document.querySelector('#lens .chapter__copy');
  const lc = lensCopy.getBoundingClientRect().top - document.querySelector('#lens .sticky').getBoundingClientRect().top;
  const P = {
    hero:   wide ? place({ ...base, rx: 0.2, ry: -0.9, rz: 0.05, idle: 1 }, cta + 20, H - 16, 1.15)
                 : place({ ...base, rx: 0.3, ry: -0.5, rz: 0.03, idle: 1 }, cta + 28, H - 24, 1.2, 0, 0.3, 1.7),
    lensA:  wide ? { ...base, x: 0.40, scale: 0.84, rx: 0.06, ry: 0.6 } : place({ ...base, rx: 0.06, ry: 0.6 }, 72, lc - 12, 0.95),
    lensB:  wide ? { ...base, x: 0.40, scale: 0.92, rx: 0.02, ry: -0.6, shift: 1 } : place({ ...base, rx: 0.02, ry: -0.6, shift: 1 }, 72, lc - 12, 1),
    // разбор: поза считается по разобранной модели, чтобы все детали поместились между заголовком и цифрами
    // собранная (A0/B0) и разобранная (A1/B1) — масштаб плавно меняется вместе с разлётом
    buildA0: place({ ...base, rx: 0.36, ry: -0.6 }, tb + 12, ct - 12, 2, 0, 0.5, wide ? 0.82 : 1.7),
    buildB0: place({ ...base, rx: 0.3, ry: -0.3 }, tb + 12, ct - 12, 2, 0, 0.5, wide ? 0.82 : 1.7),
    buildA1: place({ ...base, rx: 0.36, ry: -0.6, ex: 1 }, tb + 12, ct - 12, 2, 0, 0.5, wide ? 0.9 : 1.8),
    buildB1: place({ ...base, rx: 0.3, ry: -0.3, ex: 1 }, tb + 12, ct - 12, 2, 0, 0.5, wide ? 0.9 : 1.8),
    colors: { ...place({ ...base, rx: -0.06, ry: 0.28 }, 92, ebTop - 16, 0.85), idle: 0.6 },
  };
  return P;
}

function startScroll() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return null;
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (!coarse && !reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { duration: 1.4 });
    }));
  }
  const seg = (trigger, start, end) => ScrollTrigger.create({ trigger, start, end });
  const S = {
    hero: seg('#hero', 'top top', 'bottom top'),
    lens: seg('#lens', 'top top', 'bottom bottom'),
    toBuild: seg('#build', 'top bottom', 'top top'),
    build: seg('#build', 'top top', 'bottom bottom'),
    toColors: seg('#colors', 'top bottom', 'bottom bottom'),
  };
  // строки главы зажигаются по очереди; текст не гаснет — уезжает вместе с главой, пустых кадров на переходах нет
  const beats = (sel, at) => {
    const items = [...document.querySelectorAll(sel + ' [data-beat]')];
    ScrollTrigger.create({ trigger: sel, start: 'top top', end: 'bottom bottom', onUpdate: (st) => {
      items.forEach((el, i) => el.classList.toggle('is-on', st.progress >= at[i]));
    }, onLeaveBack: () => items.forEach((el) => el.classList.remove('is-on')) });
  };
  // мелкий текст гаснет в начале перехода к следующей главе — очки едут, не пересекая абзацы
  const fadeOn = (trigger, start, end, sel, len = 0.28) => {
    const els = [...document.querySelectorAll(sel)];
    ScrollTrigger.create({ trigger, start, end, onUpdate: (st) => { const o = String(1 - band(st.progress, 0, len)); els.forEach((el) => { el.style.opacity = o; }); },
      onLeaveBack: () => els.forEach((el) => { el.style.opacity = ''; }) });
  };
  fadeOn('#build', 'top bottom', 'top top', '#lens .beats, #lens .eyebrow, #lens .h1');
  fadeOn('#colors', 'top bottom', 'bottom bottom', '#build .callouts', 0.1);
  beats('#lens', [0.08, 0.38, 0.66]);
  beats('#build', [0.03, 0.03, 0.03]); // все три цифры сразу (лесенка — задержкой в CSS)
  return { S, lenis, ScrollTrigger };
}

function stateAt(y, S, P) {
  const pr = (st) => (st.end > st.start ? clamp01((y - st.start) / (st.end - st.start)) : (y >= st.start ? 1 : 0));
  if (y < S.hero.end) return mix(P.hero, P.lensA, smooth(pr(S.hero)));
  if (y < S.lens.end) return mix(P.lensA, P.lensB, pr(S.lens));
  if (y < S.toBuild.end) return { ...mix(P.lensB, P.buildA0, smooth(pr(S.toBuild))), ex: 0 };
  if (y < S.build.end) {
    const p = pr(S.build);
    const ex = band(p, 0.1, 0.42) - band(p, 0.64, 0.9); // разлетелись → повисели → собрались
    const sp = smooth(p);
    const s = mix(mix(P.buildA0, P.buildB0, sp), mix(P.buildA1, P.buildB1, sp), ex);
    s.ex = ex;
    return s;
  }
  const s = mix(P.buildB0, P.colors, band(pr(S.toColors), 0.08, 1));
  s.ex = 0;
  return s;
}

/* ---------- запуск сцены ---------- */
// видеокарта: проверяем сразу после первой отрисовки (создание WebGL не держит показ текста).
// Без видеокарты или WebGL — класс no3d и картинка, тяжёлую 3D-библиотеку не грузим; с ней — тот же контекст отдаём сцене.
const showFallback = () => doc.classList.add('no3d');
let gl = null;
function probe() {
  try {
    const c = document.getElementById('stage');
    const g = c.getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!g) return null;
    const x = g.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software|basic render/i.test(x ? String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)) : '') ? null : g;
  } catch (e) { return null; }
}
function preload3d() {
  // модель и 3D-библиотека начинают грузиться сразу, но только там, где 3D правда покажется
  for (const [href, as] of [['assets/model/aero.gltf', 'fetch'], ['assets/model/aero.bin', 'fetch'], ['assets/vendor/three/three.module.min.js', 'modulepreload']]) {
    const l = document.createElement('link');
    if (as === 'modulepreload') l.rel = as; else { l.rel = 'preload'; l.as = as; }
    l.href = href; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
}

async function boot() {
  if (!gl) return;
  const canvas = document.getElementById('stage');
  const fail = showFallback;
  let mod;
  try { mod = await import('./scene.js'); } catch (e) { fail(); return; }
  try {
    stage = await mod.createStage(canvas, { reduced, mobile: coarse, context: gl });
  } catch (e) { console.warn('3D off:', e.message); fail(); return; }
  stage.setTheme(doc.dataset.theme);
  stage.setFrame(pick.frame); stage.setLens(pick.lens);
  window.__stage = stage;

  const sc = reduced ? null : startScroll();
  if (!sc) { stage.set({ x: 0, y: 0, scale: 1, rx: 0.15, ry: -0.6, rz: 0, fold: 0, shift: 0, idle: 0, pz: 0 }, true); return; }
  let P = poses();
  const update = () => stage.set(stateAt(scrollY, sc.S, P));
  stage.set(stateAt(scrollY, sc.S, P), true);
  addEventListener('scroll', update, { passive: true });
  sc.ScrollTrigger.addEventListener('refresh', () => { P = poses(); update(); });
  // спрятать сцену, когда её закрыли сплошные блоки
  sc.ScrollTrigger.create({ trigger: '#specs', start: 'top top', onToggle: (st) => stage.setVisible(!st.isActive), end: () => 'max' });
  window.__scroll = sc;
  window.__poses = () => P;
}
// 3D — после загрузки страницы, чтобы текст первого экрана появился сразу
const later = () => ('requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 600 }) : setTimeout(boot, 50));
requestAnimationFrame(() => setTimeout(() => {
  gl = probe();
  if (!gl) { showFallback(); return; }
  preload3d();
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}, 0));
