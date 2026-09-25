// Page behaviour. Everything works without JS too (the form posts to send.php and redirects).
import { calcNumber, calcSummary, calcTotal, formatRub, validateLead } from './logic.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── reveal on scroll ───────────────────────────────────────────────────
// Hiding starts only here, after the observer exists; if anything below breaks, a 2 s safety net shows everything.
const items = $$('[data-reveal]');
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
  document.documentElement.classList.add('reveal-on');
  setTimeout(() => {
    const vh = innerHeight;
    items.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) el.classList.add('in'); });
  }, 2000);
  addEventListener('beforeprint', () => items.forEach((el) => el.classList.add('in')));
}

// ── calculator ─────────────────────────────────────────────────────────
for (const form of $$('form.calc')) {
  const spec = JSON.parse($('.calc-data', form.parentElement).textContent);
  const out = $('output', form);
  const values = () => Object.fromEntries(spec.fields.map((f) => {
    const el = form.elements[f.id];
    return [f.id, f.type === 'checkbox' ? el.checked : el.value];
  }));
  const mirror = $('[data-calc-mirror]', form.parentElement);
  const update = () => { out.textContent = formatRub(calcTotal(spec, values())); if (mirror) mirror.textContent = out.textContent; };
  form.addEventListener('input', update);
  // Вне диапазона — после ухода с поля показываем то число, по которому посчитано.
  for (const f of spec.fields.filter((x) => x.type === 'number')) {
    form.elements[f.id].addEventListener('change', (ev) => { ev.target.value = calcNumber(f, ev.target.value); update(); });
  }
  update();
  $('[data-calc-send]', form).addEventListener('click', () => {
    const lead = $('form.lead-form');
    if (!lead) return;
    const text = `Итог: ${out.textContent} — ${calcSummary(spec, values())}`;
    lead.elements.calc.value = text;
    const note = $('.calc-note', lead);
    note.textContent = 'К заявке приложен расчёт: ' + text;
    note.hidden = false;
    (lead.closest('section') || lead).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => lead.querySelector('input:not([type=hidden])')?.focus({ preventScroll: true }), reduce ? 0 : 500);
  });
}

// ── lead form ─────────────────────────────────────────────────────────
const FIELD_SPEC = (form) => $$('input, textarea, select', form)
  .filter((el) => el.id?.startsWith('f-'))
  .map((el) => ({ name: el.name, type: el.type === 'tel' ? 'tel' : el.type === 'email' ? 'email' : el.tagName === 'TEXTAREA' ? 'textarea' : 'text',
    required: el.required, max: el.maxLength > 0 ? el.maxLength : undefined }));

for (const form of $$('form.lead-form')) {
  // time on the page is measured here, not by the visitor's clock (a wrong clock must not look like a bot)
  const loaded = performance.now();
  form.elements.js.value = '1';
  form.elements.page.value = location.pathname;
  const q = new URLSearchParams(location.search);
  form.elements.source.value = q.get('utm_source') || q.get('src') || (document.referrer && !document.referrer.startsWith(location.origin) ? new URL(document.referrer).hostname : '');
  const status = $('.form-status', form);
  const btn = $('button[type=submit]', form);
  const showErrors = (errors) => {
    $$('.err', form).forEach((p) => { p.hidden = true; p.textContent = ''; });
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    let first = null;
    for (const [name, msg] of Object.entries(errors)) {
      const p = $(`#e-${CSS.escape(name)}`, form);
      const el = form.elements[name];
      if (p) { p.textContent = msg; p.hidden = false; }
      if (el) { el.setAttribute('aria-invalid', 'true'); if (p) el.setAttribute('aria-describedby', p.id); first ??= el; }
    }
    first?.focus();
  };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    form.elements.elapsed.value = String(Math.round(performance.now() - loaded));
    const data = Object.fromEntries(new FormData(form));
    const check = validateLead(FIELD_SPEC(form), data);
    if (!check.ok) { showErrors(check.errors); return; }
    showErrors({});
    // Демо (site.json → "demo"): заявка никуда не уходит — честно говорим, что было бы на настоящем сайте.
    if ('demo' in form.dataset) {
      form.reset();
      form.elements.js.value = '1';
      form.elements.calc.value = '';
      $('.calc-note', form).hidden = true;
      status.textContent = 'Это демо: заявка никуда не ушла. На настоящем сайте она сохраняется на хостинге, приходит на почту и в Telegram.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Отправляем…';
    try {
      const res = await fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        form.reset();
        form.elements.js.value = '1';
        $('.calc-note', form).hidden = true;
        status.textContent = '✅ Заявка отправлена. Скоро свяжемся с вами.';
        const m = $('meta[name=metrika]');
        if (m && window.ym) window.ym(Number(m.content), 'reachGoal', m.dataset.goal || 'lead');
      } else if (body.errors) { showErrors(body.errors); status.textContent = ''; }
      else status.textContent = body.error || 'Не получилось отправить. Позвоните нам — номер вверху страницы.';
    } catch {
      status.textContent = 'Нет связи. Проверьте интернет и попробуйте ещё раз или позвоните нам.';
    } finally { btn.disabled = false; }
  });
}

// ── gallery lightbox ──────────────────────────────────────────────────
for (const sec of $$('.gallery')) {
  const root = sec.parentElement;
  const list = JSON.parse($('.gallery-data', root).textContent);
  const dlg = $('dialog.lightbox', root);
  const im = $('img', dlg), cap = $('.lb-cap', dlg);
  let i = 0, x0 = null;
  const show = (n) => { i = (n + list.length) % list.length; im.src = list[i].src; im.alt = list[i].alt; cap.textContent = `${list[i].cap || list[i].alt} · ${i + 1} из ${list.length}`; };
  $$('.shot', sec).forEach((b) => b.addEventListener('click', () => { show(Number(b.dataset.i)); dlg.showModal(); }));
  $('.lb-close', dlg).onclick = () => dlg.close();
  $('.lb-prev', dlg).onclick = () => show(i - 1);
  $('.lb-next', dlg).onclick = () => show(i + 1);
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowLeft') show(i - 1); if (ev.key === 'ArrowRight') show(i + 1); });
  dlg.addEventListener('touchstart', (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (ev) => { if (x0 === null) return; const dx = ev.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
}

// ── map loads only on click: no third-party requests before the visitor asks ──
for (const box of $$('.map[data-src]')) {
  $('button', box).addEventListener('click', () => {
    const f = Object.assign(document.createElement('iframe'), { src: box.dataset.src, title: 'Карта', loading: 'lazy', allowFullscreen: true });
    box.replaceChildren(f);
  });
}

// ── Yandex Metrika only after consent ─────────────────────────────────
const meta = $('meta[name=metrika]');
const banner = $('.cookie');
const store = { get() { try { return localStorage.getItem('cookie-consent'); } catch { return null; } },
  set(v) { try { localStorage.setItem('cookie-consent', v); } catch { /* private mode */ } } };
function loadMetrika() {
  if (!meta || window.ym) return;
  const id = Number(meta.content);
  window.ym = function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.append(s);
  window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
}
// "Настройки cookie" in the footer: withdraw or give consent again at any time
$('[data-cookie-settings]')?.addEventListener('click', (ev) => {
  ev.preventDefault();
  const had = store.get() === 'yes';
  store.set('');
  if (banner) banner.hidden = false;
  if (had) location.reload(); // Metrika already running — reload so it stops
});
if (meta && banner) {
  const v = store.get();
  if (v === 'yes') loadMetrika();
  else if (v !== 'no') banner.hidden = false;
  banner.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cookie]');
    if (!b) return;
    store.set(b.dataset.cookie);
    banner.hidden = true;
    if (b.dataset.cookie === 'yes') loadMetrika();
  });
}
