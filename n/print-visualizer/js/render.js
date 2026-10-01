// Scene renderer: room photo + printed products + room lighting, all in image pixel space.
import { drawQuad, quadPath, squareToQuad, applyH, releaseTexture } from './warp.js';
import { renderDesign, getDesign } from './art.js';
import { applyMetal, drawDoors, drawGlassBlocks, METAL_SIZE } from './surfaces.js';

const texCache = new Map();

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

function sourceOf(print) {
  return print.upload ? print.upload : renderDesign(print.design);
}

function isRepeat(print) {
  if (print.type === 'cabinet' || print.type === 'metal') return false; // one image across the whole piece
  if (print.layout === 'repeat') return true;
  if (print.layout === 'mural') return false;
  return !print.upload && !!getDesign(print.design)?.repeat;
}

// The flat artwork as it would come off the printer, in the print's real proportions.
export function buildTexture(print) {
  const key = [print.upload ? print.uploadKey : print.design, print.type, print.widthIn, print.heightIn,
    print.tileIn, print.grout, print.layout,
    print.type === 'cabinet' ? [print.doors, print.doorGapIn, print.handle].join(',') : '',
    print.type === 'metal' ? [print.metal, print.underbase].join(',') : '',
    print.type === 'glassblock' ? [print.blockIn, print.glassKind].join(',') : ''].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const longSide = print.type === 'tile' || print.type === 'cabinet' || print.type === 'glassblock' ? 2048 : print.type === 'metal' ? METAL_SIZE : 1400;
  const aspect = print.widthIn / print.heightIn;
  const W = aspect >= 1 ? longSide : longSide * aspect;
  const H = aspect >= 1 ? longSide / aspect : longSide;
  const c = mk(W, H);
  const ctx = c.getContext('2d');
  const src = sourceOf(print);
  const ppi = c.width / print.widthIn;
  const tilePx = print.type === 'tile' && print.tileIn > 0 ? print.tileIn * ppi : 0;
  if (print.type === 'tile' || print.type === 'cabinet' || (print.upload && print.type !== 'metal')) {
    // tile and doors are white under the ink, glass is printed with a white backing layer: a transparent
    // PNG must not let the old wall through (on metal the clear areas stay bare metal, as when printed)
    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, c.width, c.height);
  }

  if (isRepeat(print)) {
    const cell = tilePx || (print.type === 'glassblock' ? (print.blockIn || 8) * ppi : 8 * ppi); // one motif per tile (or per 8" when printed as one sheet)
    for (let y = 0; y < c.height; y += cell) for (let x = 0; x < c.width; x += cell) ctx.drawImage(src, x, y, cell, cell);
  } else {
    const s = Math.max(c.width / src.width, c.height / src.height);
    ctx.drawImage(src, (c.width - src.width * s) / 2, (c.height - src.height * s) / 2, src.width * s, src.height * s);
  }

  if (tilePx) {
    const gw = Math.max(1.5, 0.125 * ppi);
    for (let y = 0; y < c.height; y += tilePx) {
      for (let x = 0; x < c.width; x += tilePx) {
        // soft bevel: light from the top-left, shade bottom-right
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x, y, tilePx, gw * 0.9); ctx.fillRect(x, y, gw * 0.9, tilePx);
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(x, y + tilePx - gw * 1.6, tilePx, gw * 0.9); ctx.fillRect(x + tilePx - gw * 1.6, y, gw * 0.9, tilePx);
      }
    }
    ctx.fillStyle = print.grout || '#d9d4cc';
    for (let x = 0; x <= c.width + 1; x += tilePx) ctx.fillRect(x - gw / 2, 0, gw, c.height);
    for (let y = 0; y <= c.height + 1; y += tilePx) ctx.fillRect(0, y - gw / 2, c.width, gw);
  }
  if (print.type === 'cabinet') drawDoors(ctx, c.width, c.height, ppi, print);
  if (print.type === 'metal') c.sheen = applyMetal(c, print.metal, print.underbase);
  if (print.type === 'glassblock') drawGlassBlocks(c, ppi, print);
  if (texCache.size > 8) {
    const k = texCache.keys().next().value;
    const old = texCache.get(k); releaseTexture(old); old.width = old.height = 0; // free memory right away (iOS canvas limit)
    if (old.sheen) old.sheen.width = old.sheen.height = 0;
    texCache.delete(k);
  }
  texCache.set(key, c);
  return c;
}

// Blurred, desaturated copy of the photo: used to let each print pick up the room's own light falloff.
const shadeCache = new WeakMap();
// colour: how much of the light's colour to keep (0 = brightness only). Only neutral walls (white tiles)
// show the light's real colour; on a painted wall the photo's colour is the paint, not the light.
function shadeMap(photo, colour = 0) {
  const byPhoto = shadeCache.get(photo) || new Map();
  shadeCache.set(photo, byPhoto);
  if (byPhoto.has(colour)) return byPhoto.get(colour);
  // Colour light map of the room: blurred photo scaled so its brightest area (95th percentile) is white.
  // Multiplying a print by it keeps the room's light falloff and colour (warm under-cabinet lights, dim corners).
  const small = mk(photo.width / 4, photo.height / 4);
  const s = small.getContext('2d');
  s.filter = 'blur(6px)';
  s.drawImage(photo, 0, 0, small.width, small.height);
  const d = s.getImageData(0, 0, small.width, small.height);
  const lums = new Float32Array(d.data.length / 4);
  for (let i = 0, k = 0; i < d.data.length; i += 4, k++) lums[k] = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
  const sorted = Float32Array.from(lums).sort();
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 200;
  const gain = 250 / Math.max(60, p95);
  for (let i = 0; i < d.data.length; i += 4) {
    // keep a floor so shadows stay readable, and soften the colour cast a little
    const l = Math.min(255, lums[i / 4] * gain);
    for (let c = 0; c < 3; c++) {
      // boost the light's colour (blurring the photo greys it out), then add contrast so the falloff reads
      const v = Math.max(0, Math.min(255, l + (d.data[i + c] * gain - l) * colour));
      d.data[i + c] = Math.min(255, 22 + 233 * Math.pow(v / 255, 1.3));
    }
  }
  s.putImageData(d, 0, 0);
  byPhoto.set(colour, small);
  return small;
}

// The visitor's own photo: we don't know what is on the wall under the print (a dark backsplash, cabinets,
// a fridge), so the full shade map would print those shapes into the artwork. Keep only the room's broad
// light falloff (a window on one side, a dim corner): average the photo down to a few cells, then soften
// the range so the darkest part of the room dims the print by at most a third.
function softShadeMap(photo) {
  const byPhoto = shadeCache.get(photo) || new Map();
  shadeCache.set(photo, byPhoto);
  if (byPhoto.has('soft')) return byPhoto.get('soft');
  const k = 8 / Math.max(photo.width, photo.height);
  const mid = mk(photo.width * k * 8, photo.height * k * 8);
  const m = mid.getContext('2d'); m.imageSmoothingQuality = 'high';
  m.drawImage(photo, 0, 0, mid.width, mid.height);
  const tiny = mk(photo.width * k, photo.height * k);
  const t = tiny.getContext('2d'); t.imageSmoothingQuality = 'high';
  t.drawImage(mid, 0, 0, tiny.width, tiny.height);
  const d = t.getImageData(0, 0, tiny.width, tiny.height);
  const lums = [];
  for (let i = 0; i < d.data.length; i += 4) lums.push(0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]);
  const top = Math.max(40, [...lums].sort((a, b) => a - b)[Math.floor(lums.length * 0.9)]);
  lums.forEach((l, j) => {
    const v = Math.round(255 * (1 - 0.32 * (1 - Math.min(1, l / top))));
    d.data[j * 4] = d.data[j * 4 + 1] = d.data[j * 4 + 2] = v; d.data[j * 4 + 3] = 255;
  });
  t.putImageData(d, 0, 0);
  const out = mk(photo.width / 4, photo.height / 4);
  const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  o.filter = `blur(${Math.round(out.width / 16)}px)`;
  o.drawImage(tiny, -1, -1, out.width + 2, out.height + 2);
  mid.width = mid.height = tiny.width = tiny.height = 0;
  byPhoto.set('soft', out);
  return out;
}

function lightColor(light) {
  const b = light.brightness;
  const w = light.warmth; // -1 cool .. +1 warm
  const r = 1 + Math.max(0, -w) * -0.12;
  const g = 1 - Math.abs(w) * 0.06;
  const bl = 1 - Math.max(0, w) * 0.22;
  const f = (v) => Math.round(Math.min(255, 255 * b * v));
  return `rgb(${f(r)},${f(g)},${f(bl)})`;
}

function polyPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function withClip(ctx, print, fn) {
  ctx.save();
  if (print.clip && print.clipOn !== false) { polyPath(ctx, print.clip); ctx.clip(); }
  fn();
  ctx.restore();
}

function quadSize(p) {
  return Math.max(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y));
}

function drawPrintBody(ctx, print, photo, opts) {
  const q = print.corners;
  const tex = buildTexture(print);
  withClip(ctx, print, () => {
    const lift = { glass: [0.018, 0.38], metal: [0.007, 0.32], cabinet: [0.005, 0.26] }[print.type];
    if (lift) {
      // printed glass sits on stand-off pins, metal and doors closer to the wall: soft shadow behind
      const off = quadSize(q) * lift[0];
      ctx.save();
      ctx.filter = `blur(${Math.max(2, off * 0.9)}px)`;
      ctx.fillStyle = `rgba(0,0,0,${lift[1] * opts.shadowScale})`;
      quadPath(ctx, q.map((p) => ({ x: p.x + off * 0.6, y: p.y + off })));
      ctx.fill();
      ctx.restore();
    }
    drawQuad(ctx, tex, q, opts.steps);
    if (print.type !== 'backlit' || !print.lightOn) {
      ctx.save();
      quadPath(ctx, q); ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      const lm = opts.lightMatch;
      ctx.globalAlpha = lm?.strength ?? 0.8;
      ctx.drawImage(lm?.soft ? softShadeMap(photo) : shadeMap(photo, lm?.colour ?? 0), 0, 0, photo.width, photo.height);
      ctx.restore();
    }
    if (opts.through) {
      // the surface itself shows through the ink (ribbed glass of real glass blocks)
      ctx.save();
      quadPath(ctx, q); ctx.clip();
      ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = opts.through;
      ctx.drawImage(photo, 0, 0);
      ctx.restore();
    }
    if (print.type === 'metal') drawMetalSheen(ctx, print, tex, photo, opts);
    const finishable = print.type === 'tile' || print.type === 'cabinet';
    if (finishable ? print.finish === 'gloss' : print.type !== 'metal') {
      const H = squareToQuad(q);
      const a = applyH(H, 0.1, 0), b = applyH(H, 0.9, 1);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.42, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${print.type === 'tile' ? 0.10 : print.type === 'cabinet' ? 0.13 : 0.16})`);
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      ctx.save();
      quadPath(ctx, q); ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g; ctx.fillRect(0, 0, photo.width, photo.height);
      ctx.restore();
    }
    if (print.type !== 'tile' && print.type !== 'cabinet' && print.type !== 'glassblock') {
      // polished glass edge, or the bright cut edge of a thin metal sheet
      ctx.save();
      quadPath(ctx, q);
      ctx.lineWidth = print.type === 'metal' ? 1 : 1.2;
      ctx.strokeStyle = print.type === 'metal' ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.55)'; ctx.stroke();
      ctx.restore();
    }
  });
}

// Brushed metal reflects light as a soft band across the brushing (vertical for horizontal brushing).
// Its strength follows the room light; the evening light also moves it, and the room's colour cast tints it later.
let sheenLayer = null;
function drawMetalSheen(ctx, print, tex, photo, opts) {
  if (!tex.sheen) return;
  const q = print.corners;
  const light = opts.light || { brightness: 1, warmth: 0 };
  if (!sheenLayer || sheenLayer.width !== photo.width || sheenLayer.height !== photo.height) sheenLayer = mk(photo.width, photo.height);
  const s = sheenLayer.getContext('2d');
  s.save();
  s.clearRect(0, 0, sheenLayer.width, sheenLayer.height);
  drawQuad(s, tex.sheen, q, opts.steps);
  quadPath(s, q); s.clip();
  s.globalCompositeOperation = 'multiply';
  const H = squareToQuad(q);
  const a = applyH(H, 0, 0.5), b = applyH(H, 1, 0.5);
  const g = s.createLinearGradient(a.x, a.y, b.x, b.y);
  const uc = 0.34 + 0.24 * Math.max(0, Math.min(1, light.warmth));
  const gray = (v) => { const n = Math.round(255 * v); return `rgb(${n},${n},${n})`; };
  const stops = [[0, 0.16], [uc - 0.26, 0.2], [uc - 0.09, 0.72], [uc, 1], [uc + 0.09, 0.72], [uc + 0.26, 0.2], [1, 0.12]];
  stops.forEach(([u, v]) => g.addColorStop(Math.max(0, Math.min(1, u)), gray(v)));
  s.fillStyle = g;
  s.fillRect(0, 0, sheenLayer.width, sheenLayer.height);
  s.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.max(0.12, Math.min(0.85, 0.2 + 0.6 * light.brightness));
  ctx.drawImage(sheenLayer, 0, 0);
  ctx.restore();
}

let emitLayer = null;
function drawEmission(ctx, print, light, opts, photo) {
  const q = print.corners;
  const k = print.glow * (1.4 - Math.min(1, light.brightness) * 0.75);
  const size = quadSize(q);
  // render the lit panel once into its own layer, then use it both sharp and blurred (light spill on the wall)
  if (!emitLayer || emitLayer.width !== photo.width || emitLayer.height !== photo.height) emitLayer = mk(photo.width, photo.height);
  const e = emitLayer.getContext('2d');
  e.clearRect(0, 0, emitLayer.width, emitLayer.height);
  drawQuad(e, buildTexture(print), q, opts.steps);
  e.save();
  quadPath(e, q); e.clip();
  e.globalCompositeOperation = 'screen';
  e.globalAlpha = 0.12;
  e.fillStyle = print.glowColor || '#ffe7b8';
  e.fillRect(0, 0, emitLayer.width, emitLayer.height);
  e.restore();
  withClip(ctx, print, () => {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, k * 0.9);
    ctx.filter = `blur(${Math.max(10, size * 0.16)}px)`;
    ctx.fillStyle = print.glowColor || '#ffe7b8';
    quadPath(ctx, q); ctx.fill();
    ctx.globalAlpha = Math.min(1, k);
    ctx.filter = `blur(${Math.max(6, size * 0.07)}px)`;
    ctx.drawImage(emitLayer, 0, 0);
    ctx.filter = `blur(${Math.max(14, size * 0.2)}px)`;
    ctx.drawImage(emitLayer, 0, 0);
    ctx.restore();
    // the panel itself is lit from behind: it does not dim with the room
    ctx.drawImage(emitLayer, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.6, 0.3 * k);
    ctx.drawImage(emitLayer, 0, 0);
    ctx.restore();
  });
}

function drawOccluders(ctx, scene, photo, light) {
  const keyed = keyLayer(scene, photo);
  if (!scene.occluders?.length && !keyed) return;
  ctx.save();
  (scene.occluders || []).forEach((poly) => { polyPath(ctx, poly); ctx.save(); ctx.clip(); ctx.drawImage(photo, 0, 0); ctx.restore(); });
  if (keyed) ctx.drawImage(keyed, 0, 0);
  ctx.restore();
  if (light.brightness !== 1 || light.warmth !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = lightColor(light);
    scene.occluders.forEach((poly) => { polyPath(ctx, poly); ctx.fill(); });
    ctx.restore();
  }
}

// Things in front of the print cut out by colour inside a box (a plant's leaves): built once per photo.
const keyCache = new WeakMap();
function keyLayer(scene, photo) {
  if (!scene.keyOccluders?.length) return null;
  if (keyCache.has(photo)) return keyCache.get(photo);
  const c = mk(photo.width, photo.height), x = c.getContext('2d');
  for (const k of scene.keyOccluders) {
    const [x0, y0, x1, y1] = k.box, w = x1 - x0, h = y1 - y0;
    x.drawImage(photo, x0, y0, w, h, x0, y0, w, h);
    const d = x.getImageData(x0, y0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const mx = Math.max(a[i], a[i + 1], a[i + 2]), mn = Math.min(a[i], a[i + 1], a[i + 2]);
      const sat = mx ? (mx - mn) / mx : 0;
      a[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (sat - k.minSat) / 0.08))); // soft edge
    }
    x.putImageData(d, x0, y0);
  }
  keyCache.set(photo, c);
  return c;
}

// A polished counter under the print: blur away what it reflected before, mirror the new print into it.
const washCache = new WeakMap();
function drawReflection(ctx, r, photo, scale) {
  const cv = ctx.canvas;
  const copy = mk(cv.width, cv.height); copy.getContext('2d').drawImage(cv, 0, 0);
  const path = (c) => {
    c.beginPath();
    r.polys.forEach((poly) => { poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); });
  };
  let wash = washCache.get(photo);
  if (!wash) {
    // blurred counter with feathered edges, so no seam shows where the old reflection is washed out
    wash = mk(photo.width, photo.height);
    const w = wash.getContext('2d'); w.filter = `blur(${r.wash}px)`; w.drawImage(photo, 0, 0);
    const m = mk(photo.width, photo.height), mc = m.getContext('2d');
    mc.filter = 'blur(6px)'; path(mc); mc.fillStyle = '#000'; mc.fill();
    w.filter = 'none'; w.globalCompositeOperation = 'destination-in'; w.drawImage(m, 0, 0);
    m.width = m.height = 0;
    washCache.set(photo, wash);
  }
  ctx.save();
  ctx.globalAlpha = 0.8; ctx.drawImage(wash, 0, 0);
  path(ctx); ctx.clip();
  ctx.globalAlpha = r.alpha;
  ctx.filter = `blur(${r.blur * scale}px)`;
  ctx.translate(0, 2 * r.edgeY); ctx.scale(1, -1);
  ctx.drawImage(copy, 0, 0, copy.width, copy.height, 0, 0, photo.width, photo.height);
  ctx.restore();
  copy.width = copy.height = 0;
}

// Draw everything at `scale` (canvas px per photo px).
export function renderScene(ctx, { photo, scene, prints, light }, scale = 1, opts = {}) {
  const o = { steps: opts.steps || 14, shadowScale: 1, lightMatch: scene.lightMatch, light, through: scene.surfaceThrough || 0 };
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, photo.width, photo.height);
  ctx.drawImage(photo, 0, 0);
  for (const p of prints) drawPrintBody(ctx, p, photo, o);
  if (scene.reflection && prints.length) drawReflection(ctx, scene.reflection, photo, scale);
  drawOccluders(ctx, scene, photo, { brightness: 1, warmth: 0 });
  if (light.brightness !== 1 || light.warmth !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = lightColor(light);
    ctx.fillRect(0, 0, photo.width, photo.height);
    ctx.restore();
  }
  for (const p of prints) if (p.type === 'backlit' && p.lightOn) drawEmission(ctx, p, light, o, photo);
  if (prints.some((p) => p.type === 'backlit' && p.lightOn)) drawOccluders(ctx, scene, photo, light);
  ctx.restore();
}

export function clearTextureCache() { texCache.clear(); }
