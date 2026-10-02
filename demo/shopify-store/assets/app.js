// MONO demo store: Shopify Storefront API on mock.shop (no account, no build step).
const API = 'https://mock.shop/api';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

async function gql(query, variables = {}) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error('Storefront API ' + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

const { t, word } = window.MONO;
const money = (m) => new Intl.NumberFormat(window.MONO.locale(), { style: 'currency', currency: m.currencyCode }).format(Number(m.amount));
const img = (url, w) => url + (url.includes('?') ? '&' : '?') + 'width=' + w;
const srcset = (url, ws) => ws.map((w) => `${img(url, w)} ${w}w`).join(', ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(text) {
  const t = $('[data-toast]'); t.textContent = text; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------- hero video: poster first, clip later, only when it makes sense ---------- */
function heroVideo() {
  const v = $('[data-hero-video]');
  if (!v) return;
  const c = navigator.connection || {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || c.saveData || /(^|-)2g$/.test(c.effectiveType || '')) return;
  const start = () => {
    v.src = 'assets/hero-720.mp4';
    v.addEventListener('playing', () => v.classList.add('on'), { once: true });
    new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause())).observe(v);
  };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1200));
  document.readyState === 'complete' ? later() : addEventListener('load', later, { once: true });
}

/* ---------- collection grid ---------- */
let currentCollection = 'featured';
const COLS = ['featured', 'men', 'women', 'shoes', 'accessories'];
const colCache = {};
let colReq = 0;
async function loadCollection(handle) {
  const grid = $('[data-grid]');
  if (!grid) return;
  currentCollection = handle;
  const req = ++colReq; // a slow answer for an older chip must not overwrite the newer one
  $$('[data-chip]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chip === handle)));
  if (!colCache[handle]) grid.innerHTML = Array(8).fill('<div class="card skel"><div class="ph"></div></div>').join('');
  try {
    const d = colCache[handle] || await gql(`query($h:String!){collection(handle:$h){products(first:12){edges{node{handle title featuredImage{url altText} priceRange{minVariantPrice{amount currencyCode}}}}}}}`, { h: handle });
    if (req !== colReq) return;
    colCache[handle] = d;
    const items = d.collection ? d.collection.products.edges.map((e) => e.node) : [];
    grid.innerHTML = items.map((p) => { const tr = window.MONO.product(p.handle, p); return `
      <a class="card${/sneaker|slides|shoe|boot/i.test(p.handle) ? ' shoe' : ''}" href="product.html?handle=${encodeURIComponent(p.handle)}">
        <div class="ph"><img src="${img(p.featuredImage.url, 600)}" srcset="${srcset(p.featuredImage.url, [360, 600, 900])}" sizes="(max-width:760px) 50vw, 25vw" width="600" height="600" loading="lazy" decoding="async" alt="${esc(tr.translated ? tr.title : p.featuredImage.altText || p.title)}"></div>
        <h3>${esc(tr.title)}</h3><p class="price">${money(p.priceRange.minVariantPrice)}</p>
      </a>`; }).join('') || `<p class="empty">${t('no_products')}</p>`;
  } catch (e) {
    if (req === colReq) grid.innerHTML = `<p class="empty">${t('catalog_fail')}</p>`;
  }
}

/* ---------- product page ---------- */
async function loadProduct() {
  const root = $('[data-pdp]');
  if (!root) return;
  const handle = new URLSearchParams(location.search).get('handle') || 'men-t-shirt';
  let d;
  if (loadProduct.cache && loadProduct.cache.handle === handle) return renderProduct(loadProduct.cache.p, handle);
  try {
    d = await gql(`query($h:String!){product(handle:$h){title description options{name values} images(first:5){edges{node{url altText}}} variants(first:50){edges{node{id availableForSale price{amount currencyCode} selectedOptions{name value} image{url}}}}}}`, { h: handle });
  } catch (e) { $('[data-title]').textContent = t('product_fail'); return; }
  const p = d.product;
  if (!p) { $('[data-title]').textContent = t('not_found'); return; }
  loadProduct.cache = { handle, p };
  renderProduct(p, handle);
}

let chosen = null;
function renderProduct(p, handle) {
  const tr = window.MONO.product(handle, p);
  $('[data-title]').removeAttribute('data-i18n');
  document.title = `${tr.title} · ${t('title_suffix')}`;
  $('[data-title]').textContent = tr.title;
  $('[data-desc]').textContent = tr.description;
  $('[data-note]').textContent = t(tr.translated ? 'tr_note' : 'en_note');
  const pics = p.images.edges.map((e) => e.node).slice(0, 3);
  $('[data-gallery]').innerHTML = pics.map((im, i) => `<div class="ph"><img src="${img(im.url, i ? 600 : 1000)}" srcset="${srcset(im.url, i ? [400, 600, 900] : [600, 1000, 1400])}" sizes="${i ? '(max-width:760px) 50vw, 30vw' : '(max-width:760px) 100vw, 60vw'}" width="1000" height="1000" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} alt="${esc(tr.translated ? tr.title : im.altText || p.title)}"></div>`).join('');

  const variants = p.variants.edges.map((e) => e.node);
  const opts = p.options.filter((o) => !(o.values.length === 1 && o.values[0] === 'Default Title'));
  chosen = chosen || Object.fromEntries(opts.map((o) => [o.name, (variants.find((v) => v.availableForSale) || variants[0]).selectedOptions.find((s) => s.name === o.name).value]));
  const SW = { green: '#2f6b46', olive: '#6b6b3a', ocean: '#2f5f73', purple: '#5b3f7a', red: '#a3352f', black: '#151515', white: '#f7f7f5', gray: '#9a9a96', grey: '#9a9a96', navy: '#22304f', blue: '#3a5fa0', beige: '#d8c8ad', brown: '#6b4a32' };
  const SHORT = { Small: 'S', Medium: 'M', Large: 'L', 'X-Large': 'XL', 'XX-Large': 'XXL', 'X-Small': 'XS' };
  const isColor = (o) => /colou?r/i.test(o.name) && o.values.every((v) => SW[v.toLowerCase()]);
  $('[data-options]').innerHTML = opts.map((o) => {
    const sw = isColor(o);
    return `<fieldset class="opt${sw ? ' swatches' : ''}" data-opt="${esc(o.name)}"><legend>${esc(word(o.name))}${sw ? ` <em>— <span data-chosen>${esc(word(chosen[o.name]))}</span></em>` : ''}</legend><div class="vals">${o.values.map((val) => `
      <label title="${esc(word(val))}"><input type="radio" name="${esc(o.name)}" value="${esc(val)}" ${chosen[o.name] === val ? 'checked' : ''}><span${sw ? ` style="--sw:${SW[val.toLowerCase()]}"` : ''}>${SHORT[val] ? `<span aria-hidden="true">${SHORT[val]}</span><span class="sr">${esc(word(val))}</span>` : esc(word(val))}</span></label>`).join('')}</div></fieldset>`;
  }).join('');
  $('[data-options]').style.minHeight = '0';
  const gal = $('[data-gallery]'), cnt = $('[data-count-img]');
  const upd = () => { const n = gal.children.length; const i = Math.round(gal.scrollLeft / (gal.children[0].offsetWidth + 8)) + 1; cnt.textContent = n > 1 ? `${Math.min(i, n)} / ${n}` : ''; };
  const match = () => variants.find((v) => v.selectedOptions.every((s) => !(s.name in chosen) || chosen[s.name] === s.value));
  const sync = () => {
    const v = match();
    const btn = $('[data-add]');
    $('[data-price]').textContent = v ? money(v.price) : '';
    $('[data-bp]').textContent = v ? money(v.price) : '';
    $('[data-buy]').disabled = !v || !v.availableForSale;
    btn.disabled = !v || !v.availableForSale;
    $('[data-stock]').textContent = !v ? t('stock_na') : v.availableForSale ? t('in_stock') : t('sold_out');
    if (v && v.image) { const first = $('[data-gallery] img'); if (first) { first.src = img(v.image.url, 1000); first.srcset = srcset(v.image.url, [600, 1000, 1400]); } }
  };
  if (renderProduct.wired) { upd(); sync(); return; }
  renderProduct.wired = true;
  gal.addEventListener('scroll', upd, { passive: true }); upd();
  const bar = $('[data-buybar]');
  new IntersectionObserver(([e]) => { const show = !e.isIntersecting; bar.classList.toggle('on', show); bar.setAttribute('aria-hidden', String(!show)); $('[data-buy]').tabIndex = show ? 0 : -1; }).observe($('[data-add]'));
  $('[data-buy]').addEventListener('click', () => $('[data-form]').requestSubmit());

  $('[data-form]').addEventListener('change', (e) => { if (e.target.name) { chosen[e.target.name] = e.target.value; const c = e.target.closest('fieldset').querySelector('[data-chosen]'); if (c) c.textContent = word(e.target.value); sync(); } });
  $('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = match(); if (!v) return;
    const btn = $('[data-add]'); btn.disabled = true; btn.textContent = t('adding');
    try { await cartAdd(v.id); openCart(); }
    catch (err) { toast(t('add_fail')); }
    btn.textContent = t('add'); sync();
  });
  sync();
}

/* ---------- cart (Storefront API cart, id kept in localStorage) ---------- */
const CART_FIELDS = `id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}} lines(first:50){edges{node{id quantity merchandise{... on ProductVariant{title image{url} product{title handle}}} cost{totalAmount{amount currencyCode}}}}}`;
let cart = null;
const store = { get: () => { try { return localStorage.getItem('mono-cart'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('mono-cart', v); } catch {} } };

async function cartLoad() {
  const id = store.get();
  if (!id) return renderCart();
  try { cart = (await gql(`query($id:ID!){cart(id:$id){${CART_FIELDS}}}`, { id })).cart; } catch { cart = null; }
  renderCart();
}
async function cartAdd(variantId) {
  const lines = [{ merchandiseId: variantId, quantity: 1 }];
  const d = cart
    ? await gql(`mutation($id:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$l){cart{${CART_FIELDS}} userErrors{message}}}`, { id: cart.id, l: lines })
    : await gql(`mutation($l:[CartLineInput!]!){cartCreate(input:{lines:$l}){cart{${CART_FIELDS}} userErrors{message}}}`, { l: lines });
  const res = d.cartLinesAdd || d.cartCreate;
  if (res.userErrors.length) throw new Error(res.userErrors[0].message);
  cart = res.cart; store.set(cart.id); renderCart();
}
async function cartSetQty(lineId, quantity) {
  const d = quantity > 0
    ? await gql(`mutation($id:ID!,$l:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$l){cart{${CART_FIELDS}}}}`, { id: cart.id, l: [{ id: lineId, quantity }] })
    : await gql(`mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{${CART_FIELDS}}}}`, { id: cart.id, l: [lineId] });
  cart = (d.cartLinesUpdate || d.cartLinesRemove).cart; renderCart();
}
function renderCart() {
  const lines = cart ? cart.lines.edges.map((e) => e.node) : [];
  $$('[data-count]').forEach((b) => (b.textContent = cart ? cart.totalQuantity : 0));
  const box = $('[data-lines]');
  box.innerHTML = lines.length ? lines.map((l) => `
    <div class="line">
      <img src="${l.merchandise.image ? img(l.merchandise.image.url, 160) : ''}" width="72" height="72" alt="">
      <div><p class="t">${esc(window.MONO.product(l.merchandise.product.handle, l.merchandise.product).title)}</p><p class="v">${esc(window.MONO.variant(l.merchandise.title))}</p>
        <div class="qty"><button type="button" data-q="${l.id}" data-n="${l.quantity - 1}" aria-label="${t('dec')}">−</button><output>${l.quantity}</output><button type="button" data-q="${l.id}" data-n="${l.quantity + 1}" aria-label="${t('inc')}">+</button></div></div>
      <p class="lp">${money(l.cost.totalAmount)}</p>
    </div>`).join('') : `<p class="empty">${t('cart_empty')}</p>`;
  $('[data-subtotal]').textContent = lines.length ? money(cart.cost.subtotalAmount) : '—';
  const co = $('[data-checkout]');
  co.href = lines.length ? cart.checkoutUrl : '#';
  co.setAttribute('aria-disabled', String(!lines.length));
}
let lastFocus = null;
function openCart() { const d = $('[data-drawer]'); lastFocus = document.activeElement; d.inert = false; d.setAttribute('aria-hidden', 'false'); document.body.classList.add('open'); $('.x', d).focus(); }
function closeCart() { const d = $('[data-drawer]'); if (d.inert) return; document.body.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); d.inert = true; if (lastFocus) lastFocus.focus(); }

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-open-cart],[data-close-cart],[data-q],[data-chip],[data-col],[data-checkout]');
  if (!el) return;
  if (el.matches('[data-open-cart]')) openCart();
  else if (el.matches('[data-close-cart]')) closeCart();
  else if (el.matches('[data-q]')) { el.disabled = true; try { await cartSetQty(el.dataset.q, Number(el.dataset.n)); } catch { toast(t('cart_fail')); } }
  else if (el.matches('[data-chip]')) loadCollection(el.dataset.chip);
  else if (el.matches('[data-col]')) loadCollection(el.dataset.col);
  else if (el.matches('[data-checkout]') && el.getAttribute('aria-disabled') === 'true') e.preventDefault();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

document.addEventListener('langchange', () => { loadCollection(currentCollection); loadProduct(); renderCart(); });

heroVideo();
const startCol = new URLSearchParams(location.search).get('col');
loadCollection(COLS.includes(startCol) ? startCol : 'featured');
loadProduct();
cartLoad();
