// Product surfaces baked into the flat print texture:
//  - brushed metal: a base sheet (metal colour with horizontal brushing) and a sheen mask (where the metal
//    catches light). Each metal is generated once per session and cached; drags never regenerate it.
//  - cabinet doors: the image runs across all doors, gaps cut it, each door gets a soft edge, plus handles.
//  - glass blocks: the image is printed on the face of each block; mortar joints cut it, each block has a
//    moulded rim and either wavy glass (the print ripples) or frosted glass (softer, lighter).

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- brushed metal ----------
export const METALS = ['aluminium', 'steel', 'brass'];
const METAL = {
  aluminium: { base: [204, 207, 211], contrast: 0.08, tint: [236, 241, 247], seed: 101 },
  steel: { base: [170, 172, 174], contrast: 0.1, tint: [240, 241, 243], seed: 202 },
  brass: { base: [199, 162, 96], contrast: 0.075, tint: [255, 226, 168], seed: 303 },
};
export const METAL_SIZE = 1200; // metal prints are rendered with this long side, so the sheet is used 1:1
const sheets = new Map();

export function metalSheet(kind) {
  const key = METAL[kind] ? kind : 'aluminium';
  if (sheets.has(key)) return sheets.get(key);
  const m = METAL[key];
  const N = METAL_SIZE;
  const r = rng(m.seed);
  // 1-D value noise: random values at integer points, smoothstep in between
  const T = 4096, tab = new Float32Array(T);
  for (let i = 0; i < T; i++) tab[i] = r();
  const noise = (x) => {
    const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    const a = tab[i & (T - 1)], b = tab[(i + 1) & (T - 1)];
    return a + (b - a) * s;
  };
  // Every pixel row is one brushing groove. Two layers: faint hairlines that run the full width, and
  // stronger scratches that fade in and out along the row, so streaks have different lengths, not stripes.
  const hair = new Float32Array(N), scratch = new Float32Array(N), ox = new Float32Array(N), fx = new Float32Array(N);
  const white = new Float32Array(N);
  for (let y = 0; y < N; y++) white[y] = r() - 0.5;
  for (let y = 0; y < N; y++) {
    const fine = (white[Math.max(0, y - 1)] + 2 * white[y] + white[Math.min(N - 1, y + 1)]) / 4;
    hair[y] = white[y] * 0.3 + fine * 0.25 + (noise(y / 5 + 300) - 0.5) * 0.12 + (noise(y / 90 + 1200) - 0.5) * 0.08;
    scratch[y] = (r() - 0.5) * 0.7;
    ox[y] = r() * T; fx[y] = 1 / (60 + r() * 340);
  }
  const base = mk(N, N), sheen = mk(N, N);
  const bctx = base.getContext('2d'), sctx = sheen.getContext('2d');
  const bd = bctx.createImageData(N, N), sd = sctx.createImageData(N, N);
  const B = bd.data, S = sd.data;
  const [br, bg, bb] = m.base, [tr, tg, tb] = m.tint, k = m.contrast * 2;
  for (let y = 0; y < N; y++) {
    const hv = hair[y], sv = scratch[y], o = ox[y], f = fx[y];
    for (let x = 0, i = y * N * 4; x < N; x++, i += 4) {
      const amp = clamp(noise(o + x * f) * 2 - 0.85, 0, 1); // 0 over most of the row, rising where a scratch runs
      const streak = hv + sv * amp * amp;
      const L = 1 + k * streak + (r() - 0.5) * 0.045;
      B[i] = br * L; B[i + 1] = bg * L; B[i + 2] = bb * L; B[i + 3] = 255;
      const sh = clamp(0.72 + 1.1 * streak, 0.3, 1);
      S[i] = tr * sh; S[i + 1] = tg * sh; S[i + 2] = tb * sh; S[i + 3] = 255;
    }
  }
  bctx.putImageData(bd, 0, 0);
  sctx.putImageData(sd, 0, 0);
  const out = { base, sheen };
  sheets.set(key, out);
  return out;
}

// Turn the artwork canvas `c` into "UV ink on brushed metal". Returns the sheen mask for the renderer.
// Without white underbase the inks are see-through: the metal colour multiplies with the art, so white
// areas are bare metal and the shine shows only where little ink is laid down.
export function applyMetal(c, kind, underbase) {
  const { base, sheen } = metalSheet(kind);
  const W = c.width, H = c.height;
  const ctx = c.getContext('2d');
  const art = mk(W, H);
  art.getContext('2d').drawImage(c, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(base, 0, 0, W, H, 0, 0, W, H);
  ctx.globalCompositeOperation = underbase ? 'source-over' : 'multiply';
  ctx.drawImage(art, 0, 0);
  ctx.restore();

  // sheen mask at half size: it is a soft highlight, so this keeps memory low on phones
  const s = mk(W / 2, H / 2);
  const sc = s.getContext('2d');
  sc.drawImage(sheen, 0, 0, W, H, 0, 0, s.width, s.height);
  if (underbase) {
    // solid white + colour layer: only the varnish-like gloss of the ink is left
    sc.fillStyle = 'rgb(58,58,58)'; sc.fillRect(0, 0, s.width, s.height);
  } else {
    sc.globalCompositeOperation = 'multiply';
    sc.drawImage(art, 0, 0, s.width, s.height);
  }
  art.width = art.height = 0;
  return s;
}

// ---------- cabinet doors ----------
export const HANDLES = ['none', 'bar', 'knob'];
export const GAPS = [0.0625, 0.125, 0.1875];

function rr(ctx, x, y, w, h, rad) {
  const q = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function drawHandle(ctx, kind, cx, cy, ppi, H) {
  ctx.save();
  if (kind === 'bar') {
    const len = Math.min(H * 0.42, 7 * ppi), th = Math.max(3, 0.42 * ppi);
    const x = cx - th / 2, y = cy - len / 2;
    ctx.save();
    ctx.filter = `blur(${Math.max(1, 0.16 * ppi)}px)`;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    rr(ctx, x + 0.1 * ppi, y + 0.22 * ppi, th, len, th / 2); ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(x, 0, x + th, 0);
    g.addColorStop(0, '#8b9197'); g.addColorStop(0.22, '#eef0f2'); g.addColorStop(0.5, '#c2c7cc');
    g.addColorStop(0.78, '#f6f7f8'); g.addColorStop(1, '#7c8287');
    ctx.fillStyle = g;
    rr(ctx, x, y, th, len, th / 2); ctx.fill();
    ctx.lineWidth = Math.max(0.6, th * 0.06); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.stroke();
  } else if (kind === 'knob') {
    const rad = Math.max(3, 0.62 * ppi);
    ctx.save();
    ctx.filter = `blur(${Math.max(1, 0.18 * ppi)}px)`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(cx + 0.12 * ppi, cy + 0.26 * ppi, rad, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const g = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.05, cx, cy, rad);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d9dde1'); g.addColorStop(1, '#8e949a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(0.6, rad * 0.08); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  }
  ctx.restore();
}

// Draw door edges, gaps and handles over artwork that already fills the canvas.
export function drawDoors(ctx, W, H, ppi, { doors = 3, doorGapIn = 0.125, handle = 'bar' }) {
  const n = clamp(Math.round(doors), 1, 6);
  const dw = W / n;
  const gap = Math.max(1.5, doorGapIn * ppi);
  const bevel = Math.max(1, 0.07 * ppi);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x0 = i * dw, x1 = x0 + dw;
    // soft edge of each door: light from above-left
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x0, 0, dw, bevel); ctx.fillRect(x0, 0, bevel, H);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x0, H - bevel, dw, bevel); ctx.fillRect(x1 - bevel, 0, bevel, H);
  }
  for (let i = 1; i < n; i++) {
    const x = i * dw;
    // the door on the right casts a little shadow into the gap, then the dark gap itself
    const g = ctx.createLinearGradient(x + gap / 2, 0, x + gap * 2.2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x + gap / 2, 0, gap * 1.7, H);
    ctx.fillStyle = 'rgb(24,20,17)';
    ctx.fillRect(x - gap / 2, 0, gap, H);
  }
  // outer edge where the doors meet the cabinet body
  const lw = Math.max(1, gap * 0.6);
  ctx.strokeStyle = 'rgba(24,20,17,0.7)'; ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  if (handle !== 'none') {
    for (let i = 0; i < n; i++) {
      // doors open in pairs: handles meet in the middle of each pair; a single last door opens from the left
      const right = n === 1 || (i % 2 === 0 && i + 1 < n);
      const inset = Math.min(1.6 * ppi, dw * 0.18);
      const cx = right ? (i + 1) * dw - inset : i * dw + inset;
      drawHandle(ctx, handle, cx, H / 2, ppi, H);
    }
  }
  ctx.restore();
}

// ---------- glass blocks ----------
export const GLASS_KINDS = ['wave', 'frosted'];
export const BLOCK_SIZES = [6, 8, 12];
export function drawGlassBlocks(c, ppi, print) {
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const bp = (print.blockIn || 8) * ppi;
  const joint = Math.max(2, 0.375 * ppi); // 3/8 in mortar joint
  const frosted = print.glassKind === 'frosted';
  // 1) the glass bends the print: wavy glass shifts thin strips up and down (and sideways), twice per block
  const src = mk(W, H); src.getContext('2d').drawImage(c, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const amp = frosted ? 0 : bp * 0.018, step = 3;
  const tmp = mk(W, H), tctx = tmp.getContext('2d');
  for (let x = 0; x < W; x += step) {
    const dy = amp * Math.sin(((x % bp) / bp) * Math.PI * 4);
    tctx.drawImage(src, x, 0, step, H, x, dy, step, H);
  }
  for (let y = 0; y < H; y += step) {
    const dx = amp * 0.6 * Math.sin(((y % bp) / bp) * Math.PI * 4 + 1);
    ctx.drawImage(tmp, 0, y, W, step, dx, y, W, step);
  }
  if (frosted) {
    ctx.save(); ctx.filter = `blur(${Math.max(1, bp * 0.006)}px)`; ctx.drawImage(src, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(0, 0, W, H);
  }
  // 2) each block: pillowed face (lighter centre, darker rim), moulded bevel, light ribs on wavy glass
  const rim = bp * 0.07;
  for (let y = 0; y < H; y += bp) {
    for (let x = 0; x < W; x += bp) {
      const cx = x + bp / 2, cy = y + bp / 2;
      const g = ctx.createRadialGradient(cx - bp * 0.12, cy - bp * 0.12, bp * 0.05, cx, cy, bp * 0.72);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.6, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = g; ctx.fillRect(x, y, bp, bp);
      if (!frosted) {
        for (let k = 0; k < 4; k++) {
          const rx = x + rim + ((bp - 2 * rim) * (k + 0.25)) / 4;
          const lg = ctx.createLinearGradient(rx, 0, rx + bp * 0.09, 0);
          lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.13)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = lg; ctx.fillRect(rx, y + rim, bp * 0.09, bp - 2 * rim);
        }
      }
      // bevel: light from the top-left
      const edge = (x0, y0, x1, y1, a0, a1, colour) => {
        const lg = ctx.createLinearGradient(x0, y0, x1, y1);
        lg.addColorStop(0, `rgba(${colour},${a0})`); lg.addColorStop(1, `rgba(${colour},${a1})`);
        return lg;
      };
      ctx.fillStyle = edge(x, 0, x + rim, 0, 0.42, 0, '255,255,255'); ctx.fillRect(x, y, rim, bp);
      ctx.fillStyle = edge(0, y, 0, y + rim, 0.42, 0, '255,255,255'); ctx.fillRect(x, y, bp, rim);
      ctx.fillStyle = edge(x + bp - rim, 0, x + bp, 0, 0, 0.3, '0,0,0'); ctx.fillRect(x + bp - rim, y, rim, bp);
      ctx.fillStyle = edge(0, y + bp - rim, 0, y + bp, 0, 0.3, '0,0,0'); ctx.fillRect(x, y + bp - rim, bp, rim);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, bp * 0.008);
      ctx.strokeRect(x + rim, y + rim, bp - 2 * rim, bp - 2 * rim);
    }
  }
  // 3) mortar joints with a thin shadow line on each side
  ctx.fillStyle = print.grout || '#d9d4cc';
  for (let x = 0; x <= W + 1; x += bp) ctx.fillRect(x - joint / 2, 0, joint, H);
  for (let y = 0; y <= H + 1; y += bp) ctx.fillRect(0, y - joint / 2, W, joint);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x <= W + 1; x += bp) { ctx.fillRect(x - joint / 2 - 1, 0, 1, H); ctx.fillRect(x + joint / 2, 0, 1, H); }
  for (let y = 0; y <= H + 1; y += bp) { ctx.fillRect(0, y - joint / 2 - 1, W, 1); ctx.fillRect(0, y + joint / 2, W, 1); }
  src.width = src.height = tmp.width = tmp.height = 0;
}
