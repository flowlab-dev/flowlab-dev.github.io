// Scene renderer: room photo + printed products + room lighting, all in image pixel space.
import { drawQuad, quadPath, squareToQuad, applyH } from './warp.js';
import { renderDesign, getDesign } from './art.js';

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
  if (print.layout === 'repeat') return true;
  if (print.layout === 'mural') return false;
  return !print.upload && !!getDesign(print.design)?.repeat;
}

// The flat artwork as it would come off the printer, in the print's real proportions.
export function buildTexture(print) {
  const key = [print.upload ? print.uploadKey : print.design, print.type, print.widthIn, print.heightIn,
    print.tileIn, print.grout, print.layout].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const longSide = print.type === 'tile' ? 2048 : 1400;
  const aspect = print.widthIn / print.heightIn;
  const W = aspect >= 1 ? longSide : longSide * aspect;
  const H = aspect >= 1 ? longSide / aspect : longSide;
  const c = mk(W, H);
  const ctx = c.getContext('2d');
  const src = sourceOf(print);
  const ppi = c.width / print.widthIn;
  const tilePx = print.type === 'tile' && print.tileIn > 0 ? print.tileIn * ppi : 0;

  if (isRepeat(print)) {
    const cell = tilePx || 8 * ppi; // one motif per tile (or per 8" when printed as one sheet)
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
  if (texCache.size > 8) {
    const k = texCache.keys().next().value;
    const old = texCache.get(k); old.width = old.height = 0; // free memory right away (iOS canvas limit)
    texCache.delete(k);
  }
  texCache.set(key, c);
  return c;
}

// Blurred, desaturated copy of the photo: used to let each print pick up the room's own light falloff.
const shadeCache = new WeakMap();
function shadeMap(photo) {
  if (shadeCache.has(photo)) return shadeCache.get(photo);
  const small = mk(photo.width / 4, photo.height / 4);
  const s = small.getContext('2d');
  s.filter = 'grayscale(1) blur(6px)';
  s.drawImage(photo, 0, 0, small.width, small.height);
  // normalise so the average tone becomes near-white (multiply then only adds the falloff, not a grey cast)
  const d = s.getImageData(0, 0, small.width, small.height);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) sum += d.data[i];
  const mean = sum / (d.data.length / 4) || 128;
  const gain = Math.min(1.4, 235 / mean); // keep the photo's overall exposure: dark rooms stay dark
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.min(255, d.data[i] * gain);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  s.putImageData(d, 0, 0);
  shadeCache.set(photo, small);
  return small;
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
    if (print.type === 'glass') {
      // printed glass sits on stand-off pins: soft shadow on the wall
      const off = quadSize(q) * 0.018;
      ctx.save();
      ctx.filter = `blur(${Math.max(2, off * 0.9)}px)`;
      ctx.fillStyle = `rgba(0,0,0,${0.38 * opts.shadowScale})`;
      quadPath(ctx, q.map((p) => ({ x: p.x + off * 0.6, y: p.y + off })));
      ctx.fill();
      ctx.restore();
    }
    drawQuad(ctx, tex, q, opts.steps);
    if (print.type !== 'backlit' || !print.lightOn) {
      ctx.save();
      quadPath(ctx, q); ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.75;
      ctx.drawImage(shadeMap(photo), 0, 0, photo.width, photo.height);
      ctx.restore();
    }
    if (print.finish === 'gloss' || print.type !== 'tile') {
      const H = squareToQuad(q);
      const a = applyH(H, 0.1, 0), b = applyH(H, 0.9, 1);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.42, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${print.type === 'tile' ? 0.10 : 0.16})`);
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      ctx.save();
      quadPath(ctx, q); ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g; ctx.fillRect(0, 0, photo.width, photo.height);
      ctx.restore();
    }
    if (print.type !== 'tile') {
      ctx.save();
      quadPath(ctx, q);
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
      ctx.restore();
    }
  });
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
  if (!scene.occluders?.length) return;
  ctx.save();
  scene.occluders.forEach((poly) => { polyPath(ctx, poly); ctx.save(); ctx.clip(); ctx.drawImage(photo, 0, 0); ctx.restore(); });
  ctx.restore();
  if (light.brightness !== 1 || light.warmth !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = lightColor(light);
    scene.occluders.forEach((poly) => { polyPath(ctx, poly); ctx.fill(); });
    ctx.restore();
  }
}

// Draw everything at `scale` (canvas px per photo px).
export function renderScene(ctx, { photo, scene, prints, light }, scale = 1, opts = {}) {
  const o = { steps: opts.steps || 14, shadowScale: 1 };
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, photo.width, photo.height);
  ctx.drawImage(photo, 0, 0);
  for (const p of prints) drawPrintBody(ctx, p, photo, o);
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
