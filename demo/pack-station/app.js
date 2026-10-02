// Packing station demo: barcode scanner (keyboard wedge) or tapped chips → verifyScan() → screen + n8n run log.
(() => {
  const T = {
    en: {
      station: 'Packing station 1', scanner: 'Scanner ready', queue: 'Orders to pack', logH: 'n8n runs',
      tryH: 'No scanner? Tap a product to scan it', themeBtn: 'Dark', themeBtnDark: 'Light', langBtn: 'RU',
      lockAlert: 'Supervisor alerted in #warehouse-alerts',
      foot: 'Demo on made-up orders. The scan check runs in your browser with the same code as the n8n workflow; in a real setup the tablet sends each scan to n8n, which reads the order from Shopify.',
      items: (n) => `${n} item${n === 1 ? '' : 's'}`,
      next: (t) => `Scan next: <b>${t}</b>`, allDone: 'All items scanned.',
      inBox: (b) => `in ${b}`, idle: 'Scan the first item', idleSub: 'Any item from this order, in any order.',
      ok: (got, total) => `Good. ${got} of ${total}`, okSub: (t) => t,
      ready: 'Ready to pack', readySub: 'Order tagged ready-to-pack in Shopify. In the full build the Royal Mail label prints here.',
      wrong: 'Wrong item', extra: 'Too many', wrongP: 'Put it back. Scan an item from this order.', extraP: (t) => `${t} is already complete. Put this one back.`,
      code: (c) => `Barcode ${c}`, unlocked: 'Unlocked by a correct scan', unlockBtn: 'Supervisor unlock',
      path: { WRONG_SKU: 'wrong item → Slack alert', EXTRA_ITEM: 'extra item → Slack alert', OK: 'ok, keep scanning', READY_TO_PACK: 'ready → tag order in Shopify' },
      channel: { 'Online store': 'Online store', 'Shopify POS': 'Shopify POS', Wholesale: 'Wholesale' },
    },
    ru: {
      station: 'Упаковочный стол 1', scanner: 'Сканер готов', queue: 'Заказы на сборку', logH: 'Запуски n8n',
      tryH: 'Нет сканера? Нажмите на товар, чтобы его отсканировать', themeBtn: 'Ночь', themeBtnDark: 'День', langBtn: 'EN',
      lockAlert: 'Старший смены получил оповещение в #warehouse-alerts',
      foot: 'Демо на выдуманных заказах. Проверка скана работает в браузере тем же кодом, что и в процессе n8n; в настоящей системе планшет отправляет каждый скан в n8n, а тот берёт заказ из Shopify.',
      items: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'товар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'товара' : 'товаров'}`,
      next: (t) => `Дальше: <b>${t}</b>`, allDone: 'Все товары отсканированы.',
      inBox: (b) => `в наборе «${b}»`, idle: 'Отсканируйте первый товар', idleSub: 'Любой товар из заказа, в любом порядке.',
      ok: (got, total) => `Верно. ${got} из ${total}`, okSub: (t) => t,
      ready: 'Можно упаковывать', readySub: 'Заказ отмечен в Shopify как готовый. В полной версии здесь печатается этикетка Royal Mail.',
      wrong: 'Не тот товар', extra: 'Лишний товар', wrongP: 'Отложите его. Отсканируйте товар из этого заказа.', extraP: (t) => `${t} уже собран полностью. Отложите этот.`,
      code: (c) => `Штрихкод ${c}`, unlocked: 'Разблокировано верным сканом', unlockBtn: 'Снять блокировку (старший смены)',
      path: { WRONG_SKU: 'не тот товар → оповещение в Slack', EXTRA_ITEM: 'лишний товар → оповещение в Slack', OK: 'верно, сканируем дальше', READY_TO_PACK: 'готово → отметка заказа в Shopify' },
      channel: { 'Online store': 'Интернет-магазин', 'Shopify POS': 'Магазин (Shopify POS)', Wholesale: 'Опт' },
    },
  };
  const TITLES_RU = { 'WF-340': 'Мёд разнотравье 340 г', 'HE-227': 'Вересковый мёд 227 г', 'CR-340': 'Крем-мёд 340 г', 'CB-200': 'Мёд в сотах 200 г', 'WF-1KG': 'Мёд разнотравье 1 кг', 'BW-50': 'Восковые салфетки (3 шт.)', 'Mix & Match Gift Box': 'Подарочный набор «Собери сам»' };

  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const qs = new URLSearchParams(location.search), qh = new URLSearchParams(location.hash.slice(1));
  const q = { get: (k) => qs.get(k) || qh.get(k) }; // ?lang=ru и #lang=ru
  let lang = q.get('lang') || store.get('sv-lang') || ((navigator.language || '').startsWith('ru') ? 'ru' : 'en');
  if (!T[lang]) lang = 'en';
  if (q.get('theme')) document.documentElement.dataset.theme = q.get('theme');

  const $ = (id) => document.getElementById(id);
  const state = { cur: DEMO_ORDERS[0].id, scanned: {}, verdict: null, log: [], done: new Set(), lockedOn: null };
  const t = () => T[lang];
  const title = (sku, fallback) => (lang === 'ru' ? TITLES_RU[sku] || TITLES_RU[fallback] : null) || fallback;
  const order = () => DEMO_ORDERS.find((o) => o.id === state.cur);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const units = (o) => o.line_items.reduce((s, li) => s + li.quantity * (li.components ? li.components.reduce((a, c) => a + c.qty, 0) : 1), 0);

  function render() {
    const L = t();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { const v = L[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
    $('lang').textContent = L.langBtn;
    $('theme').firstElementChild.textContent = document.documentElement.dataset.theme === 'dark' ? L.themeBtnDark : L.themeBtn;

    $('queue').innerHTML = DEMO_ORDERS.map((o) => `<li class="${state.done.has(o.id) ? 'done' : ''}"><button type="button" data-id="${o.id}" aria-current="${o.id === state.cur}">
      <span class="q-name">${esc(o.name)}</span><span class="q-ch">${esc(L.channel[o.channel])} · ${esc(L.items(units(o)))}</span></button></li>`).join('');

    const o = order();
    const sc = state.scanned[o.id] || {};
    const res = verifyScan(o, { barcode: '', scanned: sc }); // summary only
    $('o-h').textContent = `${o.name}`;
    $('o-meta').textContent = `${L.channel[o.channel]} · ${o.customer}`;
    const left = res.lines.find((l) => l.got < l.need);
    $('next').innerHTML = left ? L.next(esc(title(left.sku, left.title))) : esc(L.allDone);
    $('lines').innerHTML = res.lines.map((l) => `<li class="line${l.got >= l.need ? ' complete' : ''}${state.flash === l.sku ? ' flash' : ''}">
      <span class="line-title">${esc(title(l.sku, l.title))}</span>
      <span class="line-count">${Math.min(l.got, l.need)} / ${l.need}</span>
      <span class="line-sub">${esc(l.sku)}${l.boxes.length ? ' · ' + esc(L.inBox(title(null, l.boxes[0]))) : ''}</span>
      <span class="slots" aria-hidden="true">${Array.from({ length: l.need }, (_, i) => `<i class="slot${i < l.got ? ' full' : ''}"></i>`).join('')}</span></li>`).join('');
    state.flash = null;

    const v = state.verdict;
    const box = $('verdict');
    if (!v || v.order !== o.name) { box.className = 'verdict idle'; box.innerHTML = `<p class="v-big">${esc(L.idle)}</p><p class="muted">${esc(L.idleSub)}</p>`; }
    else if (v.status === 'READY_TO_PACK') { box.className = 'verdict ready'; box.innerHTML = `<p class="v-big">${esc(L.ready)}</p><p class="muted">${esc(L.readySub)}</p>`; }
    else if (v.status === 'OK') { box.className = 'verdict ok'; box.innerHTML = `<p class="v-big">${esc(L.ok(v.got, v.total))}</p><p class="muted">${esc(title(v.sku, v.title))}${v.unlocked ? ' · ' + esc(L.unlocked) : ''}</p>`; }

    $('log').innerHTML = state.log.slice(0, 5).map((r) => `<li class="${r.status === 'WRONG_SKU' || r.status === 'EXTRA_ITEM' ? 'bad' : r.status === 'READY_TO_PACK' ? 'good' : ''}">
      <span>${esc(r.time)} · ${esc(r.order)} · ${esc(r.code)}</span><span class="path">Webhook → Get order → Verify scan → ${esc(L.path[r.status])}</span></li>`).join('');

    const lock = $('lock');
    if (state.lockedOn) {
      const s = state.lockedOn;
      $('lock-h').textContent = s.status === 'EXTRA_ITEM' ? L.extra : L.wrong;
      $('lock-code').textContent = L.code(s.barcode || '—');
      $('unlock').textContent = L.unlockBtn;
      $('lock-p').textContent = s.status === 'EXTRA_ITEM' ? L.extraP(title(s.sku, s.title)) : L.wrongP;
      lock.hidden = false;
    } else lock.hidden = true;

    $('chips').innerHTML = Object.values(DEMO_PRODUCTS).map((p) => `<button type="button" data-code="${p.barcode}">${esc(title(p.sku, p.title))}</button>`).join('');
  }

  function scan(code) {
    const o = order();
    const r = verifyScan(o, { barcode: code, scanned: state.scanned[o.id] || {} });
    const now = new Date();
    state.log.unshift({ time: now.toTimeString().slice(0, 8), order: o.name, code: code || '—', status: r.status });
    if (r.status === 'WRONG_SKU' || r.status === 'EXTRA_ITEM') { state.lockedOn = r; }
    else {
      r.unlocked = !!state.lockedOn; state.lockedOn = null;
      state.scanned[o.id] = r.scanned; state.flash = r.sku;
      if (r.status === 'READY_TO_PACK') state.done.add(o.id);
    }
    state.verdict = r.status === 'WRONG_SKU' || r.status === 'EXTRA_ITEM' ? state.verdict : r;
    render();
  }
  window.demoScan = scan;

  // keyboard-wedge scanner: digits + Enter into a hidden input that keeps focus
  const input = $('scan');
  const keepFocus = () => { if (!document.activeElement || document.activeElement === document.body) input.focus({ preventScroll: true }); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const c = input.value.trim(); input.value = ''; if (c) scan(c); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.id === 'unlock') { state.lockedOn = null; render(); }
    else if (b?.dataset.id) { state.cur = Number(b.dataset.id); state.lockedOn = null; render(); }
    else if (b?.dataset.code) scan(b.dataset.code);
    setTimeout(keepFocus, 0);
  });
  $('lang').addEventListener('click', () => { lang = lang === 'en' ? 'ru' : 'en'; store.set('sv-lang', lang); render(); });
  $('theme').addEventListener('click', () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('sv-theme', d.dataset.theme); render(); });
  render();
  keepFocus();
})();
