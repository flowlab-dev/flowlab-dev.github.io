import { renderScene, buildTexture } from './render.js';
import { keepLayer } from './keep.js';
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
//
// Simple mode: each room also lists its surfaces. The visitor taps one and the print goes there, already lined up.
//   surfaces: [{ id, name: { en, ru }, types: [products allowed there], fill: true when the print covers the
//     whole surface (a backsplash, doors), so it has no size slider, print: () => ({ same as a print above }) }]
// The first surface is filled when the room opens. Advanced mode uses `prints`, which defaults to that first surface.
const ON_WALL = ['glass', 'backlit', 'metal'];
const WALL_TILE = ['tile', 'glass'];
const S = (id, en, ru, types, fill, print) => ({ id, name: { en, ru }, types, fill, print });
const SCENES = [
  {
    id: 'kitchen', name: { en: 'Backsplash', ru: 'Кухонный фартук' }, src: 'rooms/kitchen-tiles.jpg',
    lightMatch: { colour: 1.45, strength: 0.95 }, // white tiles: the warm under-cabinet light is the light's own colour
    occluders: [rect(180, 464, 213, 514), rect(728, 464, 759, 514), rect(867, 466, 899, 516)],
    // polished granite: wash out the old tiles' reflection, mirror the new print in it
    reflection: { edgeY: 580, alpha: 0.26, blur: 2.5, wash: 7,
      polys: [[P(100, 580), P(238, 580), P(238, 668), P(60, 672)], [P(604, 580), P(955, 580), P(980, 676), P(604, 672)]] },
    surfaces: [
      S('backsplash', 'Backsplash', 'Фартук', WALL_TILE, true, () => ({
        type: 'tile', design: 'moroccan', widthIn: 99, heightIn: 28, tileIn: 6, grout: GROUTS[0],
        corners: rect(112, 340, 950, 580),
        clip: [P(112, 428), P(312, 428), P(312, 340), P(590, 340), P(590, 428), P(950, 428), P(950, 580), P(112, 580)],
      })),
      S('doors', 'Upper doors', 'Верхние дверцы', ['cabinet'], true, () => ({
        type: 'cabinet', design: 'terrazzo', widthIn: 34, heightIn: 24, doors: 2, handle: 'knob', finish: 'matte',
        corners: rect(291, 45, 588, 252), // the two doors above the hood
      })),
    ],
  },
  {
    id: 'kitchen2', name: { en: 'Kitchen, side view', ru: 'Кухня сбоку' }, src: 'rooms/kitchen-angle.jpg',
    occluders: [[P(437, 268), P(462, 266), P(462, 308), P(437, 310)]],
    surfaces: [
      S('wall', 'Wall panel', 'Панель на стене', ON_WALL, false, () => ({
        type: 'glass', design: 'citrus', widthIn: 30, heightIn: 20, layout: 'mural',
        corners: [P(420, 143), P(700, 93), P(700, 414), P(420, 327)],
      })),
    ],
  },
  {
    id: 'living', name: { en: 'Living room', ru: 'Гостиная' }, src: 'rooms/living-room.jpg',
    occluders: [],
    surfaces: [
      S('wall', 'Above the sofa', 'Над диваном', ON_WALL, false, () => ({
        type: 'backlit', design: 'aurora', widthIn: 48, heightIn: 30, glow: 0.8, glowColor: GLOWS[0], lightOn: true,
        corners: rect(229, 18, 795, 372),
      })),
    ],
  },
  {
    id: 'bathroom', name: { en: 'Bathroom', ru: 'Ванная' }, src: 'rooms/bathroom.jpg',
    lightMatch: { colour: 1.2, strength: 0.9 },
    // the tap and the sink rim; the plant is cut out by its colour (keyOccluders), so the leaves stay sharp
    occluders: [rect(418, 388, 536, 452), [P(495, 448), P(585, 440), P(622, 452), P(628, 476), P(495, 476)]],
    keyOccluders: [{ box: [925, 335, 1105, 492], minSat: 0.28 }],
    surfaces: [
      S('wall', 'Tiled wall', 'Стена с плиткой', WALL_TILE, true, () => ({
        type: 'tile', design: 'terrazzo', widthIn: 84, heightIn: 72, tileIn: 12, grout: GROUTS[1],
        corners: [P(497, 22), P(1040, 18), P(1040, 486), P(497, 474)],
        clip: [P(497, 22), P(1040, 18), P(1040, 486), P(497, 474)],
      })),
    ],
  },
  {
    id: 'office', name: { en: 'Office', ru: 'Офис' }, src: 'rooms/office.jpg',
    occluders: [],
    surfaces: [
      S('main', 'Main wall', 'Центр стены', ON_WALL, false, () => ({
        type: 'metal', design: 'coast', widthIn: 72, heightIn: 40, metal: 'aluminium', underbase: false,
        corners: [P(414, 61), P(805, 62), P(802, 282), P(414, 283)], // over the whiteboard, between the wall lamps
      })),
      S('left', 'Wall, left', 'Стена слева', ON_WALL, false, () => ({
        type: 'glass', design: 'botanical', widthIn: 32, heightIn: 24, layout: 'mural',
        corners: rect(130, 95, 345, 255),
      })),
      S('right', 'Wall, right', 'Стена справа', ON_WALL, false, () => ({
        type: 'glass', design: 'citrus', widthIn: 32, heightIn: 24, layout: 'mural',
        corners: rect(870, 95, 1085, 255),
      })),
    ],
  },
  {
    id: 'commercial', name: { en: 'Café wall', ru: 'Стена в кафе' }, src: 'rooms/commercial.jpg',
    lightMatch: { colour: 1.2, strength: 1 }, // dim, warm bar light: the print takes its colour too
    occluders: [],
    surfaces: [
      S('wall', 'Wall, right', 'Стена справа', ON_WALL, false, () => ({
        type: 'glass', design: 'botanical', widthIn: 72, heightIn: 36, layout: 'mural',
        corners: rect(600, 190, 1150, 460),
      })),
      S('frame', 'In place of the frame', 'Вместо рамки', ON_WALL, false, () => ({
        type: 'metal', design: 'coast', widthIn: 30, heightIn: 24, metal: 'brass', underbase: true,
        corners: rect(336, 265, 549, 438), // covers the framed bird print
      })),
    ],
  },
  {
    id: 'kitchen-cabinets', name: { en: 'Kitchen cabinets', ru: 'Кухонные шкафы' }, src: 'rooms/kitchen-cabinets.jpg',
    // the pendant lamp hangs in front of the right-hand doors; in front of the backsplash (traced by hand, dark on
    // dark tile): coffee maker, knife block, jars, bottles, socket, tap, second coffee maker, bowl
    occluders: [[P(838, 96), P(873, 96), P(920, 168), P(918, 186), P(793, 186), P(791, 168)], rect(852, 0, 859, 96),
      rect(321, 371, 359, 434), [P(359, 372), P(386, 372), P(388, 393), P(393, 410), P(393, 434), P(359, 434)],
      rect(392, 415, 408, 434), [P(418, 395), P(427, 395), P(428, 404), P(430, 396), P(437, 396), P(438, 405), P(442, 412), P(442, 434), P(418, 434)],
      rect(624, 380, 637, 402),
      [P(720, 360), P(726, 360), P(727, 393), P(729, 398), P(727, 420), P(740, 420), P(740, 426), P(727, 426), P(727, 434), P(719, 434), P(719, 398)],
      rect(847, 375, 911, 434), [P(828, 413), P(873, 413), P(871, 422), P(866, 434), P(833, 434), P(829, 422)]],
    surfaces: [
      S('right', 'Upper doors, right', 'Верхние дверцы справа', ['cabinet'], true, () => ({
        type: 'cabinet', design: 'terrazzo', widthIn: 64, heightIn: 36, doors: 5, handle: 'none', finish: 'matte',
        corners: rect(590, 148, 930, 339), // the five upper doors right of the microwave
      })),
      S('left', 'Upper doors, left', 'Верхние дверцы слева', ['cabinet'], true, () => ({
        type: 'cabinet', design: 'terrazzo', widthIn: 26, heightIn: 36, doors: 2, handle: 'none', finish: 'matte',
        corners: rect(306, 148, 443, 340),
      })),
      S('backsplash', 'Backsplash', 'Фартук', WALL_TILE, true, () => ({
        type: 'tile', design: 'moroccan', widthIn: 112, heightIn: 17, tileIn: 4, grout: GROUTS[1],
        corners: rect(311, 343, 912, 433),
        clip: [P(311, 343), P(441, 343), P(441, 352), P(590, 352), P(590, 343), P(912, 343), P(912, 433), P(311, 433)],
      })),
    ],
  },
  {
    id: 'glass-block', name: { en: 'Glass block wall', ru: 'Стекло­блоки' }, src: 'rooms/glass-block.jpg',
    lightMatch: { colour: 0, strength: 0.7 },
    surfaceThrough: 0.55, // real wavy glass and reflections show through the ink
    occluders: [],
    surfaces: [
      S('wall', 'Glass block wall', 'Стена из стеклоблоков', ['glassblock'], true, () => ({
        type: 'glassblock', design: 'coast', widthIn: 80, heightIn: 48, blockIn: 8, glassKind: 'frosted', grout: GROUTS[0],
        corners: rect(193, 145, 1002, 625), // 10 × 6 real blocks, on their mortar joints
      })),
    ],
  },
];
for (const s of SCENES) s.prints ||= () => [{ ...s.surfaces[0].print(), surface: s.surfaces[0].id }];

const LIGHT = {
  day: { brightness: 1, warmth: 0 },
  evening: { brightness: 0.78, warmth: 0.45 },
  night: { brightness: 0.38, warmth: 0.1 },
};

const state = {
  scene: null, photo: null, prints: [], sel: -1,
  light: { ...LIGHT.day, preset: 'day' },
  shape: false, // editing the outline points of the selected print
  preview: false, // "Done": corner dots and frame hidden, the room as it will look
  keep: [], // areas of the photo that stay in front of every print (switches, sockets, taps, handles): polygons
  keepMode: false, // marking those areas on the photo
  keepFit: true, // keep only the item inside each box, not the wall around it
  draft: null, // the box being dragged out in keepMode
  mode: 'simple', // 'simple': ready rooms, tap a surface, pick a design · 'advanced': own photo, corners, outline, items
  art: null, // the last design or own artwork picked in simple mode: a newly filled surface gets it too
};
const isSimple = () => state.mode === 'simple';

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
  $('#status').textContent = '';
  state.prints = (scene.prints ? scene.prints() : []).map(withDefaults);
  state.sel = state.prints.length ? 0 : -1;
  state.shape = false;
  state.preview = false;
  if (isSimple() && state.art) state.prints.forEach((p) => giveArt(p, state.art));
  state.keep = []; state.keepMode = false; state.draft = null; keepCache = null; keepDirty = false; keepBoxed = []; keepLiveA = -1;
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
    const scene = viewScene(true);
    renderScene(ctx, { photo: state.photo, scene, prints: state.prints, light: state.light },
      viewScale * dpr, { steps: fast ? 8 : 16 });
    drawOverlay();
  }
  requestAnimationFrame(frame);
}

function redraw() { dirty = true; }
let keepCache = null, keepDirty = false, keepBoxed = [], keepLiveA = -1, keepTimer = 0;
// The scene with the marked items on top. On screen the area being dragged (or moved with the arrow keys) shows
// as its plain outline and is fitted once it is let go; the saved image always uses the fitted cut-outs.
function viewScene(onScreen = false) {
  const live = !onScreen ? -1 : drag?.kind === 'kvtx' ? drag.a : keepLiveA;
  if (keepDirty || live >= 0 || keepCache?.live >= 0) {
    keepDirty = false;
    const r = keepLayer(state.photo, state.keep, state.keepFit, live);
    keepCache = r && { canvas: r.canvas, live };
    const boxed = r ? r.boxed : [];
    if (live < 0 && boxed.join() !== keepBoxed.join()) { keepBoxed = boxed; syncKeep(); }
  }
  return keepCache ? { ...state.scene, keepLayer: keepCache.canvas } : state.scene;
}
function keepChanged() { keepDirty = true; redraw(); }
// arrow keys on a point: show the plain outline while keys are pressed, fit once they stop
function keepNudged(a) {
  keepLiveA = a; clearTimeout(keepTimer);
  keepTimer = setTimeout(() => { keepLiveA = -1; keepChanged(); }, 300);
  redraw();
}

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

// Marked areas (state.keep): each has its points, a "+" on every edge and a × that removes it.
const keepVtx = [], keepMid = [], keepX = [];
let keepRefs = []; // flat index → [area, point]
function drawKeep() {
  const on = state.keepMode && !state.preview;
  const g = $('#outline .keep');
  g.innerHTML = '';
  const polys = on ? [...state.keep, ...(state.draft ? [state.draft] : [])] : [];
  polys.forEach((poly, a) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    el.setAttribute('points', pts(poly));
    if (state.keepFit && keepBoxed.includes(a) && poly !== state.draft) el.setAttribute('class', 'boxed');
    g.append(el);
  });
  keepRefs = on ? state.keep.flatMap((poly, a) => poly.map((_, i) => [a, i])) : [];
  pool(keepVtx, keepRefs.length, 'vtx keepv', 'kv');
  pool(keepMid, keepRefs.length, 'mid keepm', 'km');
  pool(keepX, on ? state.keep.length : 0, 'kx', 'kx');
  keepRefs.forEach(([a, i], k) => {
    const poly = state.keep[a], q = poly[i], r = poly[(i + 1) % poly.length];
    put(keepVtx[k], q);
    put(keepMid[k], P((q.x + r.x) / 2, (q.y + r.y) / 2));
    keepMid[k].hidden = Math.hypot(r.x - q.x, r.y - q.y) * viewScale < 64;
    keepVtx[k].setAttribute('aria-label', t('keep.point', { n: i + 1, a: a + 1 }));
    keepMid[k].setAttribute('aria-label', t('shape.add'));
  });
  if (!on) return;
  state.keep.forEach((poly, a) => {
    // the × sits just above the area's top point, so it never covers a point you need
    const top = poly.reduce((m, q) => (q.y < m.y ? q : m), poly[0]);
    const el = keepX[a];
    el.style.left = `${top.x * viewScale}px`;
    el.style.top = `${Math.max(14, top.y * viewScale - 26)}px`;
    el.setAttribute('aria-label', t('keep.remove', { n: a + 1 }));
    el.textContent = '×';
  });
}

// ---------- simple mode: surfaces ----------
const surfacesNow = () => (isSimple() && state.scene?.surfaces) || [];
const surfaceOf = (p) => (p?.surface && surfacesNow().find((sf) => sf.id === p.surface)) || null;
const quadOf = (sf) => (sf.quad ||= sf.print().corners);
const polyOf = (sf) => (sf.poly ||= (() => { const q = sf.print(); return q.clip || q.corners; })()); // stepped backsplash: its outline
const midOf = (poly) => P(poly.reduce((a, c) => a + c.x, 0) / poly.length, poly.reduce((a, c) => a + c.y, 0) / poly.length);
const printOn = (id) => state.prints.findIndex((p) => p.surface === id);
function inPolyXY(poly, pt) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function surfaceAt(pt) {
  const list = surfacesNow();
  for (let k = list.length - 1; k >= 0; k--) if (inPolyXY(polyOf(list[k]), pt)) return list[k];
  return null;
}
// A design keeps its own look (tile pattern, mural); own artwork on a picture takes the artwork's proportions.
function giveArt(p, art) {
  if (!art) return;
  if (art.myArt) {
    Object.assign(p, { myArt: art.myArt, upload: art.myArt.canvas, uploadKey: art.myArt.key, uploadThumb: art.myArt.thumb, layout: 'mural' });
    if (ON_WALL.includes(p.type)) fitArt(p, art.myArt.canvas);
  } else if (getDesign(art.design)?.tags.includes(p.type)) {
    p.design = art.design; p.upload = null; p.layout = p.type === 'tile' ? 'auto' : 'mural';
  }
}
// A picture takes the artwork's proportions and stays inside the surface it was given: a tall picture gets narrower.
function fitArt(p, art) {
  const r = art.height / art.width;
  let w = p.widthIn, h = Math.round(w * r);
  if (h > p.heightIn) { h = p.heightIn; w = Math.round(h / r); }
  w = Math.max(4, w); h = Math.max(4, h);
  setCorners(p, scaleQuad(p.corners, w / p.widthIn, h / p.heightIn));
  p.widthIn = w; p.heightIn = h; p.sbase = null; p.simpleK = 100;
}
// Tap on a surface: select its print, or put a print there with the design picked last.
function useSurface(id) {
  const sf = surfacesNow().find((x) => x.id === id); if (!sf) return;
  let i = printOn(id);
  if (i < 0) {
    const p = withDefaults({ ...sf.print(), surface: id });
    giveArt(p, state.art);
    state.prints.push(p); i = state.prints.length - 1;
    say(t('surf.placed', { name: localName(sf.name) }));
  }
  state.sel = i; state.preview = false;
  syncAll();
}
const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const spotEls = [];
function drawSpots() {
  const list = state.preview ? [] : surfacesNow();
  // a narrow photo (phones): empty surfaces get a round "+", only the selected print keeps its name on the photo
  const compact = stage.clientWidth < 600;
  while (spotEls.length < list.length) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'spot';
    b.addEventListener('click', () => useSurface(b.dataset.s));
    $('#spots').append(b); spotEls.push(b);
  }
  spotEls.forEach((b, k) => { b.hidden = k >= list.length; });
  const g = $('#outline .spots');
  g.innerHTML = '';
  list.forEach((sf, k) => {
    const q = quadOf(sf), i = printOn(sf.id), b = spotEls[k], name = localName(sf.name);
    const key = `${sf.id}|${i}|${i === state.sel}|${name}|${compact}`;
    b.hidden = compact && i >= 0 && i !== state.sel;
    if (b.dataset.key !== key) {
      b.dataset.key = key; b.dataset.s = sf.id;
      b.classList.toggle('empty', i < 0);
      b.classList.toggle('round', compact && i < 0);
      b.setAttribute('aria-pressed', String(i >= 0 && i === state.sel));
      b.setAttribute('aria-label', t(i < 0 ? 'surf.place' : 'surf.pick', { name }));
      b.innerHTML = i < 0 ? PLUS : '';
      if (!(compact && i < 0)) b.append(Object.assign(document.createElement('span'), { textContent: name }));
    }
    // empty: label in the middle of a dashed box · filled: a small label near the top edge, the print stays visible
    if (i < 0) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      el.setAttribute('points', pts(polyOf(sf))); g.append(el);
      put(b, midOf(polyOf(sf)));
    } else if (compact) {
      // phones: the name sits just outside the print (below, or above when there is no room), so it never covers it
      const H = stage.clientHeight / viewScale, gap = 26 / viewScale;
      const bottom = Math.max(q[2].y, q[3].y), top = Math.min(q[0].y, q[1].y), x = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
      put(b, P(x, bottom + gap < H - 4 / viewScale ? bottom + gap : top - gap > 4 / viewScale ? top - gap : bottom - gap));
    } else {
      const top = P((q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2), c = centroid(q);
      const d = Math.hypot(c.x - top.x, c.y - top.y) * viewScale, k2 = d > 0 ? Math.min(1, 30 / d) : 0;
      put(b, P(top.x + (c.x - top.x) * k2, top.y + (c.y - top.y) * k2));
    }
  });
}

function drawOverlay() {
  drawKeep();
  drawSpots();
  const p = isSimple() ? null : state.prints[state.sel];
  const keeping = state.keepMode && !state.preview;
  const shaping = !!p && state.shape && !!p.clip && !state.preview;
  const n = shaping ? p.clip.length : 0;
  const done = $('#btnDone');
  done.hidden = !state.prints.length && !state.keepMode;
  done.classList.toggle('on', state.preview);
  done.querySelector('span').textContent = t(state.preview ? 'stage.edit' : 'stage.done');
  handles.forEach((h) => { h.hidden = !p || shaping || keeping || state.preview; });
  pool(vtxEls, n, 'vtx', 'v');
  pool(midEls, n, 'mid', 'm');
  $('#outline .frame').setAttribute('points', p && !state.preview ? pts(p.corners) : '');
  $('#outline .cut').setAttribute('points', shaping ? pts(p.clip) : '');
  stage.classList.toggle('shaping', shaping || keeping);
  const hint = $('#hint'), key = state.preview ? 'stage.hintPreview' : keeping ? 'stage.hintKeep' : shaping ? 'stage.hintShape'
    : isSimple() ? 'stage.hintSimple' : 'stage.hint';
  if (hint.dataset.i18n !== key) { hint.dataset.i18n = key; hint.textContent = t(key); }
  placeDone(done, state.preview ? [] : [...(p ? p.corners : []), ...(shaping ? p.clip : []), ...(keeping ? state.keep.flat() : []),
    ...surfacesNow().map((sf) => midOf(polyOf(sf)))]);
  if (!p || state.preview) return;
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

// The Done button sits in a corner of the photo that no handle is near, so it never covers a point you need.
function placeDone(btn, points) {
  if (btn.hidden) return;
  const W = stage.clientWidth, H = stage.clientHeight, bw = btn.offsetWidth, bh = btn.offsetHeight, m = 10, pad = 24;
  const cx = (W - bw) / 2;
  const spots = { tr: [W - m - bw, m], tl: [m, m], br: [W - m - bw, H - m - bh], bl: [m, H - m - bh],
    tc: [cx, m], bc: [cx, H - m - bh], ml: [m, (H - bh) / 2], mr: [W - m - bw, (H - bh) / 2] };
  const free = (x, y) => points.every((c) => {
    const px = c.x * viewScale, py = c.y * viewScale;
    return px < x - pad || px > x + bw + pad || py < y - pad || py > y + bh + pad;
  });
  const pos = Object.keys(spots).find((k) => free(...spots[k])) || 'tr';
  if (btn.dataset.pos !== pos) btn.dataset.pos = pos;
}

// Move the corners and carry the outline with them: the outline keeps its place on the print.
function setCorners(p, next, from = p.corners, clipFrom = p.clip) {
  if (clipFrom) {
    const toUV = invertH(squareToQuad(from)), H = squareToQuad(next);
    p.clip = clipFrom.map((q) => { const { u, v } = toUV(q.x, q.y); return applyH(H, u, v); });
  }
  p.corners = next;
}

// The outline may reach past the print's edge (a wider backsplash, a taller part at the stove):
// grow the print in its own perspective so it fills the whole outline, and keep the size in inches true.
// It grows from the size it had before, so pulling the outline back in shrinks it again.
const MAX_W = 240, MAX_H = 120; // the largest print the size fields allow
const sameQuad = (a, b) => a.every((c, i) => Math.abs(c.x - b[i].x) < 1e-6 && Math.abs(c.y - b[i].y) < 1e-6);
function ungrow(p) {
  if (!p.grow) return;
  if (sameQuad(p.grow.at, p.corners)) Object.assign(p, { ...p.grow.base, corners: p.grow.base.corners.map((c) => ({ ...c })) });
  p.grow = null;
}
function growToClip(p) {
  if (!p?.clip) return;
  if (p.grow && !sameQuad(p.grow.at, p.corners)) p.grow = null; // moved or resized since: start from here
  const base = p.grow ? p.grow.base : { corners: p.corners.map((c) => ({ ...c })), widthIn: p.widthIn, heightIn: p.heightIn, doors: p.doors };
  const H = squareToQuad(base.corners), toUV = invertH(H);
  const uv = p.clip.map((q) => toUV(q.x, q.y));
  let capped = uv.some((a) => !Number.isFinite(a.u) || !Number.isFinite(a.v));
  const ok = uv.filter((a) => Number.isFinite(a.u) && Number.isFinite(a.v));
  const span = (vals, max) => {
    let a = Math.max(0, -Math.min(...vals)), b = Math.max(0, Math.max(...vals) - 1);
    const room = Math.max(0, max - 1);
    if (a + b > room) { const k = room / (a + b); a *= k; b *= k; capped = true; }
    return [-a, 1 + b];
  };
  const [u0, u1] = span(ok.map((a) => a.u), MAX_W / base.widthIn);
  const [v0, v1] = span(ok.map((a) => a.v), MAX_H / base.heightIn);
  if (u1 - u0 < 1.005 && v1 - v0 < 1.005) { ungrow(p); return; }
  const next = [applyH(H, u0, v0), applyH(H, u1, v0), applyH(H, u1, v1), applyH(H, u0, v1)];
  if (!isConvex(next)) { say(t('shape.cantGrow')); return; }
  p.corners = next; // the outline stays exactly where it was drawn
  p.widthIn = Math.round(base.widthIn * (u1 - u0));
  p.heightIn = Math.round(base.heightIn * (v1 - v0));
  if (p.type === 'cabinet') p.doors = clamp(Math.round(base.doors * (u1 - u0)), 1, 6);
  if (p.type === 'glassblock') snapBlocks(p);
  p.grow = { base, at: p.corners.map((c) => ({ ...c })) };
  if (capped) say(t('shape.max'));
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
  if (state.shape) { ensureClip(p); state.preview = false; state.keepMode = false; syncKeep(); }
  syncControls(); redraw();
}

// ---------- things in front of the print ----------
function setKeepMode(on) {
  state.keepMode = !!on;
  if (state.keepMode) { state.shape = false; state.preview = false; syncControls(); }
  state.draft = null;
  syncKeep(); redraw();
}
function syncKeep() {
  const n = state.keep.length;
  $('#btnKeep').setAttribute('aria-pressed', String(state.keepMode));
  $('#btnKeep').textContent = t(state.keepMode ? 'keep.stop' : 'keep.start');
  $('#btnKeepUndo').hidden = !n;
  $('#btnKeepClear').hidden = !n;
  $('#keepCount').textContent = n ? plural('keep.count', n) : '';
  const boxed = state.keepFit ? keepBoxed.filter((a) => a < n).length : 0;
  $('#keepBoxed').hidden = !boxed;
  $('#keepFit').checked = state.keepFit;
}
function removeKeep(a) {
  state.keep.splice(a, 1);
  syncKeep(); keepChanged();
}
function removeKeepPoint(a, i) {
  const poly = state.keep[a];
  if (poly.length <= 3) { removeKeep(a); return; }
  poly.splice(i, 1);
  keepChanged();
}
const boxFrom = (a, b) => rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y));
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
  if (e.target.closest('#btnDone, .spot')) return;
  if (isSimple()) { tap = { x: e.clientX, y: e.clientY, id: e.pointerId }; return; } // picked on pointerup
  const h = e.target.closest('.handle, .kx');
  const pt = toImage(e);
  const W = state.photo?.width || 0, H = state.photo?.height || 0;
  if (h && h.dataset.kx != null) { removeKeep(+h.dataset.kx); e.preventDefault(); return; }
  if (h && h.dataset.km != null) {
    const [a, i] = keepRefs[+h.dataset.km], poly = state.keep[a], q = poly[i], r = poly[(i + 1) % poly.length];
    poly.splice(i + 1, 0, P((q.x + r.x) / 2, (q.y + r.y) / 2));
    drawOverlay();
    const k = keepRefs.findIndex(([b, j]) => b === a && j === i + 1);
    drag = { kind: 'kvtx', a, i: i + 1, el: keepVtx[k] };
    drag.el.classList.add('drag');
  } else if (h && h.dataset.kv != null) {
    const [a, i] = keepRefs[+h.dataset.kv], now = performance.now(), id = `k${a}:${i}`;
    if (lastTap.i === id && now - lastTap.t < 400) { lastTap = { i: -1, t: 0 }; removeKeepPoint(a, i); e.preventDefault(); return; }
    lastTap = { i: id, t: now };
    drag = { kind: 'kvtx', a, i, el: h };
    h.classList.add('drag');
  } else if (state.keepMode && !state.preview) {
    // drag out a box around a switch, a tap, a handle…
    const start = P(clamp(pt.x, 0, W), clamp(pt.y, 0, H));
    drag = { kind: 'box', start };
    state.draft = boxFrom(start, start);
  } else if (h && h.dataset.m != null) {
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
    if (state.preview) { state.preview = false; redraw(); }
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
    stage.style.cursor = isSimple() ? (surfaceAt(pt) ? 'pointer' : 'default')
      : state.keepMode && !state.preview ? 'crosshair' : state.prints.some((p) => pointInQuad(p.corners, pt)) ? 'move' : 'default';
    return;
  }
  const p = state.prints[state.sel];
  const pt = toImage(e);
  const W = state.photo.width, H = state.photo.height;
  if (drag.kind === 'box') {
    state.draft = boxFrom(drag.start, P(clamp(pt.x, 0, W), clamp(pt.y, 0, H)));
  } else if (drag.kind === 'kvtx') {
    state.keep[drag.a][drag.i] = P(clamp(pt.x, 0, W), clamp(pt.y, 0, H));
  } else if (drag.kind === 'vtx') {
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
  if (drag.kind === 'box') {
    const b = state.draft; state.draft = null;
    const w = b ? (b[1].x - b[0].x) * viewScale : 0, h = b ? (b[2].y - b[1].y) * viewScale : 0;
    if (w >= 8 && h >= 8) { state.keep.push(b); syncKeep(); } else if (b) say(t('keep.tooSmall'));
  }
  if (drag.kind === 'box' || drag.kind === 'kvtx') keepDirty = true;
  const grew = drag.kind === 'vtx';
  drag = null; fast = false;
  if (grew) { growToClip(sel()); syncAll(); }
  redraw();
}
stage.addEventListener('pointerup', endDrag);
// simple mode: a tap picks the surface under it; a swipe (moved more than 10 px) only scrolls the page
let tap = null;
stage.addEventListener('pointerup', (e) => {
  const t0 = tap; tap = null;
  if (!t0 || t0.id !== e.pointerId || !isSimple() || !state.photo) return;
  if (Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 10) return;
  const sf = surfaceAt(toImage(e));
  if (sf) useSurface(sf.id);
});
stage.addEventListener('pointercancel', () => { tap = null; });
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
  if (state.preview && document.activeElement === stage && (map[e.key] || e.key === 'Delete' || e.key === 'Backspace')) {
    // "Done" hides the frame: the first key brings it back instead of moving or deleting a print you can't see
    state.preview = false; redraw(); e.preventDefault(); return;
  }
  // simple mode: nothing is moved or deleted from the photo itself (the panel has "Remove the print")
  if (isSimple() && document.activeElement === stage && (map[e.key] || e.key === 'Delete' || e.key === 'Backspace')) return;
  const h = document.activeElement?.closest?.('.handle');
  const kv = h?.dataset.kv != null ? keepRefs[+h.dataset.kv] : null;
  if (kv && (map[e.key] || e.key === 'Delete' || e.key === 'Backspace')) {
    if (map[e.key]) {
      const k = (e.shiftKey ? 10 : 2) / Math.max(0.3, viewScale), q = state.keep[kv[0]][kv[1]];
      q.x = clamp(q.x + map[e.key][0] * k, 0, state.photo.width); q.y = clamp(q.y + map[e.key][1] * k, 0, state.photo.height);
      keepNudged(kv[0]);
    } else removeKeepPoint(kv[0], kv[1]);
    e.preventDefault(); return;
  }
  if (h?.dataset.kx != null && (e.key === 'Enter' || e.key === ' ')) {
    removeKeep(+h.dataset.kx); $('#btnKeep').focus(); e.preventDefault(); return;
  }
  if (state.keepMode && document.activeElement === stage && (e.key === 'Enter' || e.key === ' ')) {
    // keyboard: a box in the middle of the photo; its points then move with the arrow keys
    const W = state.photo.width, H = state.photo.height, s = Math.min(W, H) * 0.08;
    state.keep.push(rect(W / 2 - s, H / 2 - s, W / 2 + s, H / 2 + s)); syncKeep(); keepChanged();
    say(plural('keep.count', state.keep.length)); e.preventDefault(); return;
  }
  if (h?.dataset.km != null && (e.key === 'Enter' || e.key === ' ')) {
    const [a, i] = keepRefs[+h.dataset.km], poly = state.keep[a], q = poly[i], r = poly[(i + 1) % poly.length];
    poly.splice(i + 1, 0, P((q.x + r.x) / 2, (q.y + r.y) / 2)); keepChanged(); e.preventDefault(); return;
  }
  const v = h?.dataset.v != null ? +h.dataset.v : null;
  if (v != null && sel()?.clip && map[e.key]) {
    const k = (e.shiftKey ? 10 : 2) / Math.max(0.3, viewScale), q = sel().clip[v];
    q.x = clamp(q.x + map[e.key][0] * k, 0, state.photo.width); q.y = clamp(q.y + map[e.key][1] * k, 0, state.photo.height);
    growToClip(sel()); syncAll(); e.preventDefault();
  } else if (v != null && (e.key === 'Delete' || e.key === 'Backspace')) {
    removePoint(v); e.preventDefault();
  } else if (h?.dataset.m != null && (e.key === 'Enter' || e.key === ' ')) {
    const p = sel(), i = +h.dataset.m, a = p.clip[i], b = p.clip[(i + 1) % p.clip.length];
    p.clip.splice(i + 1, 0, P((a.x + b.x) / 2, (a.y + b.y) / 2)); redraw(); e.preventDefault();
  } else if (map[e.key] && (h ? h.dataset.i != null : document.activeElement === stage)) {
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
  state.preview = false;
  syncAll();
}

function removeSelected() {
  if (state.sel < 0) return;
  state.prints.splice(state.sel, 1);
  state.sel = Math.min(state.sel, state.prints.length - 1);
  if (state.sel < 0) state.shape = false;
  syncAll();
  if (!state.prints.length) $('#btnEmptyAdd').focus();
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
  p.sbase = null;
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
  const list = customRoom && !isSimple() ? [...SCENES, customRoom.scene] : SCENES;
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
    b.addEventListener('click', () => { state.sel = i; state.preview = false; syncAll(); });
    box.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'chip add';
  add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="lbl">${t('chip.add')}</span>`;
  add.setAttribute('aria-label', t('chip.add'));
  add.addEventListener('click', addPrint);
  box.append(add);
}

function syncDesigns() {
  const p = sel();
  const box = $('#designs');
  box.innerHTML = '';
  if (!p) return;
  const list = listDesigns(p.type);
  if (p.myArt) {
    // the visitor's own artwork stays a choice next to the designs until they remove it with ×
    const w = document.createElement('div'); w.className = 'design-own';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'design'; b.setAttribute('aria-pressed', !!p.upload);
    b.innerHTML = `<img src="${p.myArt.thumb}" alt=""><span>${t('design.yours')}</span>`;
    b.addEventListener('click', () => {
      Object.assign(p, { upload: p.myArt.canvas, uploadKey: p.myArt.key, uploadThumb: p.myArt.thumb, layout: 'mural' });
      state.art = { myArt: p.myArt };
      syncAll();
    });
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'design-x';
    x.setAttribute('aria-label', t('design.removeYours')); x.title = t('design.removeYours');
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
    x.addEventListener('click', () => {
      // only the picture goes: the print, its size, place and product stay, back on the last design
      if (state.art?.myArt === p.myArt) state.art = { design: p.design };
      p.myArt = null; p.upload = null; p.uploadThumb = null;
      p.layout = p.type === 'tile' ? 'auto' : 'mural';
      syncAll();
      $('#designs .design')?.focus();
      say(t('design.removed'));
    });
    w.append(b, x);
    box.append(w);
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
      state.art = { design: d.id };
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
  const sf = surfaceOf(p);
  $('#types').querySelectorAll('[data-type]').forEach((b) => { b.hidden = !!sf && !sf.types.includes(b.dataset.type); });
  const only = !!sf && sf.types.length === 1;
  $('#types').hidden = only;
  $('#typeOnly').hidden = !only;
  $('#typeOnly').textContent = only ? productName(p.type) : '';
  $('#simpleSizeRow').hidden = !sf || sf.fill;
  $('#simpleSize').value = p.simpleK || 100;
  $('#simpleSizeOut').textContent = t(sf?.fill ? 'surf.fills' : 'surf.size', { w: p.widthIn, h: p.heightIn, unit: t('unit.in') });
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
    const sf = surfaceOf(p);
    return { i, p, title: `${sf ? `${localName(sf.name)}: ` : ''}${productName(p.type)} · ${designName(p)}`,
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

function syncSurfaces() {
  const box = $('#surfs');
  box.innerHTML = '';
  surfacesNow().forEach((sf) => {
    const i = printOn(sf.id), b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', String(i >= 0 && i === state.sel));
    b.innerHTML = i < 0 ? PLUS : `<img src="${designThumb(state.prints[i])}" alt="">`;
    b.append(Object.assign(document.createElement('span'), { textContent: localName(sf.name) }));
    b.addEventListener('click', () => useSurface(sf.id));
    box.append(b);
  });
  $('#btnSurfRemove').hidden = !surfaceOf(sel());
}

function syncAll() {
  syncRooms(); syncLayers(); syncSurfaces(); syncDesigns(); syncControls(); syncLight(); syncSummary(); syncKeep(); redraw();
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
  ungrow(p);
  p.clip = state.shape ? p.corners.map((c) => ({ ...c })) : undefined;
  syncLayers(); syncSummary();
  syncControls(); redraw();
});
$('#btnKeep').addEventListener('click', () => setKeepMode(!state.keepMode));
$('#btnKeepUndo').addEventListener('click', () => { state.keep.pop(); syncKeep(); keepChanged(); });
$('#btnKeepClear').addEventListener('click', () => { state.keep = []; syncKeep(); keepChanged(); });
$('#keepFit').addEventListener('change', (e) => { state.keepFit = e.target.checked; syncKeep(); keepChanged(); });
$('#btnSquare').addEventListener('click', squareUp);
$('#btnDelete').addEventListener('click', removeSelected);
$('#btnEmptyAdd').addEventListener('click', addPrint);
$('#btnDone').addEventListener('click', () => {
  state.preview = !state.preview;
  if (state.preview) { state.shape = false; state.keepMode = false; state.draft = null; syncKeep(); }
  syncControls(); redraw();
});

// one size slider in simple mode: the picture grows or shrinks around its centre, inches follow
$('#simpleSize').addEventListener('input', (e) => {
  const p = sel(); if (!p) return;
  p.sbase ||= { ...snapshot(p), widthIn: p.widthIn, heightIn: p.heightIn, k: (p.simpleK || 100) / 100 };
  const r = (e.target.value / 100) / p.sbase.k;
  setCorners(p, scaleQuad(p.sbase.corners, r, r), p.sbase.corners, p.sbase.clip);
  p.widthIn = Math.round(p.sbase.widthIn * r); p.heightIn = Math.round(p.sbase.heightIn * r);
  p.simpleK = +e.target.value;
  $('#simpleSizeOut').textContent = t('surf.size', { w: p.widthIn, h: p.heightIn, unit: t('unit.in') });
  fast = true; syncSummary(); redraw();
});
$('#simpleSize').addEventListener('change', () => { fast = false; syncSurfaces(); redraw(); });
$('#btnSurfRemove').addEventListener('click', () => {
  const sf = surfaceOf(sel()); if (!sf) return;
  removeSelected();
  say(t('surf.removed', { name: localName(sf.name) }));
  $('#surfs .chip')?.focus();
});

function setMode(m, save = true) {
  state.mode = m === 'advanced' ? 'advanced' : 'simple';
  document.documentElement.dataset.mode = state.mode;
  stage.dataset.i18nAria = isSimple() ? 'stage.ariaSimple' : 'stage.aria';
  stage.setAttribute('aria-label', t(stage.dataset.i18nAria));
  pressed($('#modeSwitch'), 'data-mode', state.mode);
  if (save) try { localStorage.setItem('pv-mode', state.mode); } catch { /* private mode */ }
}
$('#modeSwitch').addEventListener('click', (e) => {
  const m = e.target.closest('[data-mode]')?.dataset.mode;
  if (!m || m === state.mode) return;
  setMode(m);
  state.shape = false; state.keepMode = false; state.preview = false; state.draft = null;
  // advanced keeps the prints as they are, ready to edit. Back in simple: prints on the room's surfaces stay
  // (one per surface), prints added by hand go; your own photo stays in advanced, simple opens the first room.
  if (!isSimple()) { syncAll(); return; }
  if (!state.scene?.surfaces) { setScene(SCENES[0]); say(t('mode.ownPhoto')); return; }
  const kept = state.prints.filter((p, i) => p.surface && state.prints.findIndex((q) => q.surface === p.surface) === i);
  if (!kept.length) { setScene(state.scene); return; }
  const cur = sel();
  state.prints = kept;
  state.sel = Math.max(0, kept.indexOf(cur));
  syncAll();
});

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
    lightMatch: { soft: true, strength: 1 }, // unknown wall under the print: take only the room's broad light
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
  p.myArt = { canvas: art, key: p.uploadKey, thumb: p.uploadThumb };
  state.art = { myArt: p.myArt };
  // A picture on glass or metal takes the artwork's proportions (keeping the width). A backsplash, doors
  // or a glass block wall keep the area marked on the wall: the artwork fills it, cropped at the edges.
  const sf = surfaceOf(p);
  if (sf && ON_WALL.includes(p.type)) {
    // simple mode: start again from the surface's own size, then fit the artwork inside it
    const base = sf.print();
    setCorners(p, base.corners.map((c) => ({ ...c })));
    p.widthIn = base.widthIn; p.heightIn = base.heightIn;
    fitArt(p, art);
  } else if (p.type === 'glass' || p.type === 'backlit' || p.type === 'metal') {
    const ratio = art.height / art.width;
    setSize(p.widthIn, Math.max(4, Math.round(p.widthIn * ratio)));
  }
  e.target.value = '';
  syncAll();
});

// ---------- save image ----------
$('#btnSave').addEventListener('click', () => {
  if (!state.photo) return;
  const scale = Math.min(2, 2048 / state.photo.width);
  const c = document.createElement('canvas');
  c.width = Math.round(state.photo.width * scale); c.height = Math.round(state.photo.height * scale);
  renderScene(c.getContext('2d'), { photo: state.photo, scene: viewScene(), prints: state.prints, light: state.light }, scale, { steps: 24 });
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
    // Android: WebXR in Chrome. Scene Viewer is left out on purpose: it opens the model in a separate app, which
    // can't read a model made in the page (blob: address), and this one is built live from the visitor's choices.
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
setMode(/^#ar=/.test(location.hash) ? 'advanced' : document.documentElement.dataset.mode, false);
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
  renderScene(c.getContext('2d'), { photo: state.photo, scene: viewScene(), prints: state.prints, light: state.light }, scale, { steps: 24 });
  return c;
}
window.__viz = { state, keepChanged, viewScene, setScene, SCENES, addPrint, setSize, squareUp, redraw, exportCanvas, syncAll, setShape, useSurface, setMode };
