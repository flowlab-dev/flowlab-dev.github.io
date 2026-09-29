import { renderScene, buildTexture } from './render.js';
import { pointInQuad, scaleQuad, centroid, isConvex } from './warp.js';
import { listDesigns, getDesign, thumb } from './art.js';
import { panelGLB } from './glb.js';

const $ = (s) => document.querySelector(s);
let customRoom = null;
function say(msg) { const el = $('#status'); el.textContent = msg; clearTimeout(say.t); say.t = setTimeout(() => { el.textContent = ''; }, 6000); }
const P = (x, y) => ({ x, y });
const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];

const PRODUCT = {
  tile: 'UV-printed tile backsplash',
  glass: 'UV-printed glass art',
  backlit: 'Backlit printed glass (LED)',
};
const GROUTS = ['#f2efe9', '#d9d4cc', '#8c8780', '#2f2c29'];
const GLOWS = ['#ffe7b8', '#ffffff', '#cfe3ff', '#ffc9a3'];

const SCENES = [
  {
    id: 'kitchen', name: 'Kitchen backsplash', src: 'rooms/kitchen-tiles.jpg',
    occluders: [rect(180, 464, 213, 514), rect(728, 464, 759, 514), rect(867, 466, 899, 516)],
    prints: () => [{
      type: 'tile', design: 'moroccan', widthIn: 99, heightIn: 28, tileIn: 6, grout: GROUTS[0],
      corners: rect(112, 340, 950, 580),
      clip: [P(112, 428), P(312, 428), P(312, 340), P(590, 340), P(590, 428), P(950, 428), P(950, 580), P(112, 580)],
    }],
  },
  {
    id: 'kitchen2', name: 'Kitchen, side view', src: 'rooms/kitchen-angle.jpg',
    occluders: [[P(437, 268), P(462, 266), P(462, 308), P(437, 310)]],
    prints: () => [{
      type: 'glass', design: 'citrus', widthIn: 30, heightIn: 20, layout: 'mural',
      corners: [P(420, 143), P(700, 93), P(700, 414), P(420, 327)],
    }],
  },
  {
    id: 'living', name: 'Living room', src: 'rooms/living-room.jpg',
    occluders: [],
    prints: () => [{
      type: 'backlit', design: 'aurora', widthIn: 48, heightIn: 30, glow: 0.8, glowColor: GLOWS[0], lightOn: true,
      corners: rect(229, 18, 795, 372),
    }],
  },
];

const LIGHT = {
  day: { brightness: 1, warmth: 0 },
  evening: { brightness: 0.78, warmth: 0.45 },
  night: { brightness: 0.38, warmth: 0.1 },
};

const state = {
  scene: null, photo: null, prints: [], sel: -1,
  light: { ...LIGHT.day, preset: 'day' },
};

const canvas = $('#view');
const ctx = canvas.getContext('2d');
const stage = $('#stage');
let viewScale = 1;
let dirty = true;
let fast = false;

function withDefaults(p) {
  return {
    finish: 'gloss', layout: 'auto', tileIn: 6, grout: GROUTS[1], glow: 0.6, glowColor: GLOWS[0], lightOn: true,
    clipOn: true, ...p, corners: p.corners.map((c) => ({ ...c })),
  };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Uploaded images are scaled down (max 1600 px) — enough for the preview, light on phones.
async function fileToCanvas(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

let sceneToken = 0;
async function setScene(scene, photo) {
  const token = ++sceneToken;
  $('#loading').classList.remove('done');
  let img;
  try { img = photo || await loadImage(scene.src); } catch {
    if (token === sceneToken) { $('#loading').classList.add('done'); say('That room photo could not load. Please try again.'); }
    return;
  }
  if (token !== sceneToken) return; // a newer room was picked while this one loaded
  state.scene = scene;
  state.photo = img;
  state.prints = (scene.prints ? scene.prints() : []).map(withDefaults);
  state.sel = state.prints.length ? 0 : -1;
  $('#loading').classList.add('done');
  layout();
  syncAll();
}

// ---------- drawing ----------
function layout() {
  if (!state.photo) return;
  const col = stage.parentElement.clientWidth;
  const aspect = state.photo.width / state.photo.height;
  const mobile = window.matchMedia('(max-width: 820px)').matches;
  const maxH = mobile ? window.innerHeight * 0.48 : window.innerHeight - 190;
  const w = Math.min(col, Math.max(280, maxH) * aspect);
  stage.style.width = `${w}px`;
  stage.style.margin = w < col ? '0 auto' : '';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round((w / aspect) * dpr);
  viewScale = w / state.photo.width;
  dirty = true;
}

function frame() {
  if (dirty && state.photo) {
    dirty = false;
    const dpr = canvas.width / (state.photo.width * viewScale);
    renderScene(ctx, { photo: state.photo, scene: state.scene, prints: state.prints, light: state.light },
      viewScale * dpr, { steps: fast ? 8 : 16 });
    drawOverlay();
  }
  requestAnimationFrame(frame);
}

function redraw() { dirty = true; }

// ---------- selection overlay (outline + corner handles) ----------
const handleNames = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];
const handles = handleNames.map((n, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'handle'; b.dataset.i = i;
  b.setAttribute('aria-label', `${n} corner. Drag, or use arrow keys to line it up with the wall.`);
  $('#handles').append(b);
  return b;
});

function drawOverlay() {
  const p = state.prints[state.sel];
  const poly = $('#outline polygon');
  handles.forEach((h) => { h.hidden = !p; });
  if (!p) { poly.setAttribute('points', ''); return; }
  poly.setAttribute('points', p.corners.map((c) => `${c.x * viewScale},${c.y * viewScale}`).join(' '));
  p.corners.forEach((c, i) => {
    handles[i].style.left = `${c.x * viewScale}px`;
    handles[i].style.top = `${c.y * viewScale}px`;
  });
}

// ---------- pointer interaction ----------
function toImage(e) {
  const r = stage.getBoundingClientRect();
  return P((e.clientX - r.left) / viewScale, (e.clientY - r.top) / viewScale);
}

let drag = null;

stage.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.handle');
  const pt = toImage(e);
  if (h) {
    drag = { kind: 'corner', i: +h.dataset.i, el: h };
    h.classList.add('drag');
  } else {
    let hit = -1;
    for (let i = state.prints.length - 1; i >= 0; i--) if (pointInQuad(state.prints[i].corners, pt)) { hit = i; break; }
    if (hit < 0) return;
    if (hit !== state.sel) { state.sel = hit; syncAll(); }
    drag = { kind: 'move', last: pt };
  }
  stage.setPointerCapture(e.pointerId);
  fast = true;
  e.preventDefault();
});

stage.addEventListener('pointermove', (e) => {
  if (!drag) {
    const pt = toImage(e);
    stage.style.cursor = state.prints.some((p) => pointInQuad(p.corners, pt)) ? 'move' : 'default';
    return;
  }
  const p = state.prints[state.sel];
  const pt = toImage(e);
  const W = state.photo.width, H = state.photo.height;
  if (drag.kind === 'corner') {
    const next = p.corners.slice();
    next[drag.i] = P(Math.max(-W * 0.2, Math.min(W * 1.2, pt.x)), Math.max(-H * 0.2, Math.min(H * 1.2, pt.y)));
    if (isConvex(next)) p.corners = next; // never let the print fold over itself
  } else {
    moveBy(p, pt.x - drag.last.x, pt.y - drag.last.y);
    drag.last = pt;
  }
  redraw();
});

function endDrag() {
  if (!drag) return;
  drag.el?.classList.remove('drag');
  drag = null; fast = false; redraw();
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// Move a whole print, keeping its centre on the photo.
function moveBy(p, dx, dy) {
  const c = centroid(p.corners);
  const W = state.photo.width, H = state.photo.height;
  dx = Math.max(-c.x, Math.min(W - c.x, dx));
  dy = Math.max(-c.y, Math.min(H - c.y, dy));
  p.corners.forEach((q) => { q.x += dx; q.y += dy; });
}

function nudge(dx, dy, cornerIndex) {
  const p = state.prints[state.sel];
  if (!p) return;
  if (cornerIndex == null) moveBy(p, dx, dy);
  else {
    const next = p.corners.map((q) => ({ ...q }));
    next[cornerIndex].x += dx; next[cornerIndex].y += dy;
    if (isConvex(next)) p.corners = next;
  }
  redraw();
}

document.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const h = document.activeElement?.closest?.('.handle');
  if (map[e.key] && (h || document.activeElement === stage)) {
    const k = (e.shiftKey ? 10 : 2) / Math.max(0.3, viewScale);
    nudge(map[e.key][0] * k, map[e.key][1] * k, h ? +h.dataset.i : null);
    e.preventDefault();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === stage) {
    removeSelected(); e.preventDefault();
  }
});

document.querySelectorAll('[data-nudge]').forEach((b) => b.addEventListener('click', () => {
  const k = 6 / Math.max(0.3, viewScale);
  const d = { left: [-k, 0], right: [k, 0], up: [0, -k], down: [0, k] }[b.dataset.nudge];
  nudge(d[0], d[1]);
}));

// ---------- editing ----------
function sel() { return state.prints[state.sel]; }

function addPrint() {
  const W = state.photo.width, H = state.photo.height;
  const n = state.prints.length;
  const widthIn = 36, heightIn = 24;
  const w = W * 0.3, h = w * (heightIn / widthIn);
  const cx = W / 2 + n * W * 0.04, cy = H * 0.38 + n * H * 0.04;
  state.prints.push(withDefaults({
    type: 'glass', design: 'coast', widthIn, heightIn, layout: 'mural',
    corners: rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2),
  }));
  state.sel = state.prints.length - 1;
  syncAll();
}

function removeSelected() {
  if (state.sel < 0) return;
  state.prints.splice(state.sel, 1);
  state.sel = Math.min(state.sel, state.prints.length - 1);
  syncAll();
}

// Keep the print's centre and size, remove the perspective (a straight-on rectangle).
function squareUp() {
  const p = sel(); if (!p) return;
  const c = centroid(p.corners);
  const top = Math.hypot(p.corners[1].x - p.corners[0].x, p.corners[1].y - p.corners[0].y);
  const bottom = Math.hypot(p.corners[2].x - p.corners[3].x, p.corners[2].y - p.corners[3].y);
  const w = (top + bottom) / 2, h = w * (p.heightIn / p.widthIn);
  p.corners = rect(c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2);
  redraw();
}

function setSize(wIn, hIn) {
  const p = sel(); if (!p || !(wIn > 0) || !(hIn > 0)) return;
  p.corners = scaleQuad(p.corners, wIn / p.widthIn, hIn / p.heightIn);
  p.widthIn = wIn; p.heightIn = hIn;
  syncSummary(); syncLayers(); redraw();
}

// ---------- UI sync ----------
function pressed(container, attr, value) {
  container.querySelectorAll(`[${attr}]`).forEach((b) => {
    const on = b.getAttribute(attr) === String(value);
    b.setAttribute(b.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed', on);
  });
}

const thumbCache = new Map();
function designThumb(p) {
  if (p.upload) return p.uploadThumb;
  const k = `${p.design}@96`;
  if (!thumbCache.has(k)) thumbCache.set(k, thumb(p.design, 96));
  return thumbCache.get(k);
}
function designName(p) { return p.upload ? 'Your artwork' : getDesign(p.design).name; }

function syncRooms() {
  const box = $('#rooms');
  box.innerHTML = '';
  const list = customRoom ? [...SCENES, customRoom.scene] : SCENES;
  list.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'room';
    b.setAttribute('aria-pressed', state.scene === s);
    b.setAttribute('aria-label', s.name);
    const src = s.id === 'custom' ? customRoom.thumb : s.src;
    b.innerHTML = `<img src="${src}" alt="" loading="lazy">`;
    b.addEventListener('click', () => { if (state.scene !== s) setScene(s, s.id === 'custom' ? customRoom.photo : null); });
    box.append(b);
  });
  box.classList.toggle('four', list.length > 3);
}

function syncLayers() {
  const box = $('#layers');
  box.innerHTML = '';
  state.prints.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', i === state.sel);
    const label = { tile: 'Tile backsplash', glass: 'Glass art', backlit: 'Backlit glass' }[p.type];
    b.innerHTML = `<img src="${designThumb(p)}" alt="">${label} · ${p.widthIn}×${p.heightIn} in`;
    b.addEventListener('click', () => { state.sel = i; syncAll(); });
    box.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'chip add';
  add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add print';
  add.addEventListener('click', addPrint);
  box.append(add);
}

function syncDesigns() {
  const p = sel();
  const box = $('#designs');
  box.innerHTML = '';
  if (!p) return;
  const list = listDesigns(p.type);
  if (p.upload) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'design'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<img src="${p.uploadThumb}" alt=""><span>Your artwork</span>`;
    box.append(b);
  }
  list.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'design';
    b.setAttribute('aria-pressed', !p.upload && p.design === d.id);
    const k = `${d.id}@200`;
    if (!thumbCache.has(k)) thumbCache.set(k, thumb(d.id, 200));
    b.innerHTML = `<img src="${thumbCache.get(k)}" alt=""><span>${d.name}</span>`;
    b.addEventListener('click', () => {
      p.design = d.id; p.upload = null; p.layout = p.type === 'tile' ? 'auto' : 'mural';
      syncAll();
    });
    box.append(b);
  });
}

function swatches(box, colors, current, onPick, label) {
  box.innerHTML = '';
  colors.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.background = c;
    b.setAttribute('aria-label', `${label} ${c}`);
    b.setAttribute('aria-pressed', c === current);
    b.addEventListener('click', () => { onPick(c); syncControls(); redraw(); });
    box.append(b);
  });
}

function syncControls() {
  const p = sel();
  $('#printControls').hidden = !p;
  $('#emptyNote').hidden = !!p;
  if (!p) return;
  pressed($('#types'), 'data-type', p.type);
  $('#wIn').value = p.widthIn;
  $('#hIn').value = p.heightIn;
  $('#scale').value = 100;
  $('#tileOpts').hidden = p.type !== 'tile';
  $('#glowOpts').hidden = p.type !== 'backlit';
  $('#clipWrap').hidden = !p.clip;
  $('#clipOn').checked = p.clipOn !== false;
  $('#tileIn').value = String(p.tileIn);
  const autoRepeat = !p.upload && !!getDesign(p.design)?.repeat;
  pressed($('#layout'), 'data-layout', p.layout === 'auto' ? (autoRepeat ? 'repeat' : 'mural') : p.layout);
  pressed($('#finish'), 'data-finish', p.finish);
  swatches($('#grout'), GROUTS, p.grout, (c) => { p.grout = c; }, 'Grout colour');
  swatches($('#glowColors'), GLOWS, p.glowColor, (c) => { p.glowColor = c; }, 'Light colour');
  $('#lightOn').checked = p.lightOn;
  $('#glow').value = Math.round(p.glow * 100);
}

function syncLight() {
  pressed($('#lightPresets'), 'data-preset', state.light.preset);
  $('#brightness').value = Math.round(state.light.brightness * 100);
  $('#warmth').value = Math.round(state.light.warmth * 100);
}

function tileCount(p) {
  if (p.type !== 'tile' || !p.tileIn) return '';
  return ` · ${Math.ceil(p.widthIn / p.tileIn) * Math.ceil(p.heightIn / p.tileIn)} tiles ${p.tileIn}×${p.tileIn} in`;
}

function summaryLines() {
  return state.prints.map((p, i) => {
    const sqft = (p.widthIn * p.heightIn / 144).toFixed(1);
    const extra = p.type === 'tile' ? `, ${p.finish}` : p.type === 'backlit' ? ', LED backlight' : ', stand-off mount';
    return { i, p, title: `${PRODUCT[p.type]} — ${designName(p)}`, detail: `${p.widthIn} × ${p.heightIn} in (${sqft} sq ft)${tileCount(p)}${extra}` };
  });
}

function syncSummary() {
  const ul = $('#summary');
  ul.innerHTML = '';
  const lines = summaryLines();
  if (!lines.length) { ul.innerHTML = '<li class="muted">Nothing selected yet.</li>'; return; }
  lines.forEach(({ p, title, detail }) => {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${designThumb(p)}" alt=""><div><b>${title}</b><small>${detail}</small></div>`;
    ul.append(li);
  });
}

function syncAll() {
  syncRooms(); syncLayers(); syncDesigns(); syncControls(); syncLight(); syncSummary(); redraw();
}

// ---------- control events ----------
$('#types').addEventListener('click', (e) => {
  const t = e.target.closest('[data-type]')?.dataset.type; const p = sel();
  if (!t || !p || p.type === t) return;
  p.type = t;
  if (!p.upload && !getDesign(p.design).tags.includes(t)) p.design = listDesigns(t)[0].id;
  if (t !== 'tile') p.layout = 'mural'; else p.layout = 'auto';
  syncAll();
});

$('#lightPresets').addEventListener('click', (e) => {
  const k = e.target.closest('[data-preset]')?.dataset.preset; if (!k) return;
  state.light = { ...LIGHT[k], preset: k };
  syncLight(); redraw();
});
$('#brightness').addEventListener('input', (e) => { state.light.brightness = e.target.value / 100; state.light.preset = ''; syncLight(); redraw(); });
$('#warmth').addEventListener('input', (e) => { state.light.warmth = e.target.value / 100; state.light.preset = ''; syncLight(); redraw(); });

function onSizeInput(which) {
  const p = sel(); if (!p) return;
  let w = parseFloat($('#wIn').value), h = parseFloat($('#hIn').value);
  const restore = () => { $('#wIn').value = p.widthIn; $('#hIn').value = p.heightIn; };
  if (!(w > 0) || !(h > 0)) { restore(); return; }
  const r = p.heightIn / p.widthIn;
  if ($('#lockRatio').checked) {
    if (which === 'w') h = w * r; else w = h / r;
    // keep both sides within 4–240 × 4–120 in, still in proportion
    const k = Math.min(1, 240 / w, 120 / h);
    w *= k; h *= k;
    const k2 = Math.max(1, 4 / w, 4 / h);
    w *= k2; h *= k2;
  }
  w = Math.round(Math.min(240, Math.max(4, w)) * 10) / 10;
  h = Math.round(Math.min(120, Math.max(4, h)) * 10) / 10;
  setSize(w, h);
  restore();
}
$('#wIn').addEventListener('change', () => onSizeInput('w'));
$('#hIn').addEventListener('change', () => onSizeInput('h'));

let scaleBase = null;
$('#scale').addEventListener('pointerdown', () => { scaleBase = sel() && { corners: sel().corners.map((c) => ({ ...c })) }; });
$('#scale').addEventListener('input', (e) => {
  const p = sel(); if (!p) return;
  if (!scaleBase) scaleBase = { corners: p.corners.map((c) => ({ ...c })) };
  const k = e.target.value / 100;
  p.corners = scaleQuad(scaleBase.corners, k, k);
  fast = true; redraw();
});
$('#scale').addEventListener('change', () => { scaleBase = null; fast = false; $('#scale').value = 100; redraw(); });

$('#tileIn').addEventListener('change', (e) => { sel().tileIn = +e.target.value; syncSummary(); redraw(); });
$('#layout').addEventListener('click', (e) => {
  const v = e.target.closest('[data-layout]')?.dataset.layout; if (!v) return;
  sel().layout = v; syncControls(); redraw();
});
$('#finish').addEventListener('click', (e) => {
  const v = e.target.closest('[data-finish]')?.dataset.finish; if (!v) return;
  sel().finish = v; syncControls(); syncSummary(); redraw();
});
$('#lightOn').addEventListener('change', (e) => { sel().lightOn = e.target.checked; redraw(); });
$('#glow').addEventListener('input', (e) => { sel().glow = e.target.value / 100; redraw(); });
$('#clipOn').addEventListener('change', (e) => { sel().clipOn = e.target.checked; redraw(); });
$('#btnSquare').addEventListener('click', squareUp);
$('#btnDelete').addEventListener('click', removeSelected);

$('#roomFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  let photo;
  try { photo = await fileToCanvas(f); } catch {
    say('This photo format could not be opened here. Please use a JPG or PNG.'); e.target.value = ''; return;
  }
  const W = photo.width, H = photo.height;
  const w = W * 0.36, h = w * (24 / 36);
  const custom = {
    id: 'custom', name: 'Your photo', occluders: [],
    prints: () => [{ type: 'glass', design: 'coast', widthIn: 36, heightIn: 24, layout: 'mural',
      corners: rect(W / 2 - w / 2, H * 0.4 - h / 2, W / 2 + w / 2, H * 0.4 + h / 2) }],
  };
  customRoom = { scene: custom, photo, thumb: photo.toDataURL('image/jpeg', 0.7) };
  await setScene(custom, photo);
  e.target.value = '';
});

let uploadSeq = 0;
$('#artFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; const p = sel(); if (!f || !p) return;
  let art;
  try { art = await fileToCanvas(f, 1600); } catch {
    say('This image could not be opened here. Please use a JPG or PNG.'); e.target.value = ''; return;
  }
  p.upload = art; p.uploadKey = `u${++uploadSeq}`; p.layout = 'mural';
  const t = document.createElement('canvas'); t.width = t.height = 96;
  const s = Math.max(96 / art.width, 96 / art.height);
  t.getContext('2d').drawImage(art, (96 - art.width * s) / 2, (96 - art.height * s) / 2, art.width * s, art.height * s);
  p.uploadThumb = t.toDataURL('image/jpeg', 0.85);
  // match the print's proportions to the artwork, keeping its width
  const ratio = art.height / art.width;
  setSize(p.widthIn, Math.max(4, Math.round(p.widthIn * ratio)));
  e.target.value = '';
  syncAll();
});

// ---------- save image ----------
$('#btnSave').addEventListener('click', () => {
  if (!state.photo) return;
  const scale = Math.min(2, 2048 / state.photo.width);
  const c = document.createElement('canvas');
  c.width = Math.round(state.photo.width * scale); c.height = Math.round(state.photo.height * scale);
  renderScene(c.getContext('2d'), { photo: state.photo, scene: state.scene, prints: state.prints, light: state.light }, scale, { steps: 24 });
  c.toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'my-room-with-prints.jpg';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/jpeg', 0.92);
});

// ---------- copy list ----------
$('#btnCopy').addEventListener('click', async () => {
  const text = ['My print selection:', ...summaryLines().map((l, k) => `${k + 1}. ${l.title}: ${l.detail}`)].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('#copyNote').textContent = 'Copied. Paste it into the quote form or an email.';
  } catch {
    $('#copyNote').textContent = text;
  }
});

// ---------- AR ----------
let mvLoaded = null;
function loadModelViewer() {
  mvLoaded ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
    s.onload = res; s.onerror = rej;
    document.head.append(s);
  });
  return mvLoaded;
}

let qrLoaded = null;
function loadQR() {
  qrLoaded ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = res; s.onerror = rej;
    document.head.append(s);
  });
  return qrLoaded;
}

// Link that opens the same print on a phone (catalogue designs only; an uploaded file stays on this device).
function shareUrl(p) {
  const base = location.href.split('#')[0];
  if (p.upload) return base;
  return `${base}#ar=${p.type},${p.design},${p.widthIn},${p.heightIn},${p.tileIn || 0}`;
}

async function openFromLink() {
  const m = location.hash.match(/^#ar=(tile|glass|backlit),([a-z]+),([\d.]+),([\d.]+),([\d.]+)$/);
  if (!m || !getDesign(m[2])) return;
  const [, type, design, w, h, t] = m;
  const p = state.prints[0];
  if (!p) return;
  const k = Math.min(+w / p.widthIn, +h / p.heightIn);
  Object.assign(p, { type, design, upload: null, layout: type === 'tile' ? 'auto' : 'mural', tileIn: +t || p.tileIn });
  p.corners = scaleQuad(p.corners, k, k);
  p.widthIn = Math.min(240, Math.max(4, +w)); p.heightIn = Math.min(120, Math.max(4, +h));
  state.sel = 0;
  squareUp();
  syncAll();
  $('#btnAR').click();
}

const touch0 = () => window.matchMedia('(pointer: coarse)').matches;
let lastModelUrl = null;
$('#btnAR').addEventListener('click', async () => {
  const p = sel() || state.prints[0];
  const dlg = $('#arDialog');
  const wrap = $('#mvWrap');
  if (!p) {
    $('#arSize').textContent = 'Add a print first, then view it on your wall.';
    wrap.innerHTML = '';
    dlg.showModal();
    return;
  }
  $('#arHow').innerHTML = touch0()
    ? 'Checking whether this phone supports AR…'
    : 'AR works on phones: scan the code with your phone, then tap <strong>AR · place on wall</strong> and point the camera at a wall. The print appears at its real size.';
  $('#arSize').innerHTML = `<b>${PRODUCT[p.type]} — ${designName(p)}</b><br>${p.widthIn} × ${p.heightIn} in, shown at real size.`;
  wrap.innerHTML = '<p class="muted" style="padding:16px">Preparing 3D preview…</p>';
  dlg.showModal();
  const touch = window.matchMedia('(pointer: coarse)').matches;
  $('#qrBox').hidden = touch;
  $('#qrBox p').textContent = p.upload
    ? 'On a computer? Scan to open the visualizer on your phone. Your uploaded artwork stays on this computer, so upload it there too.'
    : 'On a computer? Scan with your phone to open this same print in AR.';
  if (!touch) {
    loadQR().then(() => {
      const qr = window.qrcode(0, 'M');
      qr.addData(shareUrl(p)); qr.make();
      $('#qrImg').src = qr.createDataURL(5, 2);
    }).catch(() => { $('#qrBox').hidden = true; });
  }
  try {
    const [blob] = await Promise.all([panelGLB(buildTexture(p), p.widthIn, p.heightIn, p.type), loadModelViewer()]);
    if (lastModelUrl) URL.revokeObjectURL(lastModelUrl);
    lastModelUrl = URL.createObjectURL(blob);
    wrap.innerHTML = '';
    const mv = document.createElement('model-viewer');
    mv.addEventListener('load', () => {
      if (!touch) return;
      $('#arHow').innerHTML = mv.canActivateAR
        ? 'Tap <strong>AR · place on wall</strong>, point the camera at a wall and the print appears at its real size. Walk closer or step back to judge it.'
        : 'AR is not available in this browser. Open this page in Chrome on Android or Safari on iPhone to place the print on your wall. You can still turn the 3D preview with your finger.';
    }, { once: true });
    mv.setAttribute('src', lastModelUrl);
    mv.setAttribute('alt', `${designName(p)} print, ${p.widthIn} by ${p.heightIn} inches`);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr quick-look');
    mv.setAttribute('ar-placement', 'wall');
    mv.setAttribute('ar-scale', 'fixed');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('camera-orbit', '0deg 80deg auto');
    mv.setAttribute('shadow-intensity', '0.6');
    mv.setAttribute('environment-image', 'neutral');
    if (p.type === 'backlit') mv.setAttribute('exposure', '1.1');
    const btn = document.createElement('button');
    btn.slot = 'ar-button'; btn.className = 'ar-btn'; btn.type = 'button';
    btn.textContent = 'AR · place on wall';
    mv.append(btn);
    wrap.append(mv);
  } catch (err) {
    wrap.innerHTML = '<p class="muted" style="padding:16px">3D preview could not load. Check your connection and try again.</p>';
  }
});
$('#arClose').addEventListener('click', () => $('#arDialog').close());
$('#arDialog').addEventListener('click', (e) => { if (e.target === $('#arDialog')) $('#arDialog').close(); });

// ---------- start ----------
window.addEventListener('resize', () => { layout(); });
new ResizeObserver(() => layout()).observe(stage.parentElement);
requestAnimationFrame(frame);
const startScene = /^#ar=tile/.test(location.hash) ? SCENES[0] : /^#ar=/.test(location.hash) ? SCENES[2] : SCENES[0];
setScene(startScene).then(openFromLink);

// test hook (used by automated checks)
function exportCanvas(scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(state.photo.width * scale); c.height = Math.round(state.photo.height * scale);
  renderScene(c.getContext('2d'), { photo: state.photo, scene: state.scene, prints: state.prints, light: state.light }, scale, { steps: 24 });
  return c;
}
window.__viz = { state, setScene, SCENES, addPrint, setSize, squareUp, redraw, exportCanvas, syncAll };
