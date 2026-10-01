import { renderScene, buildTexture } from './render.js';
import { pointInQuad, scaleQuad, centroid, isConvex, squareToQuad, applyH, invertH } from './warp.js';
import { listDesigns, getDesign, thumb } from './art.js';
import { panelGLB } from './glb.js';
import { METALS, HANDLES, GAPS, GLASS_KINDS, BLOCK_SIZES } from './surfaces.js';
import { t, plural, has, getLang, setLang, initLang, applyStatic, localName } from './i18n.js';

const $ = (s) => document.querySelector(s);
let customRoom = null;
function say(msg) { const el = $('#status'); el.textContent = msg; clearTimeout(say.t); say.t = setTimeout(() => { el.textContent = ''; }, 6000); }
const P = (x, y) => ({ x, y });
const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Products, in the order of the buttons. Names live in i18n.js: type.<id> (short) and product.<id> (for the quote).
const TYPES = ['tile', 'glass', 'backlit', 'cabinet', 'metal', 'glassblock'];
const productName = (type) => t(`product.${type}`);
const GAP_LABEL = { 0.0625: '1/16″', 0.125: '1/8″', 0.1875: '3/16″' };
const doorsFor = (widthIn) => clamp(Math.round(widthIn / 18), 1, 6); // about 18 in per door
const GROUTS = ['#f2efe9', '#d9d4cc', '#8c8780', '#2f2c29'];
const GLOWS = ['#ffe7b8', '#ffffff', '#cfe3ff', '#ffc9a3'];

// ---------- room scenes ----------
// To add a room: put a ~1024 px wide JPG in rooms/ and add one object to SCENES (order = order of thumbnails).
// Format (all coordinates are photo pixels):
// {
//   id: 'kitchen-cabinets',                                   // unique, a-z 0-9 and dashes
//   name: { en: 'Kitchen cabinets', ru: 'Кухонные шкафы' },   // caption under the thumbnail, both languages
//   src: 'rooms/kitchen-cabinets.jpg',
//   lightMatch: { colour: 0, strength: 0.8 },                 // optional: 0 = take only the room's brightness
//                                                             //   (painted walls), >1 = also its light colour (white walls)
//   occluders: [rect(x0, y0, x1, y1)],                        // optional: things in front of the print (taps, sockets)
//   prints: () => [{                                          // what is on the wall when the room opens
//     type: 'cabinet', design: 'marble', widthIn: 72, heightIn: 30,
//     corners: [P(100, 200), P(700, 190), P(700, 450), P(100, 460)],   // TL, TR, BR, BL
//     doors: 4, handle: 'bar', finish: 'gloss',               // cabinet only ('bar' | 'knob' | 'none'; 'gloss' | 'matte')
//     // metal only: metal: 'aluminium' | 'steel' | 'brass', underbase: false
//     // tile only: tileIn: 6, grout: GROUTS[0]; any type: clip: [P(..), ...] polygon the print is cut to
//   }],
// },
// bathroom → type 'tile' or 'glass' · office → 'metal' or 'glass' · commercial → 'metal' or 'backlit'.
const SCENES = [
  {
    id: 'kitchen', name: { en: 'Kitchen backsplash', ru: 'Кухонный фартук' }, src: 'rooms/kitchen-tiles.jpg',
    lightMatch: { colour: 1.45, strength: 0.95 }, // white tiles: the warm under-cabinet light is the light's own colour
    occluders: [rect(180, 464, 213, 514), rect(728, 464, 759, 514), rect(867, 466, 899, 516)],
    // polished granite: wash out the old tiles' reflection, mirror the new print in it
    reflection: { edgeY: 580, alpha: 0.26, blur: 2.5, wash: 7,
      polys: [[P(100, 580), P(238, 580), P(238, 668), P(60, 672)], [P(604, 580), P(955, 580), P(980, 676), P(604, 672)]] },
    prints: () => [{
      type: 'tile', design: 'moroccan', widthIn: 99, heightIn: 28, tileIn: 6, grout: GROUTS[0],
      corners: rect(112, 340, 950, 580),
      clip: [P(112, 428), P(312, 428), P(312, 340), P(590, 340), P(590, 428), P(950, 428), P(950, 580), P(112, 580)],
    }],
  },
  {
    id: 'kitchen2', name: { en: 'Kitchen, side view', ru: 'Кухня сбоку' }, src: 'rooms/kitchen-angle.jpg',
    occluders: [[P(437, 268), P(462, 266), P(462, 308), P(437, 310)]],
    prints: () => [{
      type: 'glass', design: 'citrus', widthIn: 30, heightIn: 20, layout: 'mural',
      corners: [P(420, 143), P(700, 93), P(700, 414), P(420, 327)],
    }],
  },
  {
    id: 'living', name: { en: 'Living room', ru: 'Гостиная' }, src: 'rooms/living-room.jpg',
    occluders: [],
    prints: () => [{
      type: 'backlit', design: 'aurora', widthIn: 48, heightIn: 30, glow: 0.8, glowColor: GLOWS[0], lightOn: true,
      corners: rect(229, 18, 795, 372),
    }],
  },
  {
    id: 'bathroom', name: { en: 'Bathroom', ru: 'Ванная' }, src: 'rooms/bathroom.jpg',
    lightMatch: { colour: 1.2, strength: 0.9 },
    // the tap and the sink rim; the plant is cut out by its colour (keyOccluders), so the leaves stay sharp
    occluders: [rect(418, 388, 536, 452), [P(495, 448), P(585, 440), P(622, 452), P(628, 476), P(495, 476)]],
    keyOccluders: [{ box: [925, 335, 1105, 492], minSat: 0.28 }],
    prints: () => [{
      type: 'tile', design: 'terrazzo', widthIn: 84, heightIn: 72, tileIn: 12, grout: GROUTS[1],
      corners: [P(497, 22), P(1040, 18), P(1040, 486), P(497, 474)],
      clip: [P(497, 22), P(1040, 18), P(1040, 486), P(497, 474)],
    }],
  },
  {
    id: 'office', name: { en: 'Office', ru: 'Офис' }, src: 'rooms/office.jpg',
    occluders: [],
    prints: () => [{
      type: 'metal', design: 'coast', widthIn: 72, heightIn: 40, metal: 'aluminium', underbase: false,
      corners: [P(414, 61), P(805, 62), P(802, 282), P(414, 283)], // over the whiteboard, between the wall lamps
    }],
  },
  {
    id: 'commercial', name: { en: 'Café wall', ru: 'Стена в кафе' }, src: 'rooms/commercial.jpg',
    lightMatch: { colour: 1.2, strength: 1 }, // dim, warm bar light: the print takes its colour too
    occluders: [],
    prints: () => [{
      type: 'glass', design: 'botanical', widthIn: 72, heightIn: 36, layout: 'mural',
      corners: rect(600, 190, 1150, 460),
    }],
  },
  {
    id: 'kitchen-cabinets', name: { en: 'Kitchen cabinets', ru: 'Кухонные шкафы' }, src: 'rooms/kitchen-cabinets.jpg',
    // the pendant lamp hangs in front of the right-hand doors
    occluders: [[P(838, 96), P(873, 96), P(920, 168), P(918, 186), P(793, 186), P(791, 168)], rect(852, 0, 859, 96)],
    prints: () => [{
      type: 'cabinet', design: 'terrazzo', widthIn: 64, heightIn: 36, doors: 5, handle: 'none', finish: 'matte',
      corners: rect(590, 148, 930, 339), // the five upper doors right of the microwave
    }],
  },
  {
    id: 'glass-block', name: { en: 'Glass block wall', ru: 'Стена из стеклоблоков' }, src: 'rooms/glass-block.jpg',
    lightMatch: { colour: 0, strength: 0.7 },
    surfaceThrough: 0.55, // real wavy glass and reflections show through the ink
    occluders: [],
    prints: () => [{
      type: 'glassblock', design: 'coast', widthIn: 80, heightIn: 48, blockIn: 8, glassKind: 'frosted', grout: GROUTS[0],
      corners: rect(193, 145, 1002, 625), // 10 × 6 real blocks, on their mortar joints
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
  shape: false, // editing the outline points of the selected print
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
    clipOn: true, doors: doorsFor(p.widthIn || 54), doorGapIn: 0.125, handle: 'bar', metal: 'aluminium', underbase: false,
    blockIn: 8, glassKind: 'wave',
    ...p, corners: p.corners.map((c) => ({ ...c })),
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
    if (token === sceneToken) { $('#loading').classList.add('done'); say(t('err.room')); }
    return;
  }
  if (token !== sceneToken) return; // a newer room was picked while this one loaded
  state.scene = scene;
  state.photo = img;
  state.prints = (scene.prints ? scene.prints() : []).map(withDefaults);
  state.sel = state.prints.length ? 0 : -1;
  state.shape = false;
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
const handles = [0, 1, 2, 3].map((i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'handle'; b.dataset.i = i;
  $('#handles').append(b);
  return b;
});
function labelHandles() {
  handles.forEach((b, i) => b.setAttribute('aria-label', t('corner.aria', { name: t(`corner.${i}`) })));
}

// Outline points (print.clip): any number of points the print is cut to, for walls with steps or breaks.
// Each edge has a "+" handle in its middle; pressing it adds a point there.
const vtxEls = [], midEls = [];
function pool(arr, n, cls, key) {
  while (arr.length < n) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `handle ${cls}`;
    $('#handles').append(b); arr.push(b);
  }
  arr.forEach((b, i) => { b.hidden = i >= n; b.dataset[key] = i; });
}
const put = (el, c) => { el.style.left = `${c.x * viewScale}px`; el.style.top = `${c.y * viewScale}px`; };
const pts = (arr) => arr.map((c) => `${c.x * viewScale},${c.y * viewScale}`).join(' ');

function drawOverlay() {
  const p = state.prints[state.sel];
  const shaping = !!p && state.shape && !!p.clip;
  const n = shaping ? p.clip.length : 0;
  handles.forEach((h) => { h.hidden = !p || shaping; });
  pool(vtxEls, n, 'vtx', 'v');
  pool(midEls, n, 'mid', 'm');
  $('#outline .frame').setAttribute('points', p ? pts(p.corners) : '');
  $('#outline .cut').setAttribute('points', shaping ? pts(p.clip) : '');
  stage.classList.toggle('shaping', shaping);
  const hint = $('#hint'), key = shaping ? 'stage.hintShape' : 'stage.hint';
  if (hint.dataset.i18n !== key) { hint.dataset.i18n = key; hint.textContent = t(key); }
  if (!p) return;
  p.corners.forEach((c, i) => put(handles[i], c));
  for (let i = 0; i < n; i++) {
    const a = p.clip[i], b = p.clip[(i + 1) % n];
    put(vtxEls[i], a);
    put(midEls[i], P((a.x + b.x) / 2, (a.y + b.y) / 2));
    midEls[i].hidden = Math.hypot(b.x - a.x, b.y - a.y) * viewScale < 64;
    vtxEls[i].setAttribute('aria-label', t('shape.point', { n: i + 1 }));
    midEls[i].setAttribute('aria-label', t('shape.add'));
  }
}

// Move the corners and carry the outline with them: the outline keeps its place on the print.
function setCorners(p, next, from = p.corners, clipFrom = p.clip) {
  if (clipFrom) {
    const toUV = invertH(squareToQuad(from)), H = squareToQuad(next);
    p.clip = clipFrom.map((q) => { const { u, v } = toUV(q.x, q.y); return applyH(H, u, v); });
  }
  p.corners = next;
}

// The outline in the print's own coordinates (0–1 across, 0–1 down), or null when nothing is cut away.
function clipUV(p) {
  if (!p.clip || p.clipOn === false) return null;
  const toUV = invertH(squareToQuad(p.corners));
  const uv = p.clip.map((q) => { const { u, v } = toUV(q.x, q.y); return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) }; });
  return polyArea(uv) > 0.995 ? null : uv;
}
const polyArea = (uv) => Math.abs(uv.reduce((s, a, i) => { const b = uv[(i + 1) % uv.length]; return s + a.u * b.v - b.u * a.v; }, 0)) / 2;
function inPoly(uv, u, v) {
  let inside = false;
  for (let i = 0, j = uv.length - 1; i < uv.length; j = i++) {
    const a = uv[i], b = uv[j];
    if ((a.v > v) !== (b.v > v) && u < (b.u - a.u) * (v - a.v) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
}

function ensureClip(p) {
  if (!p.clip) p.clip = p.corners.map((c) => ({ ...c }));
  p.clipOn = true;
}
function setShape(on) {
  const p = sel();
  state.shape = !!on && !!p;
  if (state.shape) ensureClip(p);
  syncControls(); redraw();
}
function removePoint(i) {
  const p = sel(); if (!p?.clip) return;
  if (p.clip.length <= 3) { say(t('shape.min')); return; }
  p.clip.splice(i, 1);
  redraw();
}
let lastTap = { i: -1, t: 0 };

// ---------- pointer interaction ----------
function toImage(e) {
  const r = stage.getBoundingClientRect();
  return P((e.clientX - r.left) / viewScale, (e.clientY - r.top) / viewScale);
}

let drag = null;

stage.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.handle');
  const pt = toImage(e);
  if (h && h.dataset.m != null) {
    const p = sel(), i = +h.dataset.m, a = p.clip[i], b = p.clip[(i + 1) % p.clip.length];
    p.clip.splice(i + 1, 0, P((a.x + b.x) / 2, (a.y + b.y) / 2));
    drawOverlay();
    drag = { kind: 'vtx', i: i + 1, el: vtxEls[i + 1] };
    drag.el.classList.add('drag');
  } else if (h && h.dataset.v != null) {
    const i = +h.dataset.v, now = performance.now();
    if (lastTap.i === i && now - lastTap.t < 400) { lastTap = { i: -1, t: 0 }; removePoint(i); e.preventDefault(); return; }
    lastTap = { i, t: now };
    drag = { kind: 'vtx', i, el: h };
    h.classList.add('drag');
  } else if (h) {
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
  if (drag.kind === 'vtx') {
    p.clip[drag.i] = P(clamp(pt.x, 0, W), clamp(pt.y, 0, H));
  } else if (drag.kind === 'corner') {
    const next = p.corners.slice();
    next[drag.i] = P(Math.max(-W * 0.2, Math.min(W * 1.2, pt.x)), Math.max(-H * 0.2, Math.min(H * 1.2, pt.y)));
    if (isConvex(next)) setCorners(p, next); // never let the print fold over itself
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
  p.clip?.forEach((q) => { q.x += dx; q.y += dy; });
}

function nudge(dx, dy, cornerIndex) {
  const p = state.prints[state.sel];
  if (!p) return;
  if (cornerIndex == null) moveBy(p, dx, dy);
  else {
    const next = p.corners.map((q) => ({ ...q }));
    next[cornerIndex].x += dx; next[cornerIndex].y += dy;
    if (isConvex(next)) setCorners(p, next);
  }
  redraw();
}

document.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const h = document.activeElement?.closest?.('.handle');
  const v = h?.dataset.v != null ? +h.dataset.v : null;
  if (v != null && sel()?.clip && map[e.key]) {
    const k = (e.shiftKey ? 10 : 2) / Math.max(0.3, viewScale), q = sel().clip[v];
    q.x = clamp(q.x + map[e.key][0] * k, 0, state.photo.width); q.y = clamp(q.y + map[e.key][1] * k, 0, state.photo.height);
    redraw(); e.preventDefault();
  } else if (v != null && (e.key === 'Delete' || e.key === 'Backspace')) {
    removePoint(v); e.preventDefault();
  } else if (h?.dataset.m != null && (e.key === 'Enter' || e.key === ' ')) {
    const p = sel(), i = +h.dataset.m, a = p.clip[i], b = p.clip[(i + 1) % p.clip.length];
    p.clip.splice(i + 1, 0, P((a.x + b.x) / 2, (a.y + b.y) / 2)); redraw(); e.preventDefault();
  } else if (map[e.key] && (h || document.activeElement === stage)) {
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
  if (state.sel < 0) state.shape = false;
  syncAll();
}

// Keep the print's centre and size, remove the perspective (a straight-on rectangle).
function squareUp() {
  const p = sel(); if (!p) return;
  const c = centroid(p.corners);
  const top = Math.hypot(p.corners[1].x - p.corners[0].x, p.corners[1].y - p.corners[0].y);
  const bottom = Math.hypot(p.corners[2].x - p.corners[3].x, p.corners[2].y - p.corners[3].y);
  const w = (top + bottom) / 2, h = w * (p.heightIn / p.widthIn);
  setCorners(p, rect(c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2));
  redraw();
}

// A glass block wall is built from whole blocks: round the size to the nearest block.
function snapBlocks(p) {
  const b = p.blockIn, r = (v) => Math.max(b, Math.round(v / b) * b);
  const w = r(p.widthIn), h = r(p.heightIn);
  if (w === p.widthIn && h === p.heightIn) return;
  setCorners(p, scaleQuad(p.corners, w / p.widthIn, h / p.heightIn));
  p.widthIn = w; p.heightIn = h;
}

function setSize(wIn, hIn) {
  const p = sel(); if (!p || !(wIn > 0) || !(hIn > 0)) return;
  setCorners(p, scaleQuad(p.corners, wIn / p.widthIn, hIn / p.heightIn));
  p.widthIn = wIn; p.heightIn = hIn;
  if (p.type === 'glassblock') snapBlocks(p);
  if (p.type === 'cabinet') p.doors = doorsFor(wIn);
  syncControls();
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
function designName(p) {
  if (p.upload) return t('design.yours');
  return has(`design.${p.design}`) ? t(`design.${p.design}`) : getDesign(p.design).name;
}
const sceneName = (s) => (s.nameKey ? t(s.nameKey) : localName(s.name));

function syncRooms() {
  const box = $('#rooms');
  box.innerHTML = '';
  const list = customRoom ? [...SCENES, customRoom.scene] : SCENES;
  list.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'room';
    b.setAttribute('aria-pressed', state.scene === s);
    const src = s.id === 'custom' ? customRoom.thumb : s.src;
    b.innerHTML = `<img src="${src}" alt="" loading="lazy"><span></span>`;
    b.querySelector('span').textContent = sceneName(s);
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
    b.innerHTML = `<img src="${designThumb(p)}" alt="">${t(`type.${p.type}`)} · ${p.widthIn}×${p.heightIn} ${t('unit.in')}`;
    b.addEventListener('click', () => { state.sel = i; syncAll(); });
    box.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'chip add';
  add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>${t('chip.add')}`;
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
    b.innerHTML = `<img src="${p.uploadThumb}" alt=""><span>${t('design.yours')}</span>`;
    box.append(b);
  }
  list.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'design';
    b.setAttribute('aria-pressed', !p.upload && p.design === d.id);
    const k = `${d.id}@200`;
    if (!thumbCache.has(k)) thumbCache.set(k, thumb(d.id, 200));
    b.innerHTML = `<img src="${thumbCache.get(k)}" alt=""><span>${designName({ design: d.id })}</span>`;
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
  $('#typeNote').textContent = t(`note.${p.type}`);
  $('#tileOpts').hidden = p.type !== 'tile';
  $('#cabinetOpts').hidden = p.type !== 'cabinet';
  $('#metalOpts').hidden = p.type !== 'metal';
  $('#blockOpts').hidden = p.type !== 'glassblock';
  $('#blockIn').value = String(p.blockIn);
  pressed($('#glassKind'), 'data-glass', p.glassKind);
  $('#finishRow').hidden = p.type !== 'tile' && p.type !== 'cabinet';
  $('#glowOpts').hidden = p.type !== 'backlit';
  $('#doorsOut').value = p.doors;
  $('#doorsOut').textContent = p.doors;
  $('#doorsLess').disabled = p.doors <= 1;
  $('#doorsMore').disabled = p.doors >= 6;
  pressed($('#doorGap'), 'data-gap', p.doorGapIn);
  pressed($('#handleKind'), 'data-handle', p.handle);
  pressed($('#metalKind'), 'data-metal', p.metal);
  $('#underbase').checked = !!p.underbase;
  if (state.shape) ensureClip(p);
  $('#btnShape').setAttribute('aria-pressed', String(state.shape));
  $('#btnShapeReset').hidden = !p.clip;
  $('#clipWrap').hidden = !p.clip || state.shape;
  $('#clipOn').checked = p.clipOn !== false;
  $('#tileIn').value = String(p.tileIn);
  const autoRepeat = !p.upload && !!getDesign(p.design)?.repeat;
  pressed($('#layout'), 'data-layout', p.layout === 'auto' ? (autoRepeat ? 'repeat' : 'mural') : p.layout);
  pressed($('#finish'), 'data-finish', p.finish);
  swatches($('#grout'), GROUTS, p.grout, (c) => { p.grout = c; }, t('tile.groutColour'));
  swatches($('#mortar'), GROUTS, p.grout, (c) => { p.grout = c; }, t('block.mortarColour'));
  swatches($('#glowColors'), GLOWS, p.glowColor, (c) => { p.glowColor = c; }, t('led.colour'));
  $('#lightOn').checked = p.lightOn;
  $('#glow').value = Math.round(p.glow * 100);
}

function syncLight() {
  pressed($('#lightPresets'), 'data-preset', state.light.preset);
  $('#brightness').value = Math.round(state.light.brightness * 100);
  $('#warmth').value = Math.round(state.light.warmth * 100);
}

// Whole tiles or blocks needed: a cell counts when any part of it is inside the outline.
function cellCount(p, s, uv) {
  const nx = Math.ceil(p.widthIn / s), ny = Math.ceil(p.heightIn / s);
  if (!uv) return nx * ny;
  let n = 0;
  const probe = [0.08, 0.5, 0.92];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const hit = probe.some((a) => probe.some((b) =>
      inPoly(uv, Math.min(1, (i + a) * s / p.widthIn), Math.min(1, (j + b) * s / p.heightIn))));
    if (hit) n++;
  }
  return n;
}
function tileCount(p, uv) {
  if (p.type === 'glassblock') return ` · ${plural('sum.blocks', cellCount(p, p.blockIn, uv), { s: p.blockIn })}`;
  if (p.type !== 'tile' || !p.tileIn) return '';
  return ` · ${plural('sum.tiles', cellCount(p, p.tileIn, uv), { s: p.tileIn })}`;
}

// The product-specific part of a quote line.
function extraFor(p) {
  const finish = t(`finish.${p.finish}.lc`);
  switch (p.type) {
    case 'tile': return [finish];
    case 'backlit': return [t('sum.led')];
    case 'cabinet': return [plural('sum.doors', p.doors), t('sum.gap', { g: GAP_LABEL[p.doorGapIn] || `${p.doorGapIn}″` }),
      t(`sum.handle.${p.handle}`), finish];
    case 'metal': return [t(`sum.metal.${p.metal}`), t(p.underbase ? 'sum.underbase' : 'sum.noUnderbase')];
    case 'glassblock': return [t(`sum.glass.${p.glassKind}`)];
    default: return [t('sum.standoff')];
  }
}

function summaryLines() {
  return state.prints.map((p, i) => {
    const uv = clipUV(p);
    const a = (p.widthIn * p.heightIn / 144) * (uv ? polyArea(uv) : 1);
    const sqft = a.toLocaleString(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const area = uv ? t('sum.areaCut', { a: sqft }) : `${sqft} ${t('unit.sqft')}`;
    const unit = t('unit.in');
    return { i, p, title: `${productName(p.type)} · ${designName(p)}`,
      detail: `${p.widthIn} × ${p.heightIn} ${unit} (${area})${tileCount(p, uv)}, ${extraFor(p).join(', ')}` };
  });
}

function syncSummary() {
  const ul = $('#summary');
  ul.innerHTML = '';
  const lines = summaryLines();
  if (!lines.length) { ul.innerHTML = `<li class="muted">${t('sum.none')}</li>`; return; }
  lines.forEach(({ p, title, detail }) => {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${designThumb(p)}" alt=""><div><b></b><small></small></div>`;
    li.querySelector('b').textContent = title;
    li.querySelector('small').textContent = detail;
    ul.append(li);
  });
}

function syncAll() {
  syncRooms(); syncLayers(); syncDesigns(); syncControls(); syncLight(); syncSummary(); redraw();
}

// ---------- control events ----------
$('#types').addEventListener('click', (e) => {
  const type = e.target.closest('[data-type]')?.dataset.type; const p = sel();
  if (!TYPES.includes(type) || !p || p.type === type) return;
  p.type = type;
  const FIRST = { metal: 'coast', glassblock: 'aurora', backlit: 'aurora' };
  if (!p.upload && !getDesign(p.design).tags.includes(type)) p.design = FIRST[type] || listDesigns(type)[0].id;
  p.layout = type === 'tile' ? 'auto' : 'mural';
  if (type === 'cabinet') p.doors = doorsFor(p.widthIn);
  if (type === 'glassblock') snapBlocks(p);
  syncAll();
});

// cabinet doors
function setDoors(n) { const p = sel(); if (!p) return; p.doors = clamp(n, 1, 6); syncControls(); syncSummary(); redraw(); }
$('#doorsLess').addEventListener('click', () => setDoors(sel().doors - 1));
$('#doorsMore').addEventListener('click', () => setDoors(sel().doors + 1));
$('#doorGap').addEventListener('click', (e) => {
  const v = +e.target.closest('[data-gap]')?.dataset.gap; if (!GAPS.includes(v)) return;
  sel().doorGapIn = v; syncControls(); syncSummary(); redraw();
});
$('#handleKind').addEventListener('click', (e) => {
  const v = e.target.closest('[data-handle]')?.dataset.handle; if (!HANDLES.includes(v)) return;
  sel().handle = v; syncControls(); syncSummary(); redraw();
});
// metal
$('#metalKind').addEventListener('click', (e) => {
  const v = e.target.closest('[data-metal]')?.dataset.metal; if (!METALS.includes(v)) return;
  sel().metal = v; syncControls(); syncSummary(); redraw();
});
$('#underbase').addEventListener('change', (e) => { sel().underbase = e.target.checked; syncSummary(); redraw(); });

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
const snapshot = (p) => ({ corners: p.corners.map((c) => ({ ...c })), clip: p.clip?.map((c) => ({ ...c })) });
$('#scale').addEventListener('pointerdown', () => { scaleBase = sel() && snapshot(sel()); });
$('#scale').addEventListener('input', (e) => {
  const p = sel(); if (!p) return;
  if (!scaleBase) scaleBase = snapshot(p);
  const k = e.target.value / 100;
  setCorners(p, scaleQuad(scaleBase.corners, k, k), scaleBase.corners, scaleBase.clip);
  fast = true; redraw();
});
$('#scale').addEventListener('change', () => { scaleBase = null; fast = false; $('#scale').value = 100; redraw(); });

$('#tileIn').addEventListener('change', (e) => { sel().tileIn = +e.target.value; syncSummary(); redraw(); });
$('#blockIn').addEventListener('change', (e) => {
  const p = sel(); if (!BLOCK_SIZES.includes(+e.target.value)) return;
  p.blockIn = +e.target.value; snapBlocks(p); syncControls(); syncSummary(); syncLayers(); redraw();
});
$('#glassKind').addEventListener('click', (e) => {
  const v = e.target.closest('[data-glass]')?.dataset.glass; if (!GLASS_KINDS.includes(v)) return;
  sel().glassKind = v; syncControls(); syncSummary(); redraw();
});
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
$('#btnShape').addEventListener('click', () => setShape(!state.shape));
$('#btnShapeReset').addEventListener('click', () => {
  const p = sel(); if (!p) return;
  p.clip = state.shape ? p.corners.map((c) => ({ ...c })) : undefined;
  syncControls(); redraw();
});
$('#btnSquare').addEventListener('click', squareUp);
$('#btnDelete').addEventListener('click', removeSelected);

$('#roomFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  let photo;
  try { photo = await fileToCanvas(f); } catch {
    say(t('err.photo')); e.target.value = ''; return;
  }
  const W = photo.width, H = photo.height;
  const w = W * 0.36, h = w * (24 / 36);
  const custom = {
    id: 'custom', nameKey: 'room.custom', occluders: [],
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
    say(t('err.art')); e.target.value = ''; return;
  }
  p.upload = art; p.uploadKey = `u${++uploadSeq}`; p.layout = 'mural';
  const tc = document.createElement('canvas'); tc.width = tc.height = 96;
  const s = Math.max(96 / art.width, 96 / art.height);
  tc.getContext('2d').drawImage(art, (96 - art.width * s) / 2, (96 - art.height * s) / 2, art.width * s, art.height * s);
  p.uploadThumb = tc.toDataURL('image/jpeg', 0.85);
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
  const text = [t('sum.head'), ...summaryLines().map((l, k) => `${k + 1}. ${l.title}: ${l.detail}`)].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('#copyNote').textContent = t('sum.copied');
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
// #ar=type,design,width,height,tile[,doors,handle | ,metal,underbase]&lang=xx
const PUBLIC_URL = 'https://flowlab-dev.github.io/n/print-visualizer/';
function shareUrl(p) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const base = local ? PUBLIC_URL : location.href.split('#')[0];
  const lang = `lang=${getLang()}`;
  if (p.upload) return `${base}#${lang}`;
  const extra = p.type === 'cabinet' ? `,${p.doors},${p.handle}` : p.type === 'metal' ? `,${p.metal},${p.underbase ? 1 : 0}`
    : p.type === 'glassblock' ? `,${p.glassKind},0` : '';
  const size = p.type === 'glassblock' ? p.blockIn : p.tileIn || 0;
  return `${base}#ar=${p.type},${p.design},${p.widthIn},${p.heightIn},${size}${extra}&${lang}`;
}

const AR_LINK = /^#ar=(tile|glass|backlit|cabinet|metal|glassblock),([a-z]+),([\d.]+),([\d.]+),([\d.]+)(?:,([a-z0-9]+),([a-z0-9]+))?(?:&lang=[a-z]{2})?$/;
async function openFromLink() {
  const m = location.hash.match(AR_LINK);
  if (!m || !getDesign(m[2])) return;
  const [, type, design, w, h, tl, x1, x2] = m;
  const p = state.prints[0];
  if (!p) return;
  const k = Math.min(+w / p.widthIn, +h / p.heightIn);
  Object.assign(p, { type, design, upload: null, layout: type === 'tile' ? 'auto' : 'mural', tileIn: +tl || p.tileIn });
  if (type === 'cabinet' && x1) { p.doors = clamp(+x1 || 3, 1, 6); if (HANDLES.includes(x2)) p.handle = x2; }
  if (type === 'metal' && x1) { if (METALS.includes(x1)) p.metal = x1; p.underbase = x2 === '1'; }
  if (type === 'glassblock') { if (BLOCK_SIZES.includes(+tl)) p.blockIn = +tl; if (GLASS_KINDS.includes(x1)) p.glassKind = x1; }
  setCorners(p, scaleQuad(p.corners, k, k));
  p.widthIn = clamp(+w, 4, 240); p.heightIn = clamp(+h, 4, 120);
  state.sel = 0;
  squareUp();
  syncAll();
  $('#btnAR').click();
}

// AR dialog text depends on the language, so it is kept as state and re-drawn when the language changes.
const ar = { p: null, touch: false, how: 'ar.howDefault' };
function renderArText() {
  const p = ar.p;
  $('#arHow').innerHTML = t(ar.how);
  if (!p) { $('#arSize').textContent = t('ar.addFirst'); return; }
  $('#arSize').innerHTML = '<b></b><br><span></span>';
  $('#arSize b').textContent = `${productName(p.type)} · ${designName(p)}`;
  $('#arSize span').textContent = t('ar.size', { w: p.widthIn, h: p.heightIn });
  $('#qrBox p').textContent = t(p.upload ? 'ar.qrUpload' : 'ar.qr');
  const mv = $('#mvWrap model-viewer');
  if (mv) {
    mv.setAttribute('alt', t('ar.alt', { design: designName(p), w: p.widthIn, h: p.heightIn }));
    const btn = mv.querySelector('.ar-btn'); if (btn) btn.textContent = t('ar.button');
  }
  const note = $('#mvWrap [data-ar-note]'); if (note) note.textContent = t(note.dataset.arNote);
}
function arNote(key) { return `<p class="muted" style="padding:16px" data-ar-note="${key}">${t(key)}</p>`; }

const touch0 = () => window.matchMedia('(pointer: coarse)').matches;
let lastModelUrl = null;
$('#btnAR').addEventListener('click', async () => {
  const p = sel() || state.prints[0];
  const dlg = $('#arDialog');
  const wrap = $('#mvWrap');
  ar.p = p || null;
  if (!p) {
    ar.how = 'ar.howDefault';
    wrap.innerHTML = '';
    $('#qrBox').hidden = true;
    renderArText();
    dlg.showModal();
    return;
  }
  const touch = touch0();
  ar.touch = touch;
  ar.how = touch ? 'ar.checking' : 'ar.desktop';
  wrap.innerHTML = arNote('ar.preparing');
  $('#qrBox').hidden = touch;
  renderArText();
  dlg.showModal();
  if (!touch) {
    loadQR().then(() => {
      const qr = window.qrcode(0, 'M');
      qr.addData(shareUrl(p)); qr.make();
      $('#qrImg').src = qr.createDataURL(5, 2);
    }).catch(() => { $('#qrBox').hidden = true; });
  }
  try {
    const [blob] = await Promise.all([
      panelGLB(buildTexture(p), { widthIn: p.widthIn, heightIn: p.heightIn, kind: p.type, finish: p.finish, metal: p.metal, underbase: p.underbase, outline: clipUV(p) }),
      loadModelViewer(),
    ]);
    if (lastModelUrl) URL.revokeObjectURL(lastModelUrl);
    lastModelUrl = URL.createObjectURL(blob);
    wrap.innerHTML = '';
    const mv = document.createElement('model-viewer');
    mv.addEventListener('load', () => {
      if (!touch) return;
      ar.how = mv.canActivateAR ? 'ar.can' : 'ar.cannot';
      renderArText();
    }, { once: true });
    mv.setAttribute('src', lastModelUrl);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr quick-look');
    mv.setAttribute('ar-placement', 'wall');
    mv.setAttribute('ar-scale', 'fixed');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('camera-orbit', p.type === 'metal' ? '-18deg 80deg auto' : '0deg 80deg auto'); // a slight angle shows the metal's shine
    mv.setAttribute('shadow-intensity', '0.6');
    mv.setAttribute('environment-image', 'neutral');
    if (p.type === 'backlit') mv.setAttribute('exposure', '1.1');
    const btn = document.createElement('button');
    btn.slot = 'ar-button'; btn.className = 'ar-btn'; btn.type = 'button';
    mv.append(btn);
    wrap.append(mv);
    renderArText();
  } catch (err) {
    wrap.innerHTML = arNote('ar.failed');
    if (touch) { ar.how = 'ar.howDefault'; renderArText(); } // do not leave "Checking…" on screen
  }
});
$('#arClose').addEventListener('click', () => $('#arDialog').close());
$('#arDialog').addEventListener('click', (e) => { if (e.target === $('#arDialog')) $('#arDialog').close(); });

// ---------- language ----------
function syncTileOptions() {
  $('#tileIn').querySelectorAll('option').forEach((o) => {
    o.textContent = o.value === '0' ? t('tile.sheet') : t('tile.opt', { n: o.value });
  });
  $('#blockIn').querySelectorAll('option').forEach((o) => { o.textContent = t('tile.opt', { n: o.value }); });
}
function applyLang() {
  applyStatic();
  syncTileOptions();
  labelHandles();
  document.querySelectorAll('#langSwitch [data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === getLang()));
  syncThemeButton();
  $('#copyNote').textContent = '';
  if (state.photo) syncAll();
  if ($('#arDialog').open) renderArText();
}
$('#langSwitch').addEventListener('click', (e) => {
  const l = e.target.closest('[data-lang]')?.dataset.lang;
  if (!l || l === getLang()) return;
  setLang(l);
  applyLang();
});

// ---------- interface theme (day / night). The room photo and prints are never changed by it. ----------
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeNow = () => document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
function syncThemeButton() {
  const dark = themeNow() === 'dark';
  const b = $('#themeBtn');
  b.dataset.mode = dark ? 'dark' : 'light';
  b.setAttribute('aria-label', t(dark ? 'theme.toLight' : 'theme.toDark'));
  b.title = b.getAttribute('aria-label');
  // browser bar colour follows the chosen theme
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (document.documentElement.dataset.theme) m.setAttribute('content', bg);
  });
}
$('#themeBtn').addEventListener('click', () => {
  const next = themeNow() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('pv-theme', next); } catch { /* private mode */ }
  syncThemeButton();
});
darkQuery.addEventListener?.('change', syncThemeButton);

// ---------- start ----------
initLang();
applyLang();
window.addEventListener('resize', () => { layout(); });
new ResizeObserver(() => layout()).observe(stage.parentElement);
requestAnimationFrame(frame);
const byId = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
const startScene = /^#ar=(tile|cabinet)/.test(location.hash) ? byId('kitchen') : /^#ar=/.test(location.hash) ? byId('living') : SCENES[0];
setScene(startScene).then(openFromLink);

// test hook (used by automated checks)
function exportCanvas(scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(state.photo.width * scale); c.height = Math.round(state.photo.height * scale);
  renderScene(c.getContext('2d'), { photo: state.photo, scene: state.scene, prints: state.prints, light: state.light }, scale, { steps: 24 });
  return c;
}
window.__viz = { state, setScene, SCENES, addPrint, setSize, squareUp, redraw, exportCanvas, syncAll, setShape };
