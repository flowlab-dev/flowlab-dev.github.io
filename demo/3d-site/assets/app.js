// Lantern One v2 - язык, тема, прокрутка, форма, связь страницы со сценой
const doc = document.documentElement;
doc.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

/* ---------- тексты ---------- */
const EN = {
  skip: 'Skip to content', sections: 'Sections',
  'nav.inside': 'Inside', 'nav.specs': 'Specs', 'nav.privacy': 'Privacy', 'nav.reserve': 'Reserve',
  langBtn: 'RU', langAria: 'RU: переключить на русский', themeAria: 'Switch theme',
  stageAria: '3D model of the Lantern One computer that opens up in layers as you scroll',
  'hero.t1': 'Your AI.', 'hero.t2': 'In your room.',
  'hero.lead': 'Lantern One runs large language models on your desk. Contracts, patient notes and unreleased manuscripts never leave the building.',
  'hero.cta': 'Reserve a unit', 'hero.more': 'See inside',
  'hero.demo': 'Concept demo: the company and the product are fictional',
  'inside.eyebrow': 'Inside', 'inside.title': 'Four layers. One quiet box.',
  's1.t': 'Glass shell', 's1.b': 'Low-iron glass over a recycled aluminium frame. The light of the core shows how busy the machine is, so you never need a status screen.',
  's2.t': 'The core', 's2.b': 'A neural processor with 128 GB of memory shared by every model you load. Brighter light means more work in progress.',
  's3.t': 'Compute board', 's3.b': 'Storage for your documents and models, and two network ports you can switch off to work fully offline.',
  's4.t': 'Silent cooling', 's4.b': 'A copper vapour chamber and one slow fan keep it at 31 dB under full load, about as loud as a quiet library.',
  'specs.eyebrow': 'Specs', 'specs.title': 'Built for long days of work.',
  'specs.mem': 'of unified memory for models and documents', 'specs.par': 'parameters in the largest model it runs locally',
  'specs.db': 'of noise at full load', 'specs.w': 'peak power, from a normal wall socket',
  'u.gb': 'GB', 'u.b': 'B', 'u.db': 'dB', 'u.w': 'W',
  'privacy.eyebrow': 'Privacy', 'privacy.title': 'Nothing leaves the room.',
  'privacy.lead': "Cloud AI means sending your files to someone else's servers. Lantern One reads them where they already are.",
  'p1.t': 'Works offline', 'p1.b': 'Unplug the network cable and everything still works: chat, search, summaries and transcription.',
  'p2.t': 'Your models stay yours', 'p2.b': 'Fine-tune on your own documents. The weights live on the device and can be exported or wiped at any time.',
  'p3.t': 'A log you can read', 'p3.b': 'Every question, file and answer is listed in plain language, so an auditor can see exactly what the machine did.',
  'uses.eyebrow': 'Who it is for', 'uses.title': 'Made for work you cannot upload.',
  'u1.t': 'Law firms', 'u1.b': 'Search ten years of case files and draft first versions without privileged documents reaching a third party.',
  'u2.t': 'Clinics', 'u2.b': "Turn consultation recordings into notes on a machine that stays behind the clinic's own door.",
  'u3.t': 'Studios and publishers', 'u3.b': "Summarise manuscripts and scripts before release, with no risk of them turning up in someone's training data.",
  'reserve.eyebrow': 'Reserve', 'reserve.title': 'Reserve a Lantern One.',
  'reserve.lead': 'First units ship in spring. Reserving costs nothing, and you can cancel with one email.',
  'reserve.price': '$4,800', 'reserve.note': 'per unit, with three years of updates',
  'f.name': 'Your name', 'f.email': 'Work email', 'f.team': 'Team size', 'f.choose': 'Choose…',
  'f.t1': '1–10 people', 'f.t2': '11–50 people', 'f.t3': '51–200 people', 'f.t4': 'More than 200', 'f.submit': 'Reserve a unit',
  'faq.title': 'Questions',
  q1: 'Which models can it run?', a1: 'Open-weight language models up to about 70 billion parameters, speech-to-text and image models. New models install from a USB drive or, if you allow it, over the network.',
  q2: 'Does it need an internet connection?', a2: 'Only for software updates, and you can install those from a USB drive instead. Everyday work happens entirely offline.',
  q3: 'How many people can use it at once?', a3: 'Around twenty people chatting at the same time, or five running long document jobs. Teams bigger than that usually add a second unit.',
  q4: 'What happens to the data if we return it?', a4: 'You wipe it from the settings screen before sending it back, or keep the storage module and we replace it at no cost.',
  'final.title': 'Your product can have a page like this.',
  'final.lead': 'Built by FlowLab with Claude Code: a 3D model, scroll animation, two languages and two themes.',
  'final.cta': 'Contact FlowLab', 'final.more': 'More work',
  'foot.demo': 'Self-initiated concept demo by Flow Lab. Candlewren, Lantern One and every number on this page are invented. Lantern One is not for sale. A page like this for your product: from $1,500, in 3 weeks. <a href="https://flowlab-dev.github.io/work/3d-site/">How it was built and what it costs</a>',
  'foot.made': '3D model, design and code: FlowLab.',
  title: 'Lantern One: your AI, in your room · FlowLab demo',
  err: { name: 'Enter your name.', long: 'Use 80 characters or fewer.', email: 'Enter your work email.', bad: 'Enter an email like name@company.com.', team: 'Choose your team size.' },
  done: (n, t, e) => `Thanks, ${n}. This is a demo, so nothing was sent. On a live site Candlewren would get your reservation for a team of ${t} and email ${e} a confirmation.`,
};
const RU = {
  title: document.title, langAria: 'EN: switch to English', themeAria: 'Сменить тему', sections: 'Разделы',
  stageAria: '3D-модель компьютера Lantern One: прокрутка раскрывает ее на слои',
  err: { name: 'Напишите, как вас зовут.', long: 'Не больше 80 символов.', email: 'Укажите рабочую почту.', bad: 'Почта должна быть вида name@company.com.', team: 'Выберите размер команды.' },
  done: (n, t, e) => `Спасибо, ${n}. Это демо, поэтому ничего не отправлено. На настоящем сайте Candlewren получила бы бронь для команды ${t} и прислала подтверждение на ${e}.`,
};
document.querySelectorAll('[data-i18n]').forEach((el) => { RU[el.dataset.i18n] = el.textContent; });
document.querySelectorAll('[data-i18n-html]').forEach((el) => { RU[el.dataset.i18nHtml] = el.innerHTML; });

function setLang(l) {
  const D = l === 'en' ? EN : RU;
  doc.lang = l;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const v = D[el.dataset.i18n]; if (v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { const v = D[el.dataset.i18nHtml]; if (v != null) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = D[el.dataset.i18nAria]; if (v != null) el.setAttribute('aria-label', v); });
  document.title = D.title;
  refreshErrors();
  document.getElementById('reserve-done').hidden = true;
}

/* ---------- тема и язык ---------- */
let stage = null;
function setTheme(t) { doc.dataset.theme = t; stage && stage.setTheme(t); }
document.getElementById('theme').addEventListener('click', () => {
  const t = doc.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(t); store.set('lantern-theme', t);
});
document.getElementById('lang').addEventListener('click', () => {
  const l = doc.lang === 'en' ? 'ru' : 'en';
  // тексты разной длины: держим на месте раздел, который сейчас наверху экрана, чтобы страница не прыгала
  const a = [...document.querySelectorAll('main > section, .foot')].find((el) => el.getBoundingClientRect().bottom > 60);
  const t0 = a ? a.getBoundingClientRect().top : 0;
  setLang(l); store.set('lantern-lang', l);
  window.ScrollTrigger && window.ScrollTrigger.refresh();
  const d = a ? a.getBoundingClientRect().top - t0 : 0;
  if (Math.abs(d) > 1) {
    const L = window.__scroll && window.__scroll.lenis;
    L ? L.scrollTo(scrollY + d, { immediate: true, force: true }) : scrollTo(0, scrollY + d);
  }
});

/* ---------- форма (демо: ничего не отправляет) ---------- */
const form = document.getElementById('reserve-form');
const done = document.getElementById('reserve-done');
const fields = ['name', 'email', 'team'];
const errKey = { 'Enter your name.': 'name', 'Use 80 characters or fewer.': 'long', 'Enter your work email.': 'email', 'Enter an email like name@company.com.': 'bad', 'Choose your team size.': 'team' };
const validate = () => (window.LanternLogic ? window.LanternLogic.validateReservation(Object.fromEntries(new FormData(form))) : {});
function showErrors(errors) {
  const D = doc.lang === 'en' ? EN : RU;
  fields.forEach((name) => {
    const input = form.elements[name];
    const box = document.getElementById('f-' + name + '-error');
    if (errors[name]) { input.setAttribute('aria-invalid', 'true'); box.textContent = D.err[errKey[errors[name]]] || errors[name]; box.hidden = false; }
    else { input.removeAttribute('aria-invalid'); box.hidden = true; box.textContent = ''; }
  });
}
function refreshErrors() {
  if (!fields.some((f) => form.elements[f].getAttribute('aria-invalid') === 'true')) return;
  const e = validate();
  const shown = {};
  fields.forEach((f) => { if (form.elements[f].getAttribute('aria-invalid') === 'true' && e[f]) shown[f] = e[f]; });
  showErrors(shown);
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const errors = validate();
  showErrors(errors);
  const first = fields.find((f) => errors[f]);
  if (first) { done.hidden = true; form.elements[first].focus(); return; }
  const D = doc.lang === 'en' ? EN : RU;
  const team = form.elements.team.selectedOptions[0].textContent.toLowerCase();
  done.textContent = D.done(form.elements.name.value.trim(), team, form.elements.email.value.trim());
  done.hidden = false;
  done.focus();
});
form.addEventListener('input', (e) => {
  done.hidden = true;
  const input = e.target;
  if (!fields.includes(input.name) || input.getAttribute('aria-invalid') !== 'true') return;
  if (validate()[input.name]) return;
  input.removeAttribute('aria-invalid');
  const box = document.getElementById('f-' + input.name + '-error');
  box.hidden = true; box.textContent = '';
});
if (doc.lang === 'en') setLang('en');

/* ---------- шапка, появление, счетчики ---------- */
const nav = document.getElementById('nav');
const onScrollNav = () => nav.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.2 });
document.querySelectorAll('[data-anim]').forEach((el) => {
  const i = [...el.parentElement.children].indexOf(el);
  el.style.transitionDelay = (i * 90) + 'ms'; io.observe(el);
});
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, to = parseFloat(el.dataset.count);
  if (reduced) return;
  const t0 = performance.now(), dur = 1100;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - p, 4);
    el.textContent = String(Math.round(to * k));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => cio.observe(el));

/* ---------- шаги главы «Внутри» ---------- */
const stepEls = [...document.querySelectorAll('.steps li')];
const bar = document.getElementById('bar');
let curStep = -1;
function setStep(i) {
  if (i === curStep) return;
  curStep = i;
  stepEls.forEach((el, k) => el.classList.toggle('is-cur', k === i));
}
if (reduced) setStep(0);

/* ---------- состояния сцены по прокрутке ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);
const band = (p, a, b) => smooth(clamp01((p - a) / (b - a)));
function mix(A, B, t) { const o = {}; for (const k in A) o[k] = lerp(A[k], k in B ? B[k] : A[k], t); return o; }
const wideNow = () => innerWidth >= 900;

// поза вписывается в свободную полосу экрана (px) по настоящим границам модели;
// x = 0 - по центру экрана, иначе - центр модели в этой точке (−1…1); maxW - предельная ширина в долях экрана (0…2)
function place(pose, top, bottom, maxScale, x = 0, align = 0.5, maxW = wideNow() ? 0.9 : 1.7) {
  if (!stage) return pose;
  const H = innerHeight;
  const b = stage.measure(pose);
  const t = 1 - 2 * top / H, btm = 1 - 2 * bottom / H;
  const s = Math.min(maxScale, (t - btm) / (b.y1 - b.y0) * 0.94, maxW / (b.x1 - b.x0));
  const slack = (t - btm) - s * (b.y1 - b.y0);
  return { ...pose, scale: s, x: x - s * (b.x0 + b.x1) / 2, y: t - slack * align - s * b.y1 };
}

function poses() {
  const wide = wideNow();
  const H = innerHeight;
  const base = { x: 0, y: 0, scale: 1, rx: 0, ry: 0, rz: 0, ex: 0, idle: 0, glow: 1, focus: -1 };
  const cta = document.querySelector('.hero__note').getBoundingClientRect().bottom + scrollY;
  const st = document.querySelector('#inside .sticky').getBoundingClientRect();
  const head = document.querySelector('.inside__head').getBoundingClientRect().bottom - st.top;
  const steps = document.querySelector('.steps').getBoundingClientRect().top - st.top;
  const A = { ...base, rx: 0.38, ry: -0.62 }, B = { ...base, rx: 0.26, ry: -0.3 };
  const fitIn = (p) => (wide ? place(p, 88, H - 56, 1.6, 0.42, 0.5, 0.82) : place(p, head + 16, steps - 20, 1.4, 0, 0.5, 1.5));
  return {
    hero: wide ? place({ ...base, rx: 0.3, ry: -0.55, idle: 1 }, 96, H - 48, 1.6, 0.44, 0.5, 0.8)
               : place({ ...base, rx: 0.32, ry: -0.55, idle: 1 }, cta + 28, H - 24, 1.2, 0, 0.35, 1.5),
    A0: fitIn(A), B0: fitIn(B),
    A1: fitIn({ ...A, ex: 1 }), B1: fitIn({ ...B, ex: 1 }),
  };
}

function startScroll() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return null;
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (!coarse && window.Lenis) {
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
    toInside: seg('#inside', 'top bottom', 'top top'),
    inside: seg('#inside', 'top top', 'bottom bottom'),
  };
  ScrollTrigger.create({ trigger: '#inside', start: 'top top', end: 'bottom bottom', onUpdate: (s) => {
    const p = s.progress;
    setStep(p >= 0.9 ? -1 : Math.min(3, Math.floor(stepAt(p)))); // в конце коробка собрана - итог, без активного шага
    bar.style.transform = `scaleX(${p.toFixed(3)})`;
  }, onLeaveBack: () => setStep(-1) });
  // заголовок главы проявляется, только когда почти встал на место, чтобы не проезжать по модели
  gsap.fromTo('.inside__head', { opacity: 0 }, { opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '#inside', start: () => (wideNow() ? 'top 22%' : 'top 32%'), end: 'top top', scrub: true, invalidateOnRefresh: true } });
  ScrollTrigger.create({ trigger: '#inside', start: () => (wideNow() ? 'top 40%' : 'top 14%'), invalidateOnRefresh: true, onEnter: () => curStep < 0 && setStep(0) });
  return { S, lenis, ScrollTrigger };
}

// шаг главы: 0 - до 22 % прокрутки, дальше новый шаг каждые 17 %
const stepAt = (p) => (p < 0.22 ? 0 : (p - 0.22) / 0.17 + 1);

function stateAt(y, S, P) {
  const pr = (st) => (st.end > st.start ? clamp01((y - st.start) / (st.end - st.start)) : (y >= st.start ? 1 : 0));
  if (y < S.toInside.end) return mix(P.hero, P.A0, smooth(pr(S.toInside)));
  const p = pr(S.inside);
  const ex = band(p, 0.02, 0.14) - band(p, 0.9, 1); // раскрылся → шаги по слоям → закрылся
  const sp = smooth(p);
  const s = mix(mix(P.A0, P.B0, sp), mix(P.A1, P.B1, sp), ex);
  const g = stepAt(p);
  const k = Math.min(3, Math.floor(g));
  const focus = k === 0 ? 0 : (k - 1) + smooth(clamp01((g - k) / 0.3)); // какой слой выходит вперед (0…3)
  s.ex = ex;
  s.focus = focus;
  s.glow = 1 + 0.5 * Math.max(0, 1 - Math.abs(focus - 1)) * ex; // на шаге «Ядро» свет ярче
  return s;
}

/* ---------- запуск сцены ---------- */
// видеокарта: проверяем после первой отрисовки; без нее - картинка, тяжелую 3D-библиотеку не грузим
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
  for (const href of ['assets/vendor/three/three.module.min.js', 'assets/vendor/three/three.core.js']) {
    const l = document.createElement('link');
    l.rel = 'modulepreload'; l.href = href; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
}

// библиотеки прокрутки нужны только вместе с 3D - грузим их после первой отрисовки, по порядку
const SCROLL_LIBS = ['assets/vendor/gsap.min.js', 'assets/vendor/ScrollTrigger.min.js', 'assets/vendor/lenis.min.js'];
const loadScripts = (list) => Promise.all(list.map((src) => new Promise((res) => {
  const s = document.createElement('script');
  s.src = src; s.async = false; s.onload = s.onerror = res;
  document.head.appendChild(s);
})));

async function boot() {
  if (!gl) return;
  const libs = loadScripts(coarse ? SCROLL_LIBS.slice(0, 2) : SCROLL_LIBS);
  const canvas = document.getElementById('stage');
  let mod;
  try { mod = await import('./scene.js'); } catch (e) { showFallback(); return; }
  try { stage = await mod.createStage(canvas, { reduced, mobile: coarse, context: gl }); }
  catch (e) { console.warn('3D off:', e.message); showFallback(); return; }
  stage.setTheme(doc.dataset.theme);
  window.__stage = stage;

  await libs;
  const sc = startScroll();
  if (!sc) { stage.set({ x: 0, y: -0.25, scale: 1, rx: 0.3, ry: -0.55, rz: 0, ex: 0, idle: 0, glow: 1, focus: -1 }, true); return; }
  let P = poses();
  const update = () => stage.set(stateAt(scrollY, sc.S, P));
  stage.set(stateAt(scrollY, sc.S, P), true);
  addEventListener('scroll', update, { passive: true });
  sc.ScrollTrigger.addEventListener('refresh', () => { P = poses(); update(); });
  // сцену закрыли сплошные блоки - не рисуем
  sc.ScrollTrigger.create({ trigger: '#specs', start: 'top top', end: () => 'max', onToggle: (s) => stage.setVisible(!s.isActive) });
  window.__scroll = sc;
  window.__poses = () => P;
}
const later = () => ('requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 600 }) : setTimeout(boot, 50));
// «уменьшить движение» - неподвижная картинка вместо живой сцены: модель не висит поверх текста
if (reduced) showFallback();
else requestAnimationFrame(() => setTimeout(() => {
  gl = probe();
  if (!gl) { showFallback(); return; }
  preload3d();
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}, 0));
