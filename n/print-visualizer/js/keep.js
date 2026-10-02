// Things in front of the print (switches, sockets, the tap, cabinet handles) marked by the user with a box.
// "Fit" keeps only the item inside its box: the wall colours are learned from the box's edge, everything
// that differs from them and is not reachable from the edge through wall pixels stays (so a white socket
// plate on a white wall is kept whole: its outline closes it off). If nothing stands out, the whole box stays.
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

let photoRef = null, photoPx = null;
function pixels(photo) {
  if (photoRef !== photo) {
    const c = mk(photo.width, photo.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(photo, 0, 0);
    photoPx = x.getImageData(0, 0, c.width, c.height).data;
    photoRef = photo;
  }
  return photoPx;
}

// Up to 3 wall colours from the edge pixels (k-means); colours under 10 % of the edge are not wall.
function wallColours(cols) {
  const n = cols.length / 3, k = Math.min(3, n);
  let c = Array.from({ length: k }, (_, i) => { const j = Math.floor((i + 0.5) * n / k) * 3; return [cols[j], cols[j + 1], cols[j + 2]]; });
  let count = [];
  for (let it = 0; it < 8; it++) {
    const sum = c.map(() => [0, 0, 0]); count = c.map(() => 0);
    for (let i = 0; i < cols.length; i += 3) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < c.length; j++) { const d = (cols[i] - c[j][0]) ** 2 + (cols[i + 1] - c[j][1]) ** 2 + (cols[i + 2] - c[j][2]) ** 2; if (d < bd) { bd = d; best = j; } }
      sum[best][0] += cols[i]; sum[best][1] += cols[i + 1]; sum[best][2] += cols[i + 2]; count[best]++;
    }
    c = c.map((v, j) => (count[j] ? sum[j].map((s) => s / count[j]) : v));
  }
  return c.filter((_, j) => count[j] >= n * 0.1);
}

export function hullArea(pts) {
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
  let A = 0; for (let i = 0; i < hull.length; i++) { const p = hull[i], q = hull[(i + 1) % hull.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(A) / 2;
}

export function fitMask(px, W, x0, y0, w, h, inside) {
  const N = w * h, near = (i) => {
    const r = px.subarray((((y0 + Math.floor(i / w)) * W) + x0 + (i % w)) * 4);
    return [r[0], r[1], r[2]];
  };
  // the edge: inside pixels with an outside pixel (or the photo's edge) within 2 px
  const edge = new Uint8Array(N), cols = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!inside[i]) continue;
    let e = false;
    for (let dy = -2; dy <= 2 && !e; dy++) for (let dx = -2; dx <= 2 && !e; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h || !inside[Y * w + X]) e = true;
    }
    if (e) { edge[i] = 1; if ((x + y) % 2 === 0) cols.push(...near(i)); }
  }
  if (cols.length < 30) return null;
  const wall = wallColours(cols);
  const dist = (i) => { const [r, g, b] = near(i); return Math.sqrt(Math.min(...wall.map((c) => (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2))); };
  // how far the wall itself strays from its colours sets the threshold
  const ed = []; for (let i = 0; i < N; i++) if (edge[i]) ed.push(dist(i));
  ed.sort((a, b) => a - b);
  const thr = Math.max(26, ed[Math.floor(ed.length * 0.8)] * 1.6);
  const fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (inside[i] && dist(i) > thr) fg[i] = 1;
  // close 1-px gaps in an item's outline
  const fg2 = fg.slice();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (fg[i]) continue;
    if ((fg[i - 1] && fg[i + 1]) || (fg[i - w] && fg[i + w])) fg2[i] = 1;
  }
  // wall = reachable from the edge without crossing the item
  const out = new Uint8Array(N), stack = [];
  for (let i = 0; i < N; i++) if (edge[i] && !fg2[i]) { out[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
      if (j < 0 || j >= N || out[j] || fg2[j] || !inside[j]) continue;
      out[j] = 1; stack.push(j);
    }
  }
  // the item = the big connected pieces; crumbs of grout or pattern are dropped
  const lab = new Int32Array(N), sizes = [0];
  for (let i = 0; i < N; i++) {
    if (!inside[i] || out[i] || lab[i]) continue;
    const id = sizes.length; let n = 0; lab[i] = id; stack.push(i);
    while (stack.length) {
      const q = stack.pop(), x = q % w; n++;
      for (const j of [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1]) {
        if (j < 0 || j >= N || lab[j] || out[j] || !inside[j]) continue;
        lab[j] = id; stack.push(j);
      }
    }
    sizes.push(n);
  }
  const big = sizes.reduce((m, n) => Math.max(m, n), 0);
  const keep = new Float32Array(N); let kept = 0, area = 0, edgeN = 0, edgeKept = 0, pieces = 0;
  const min = Math.max(big * 0.25, 4);
  for (let id = 1; id < sizes.length; id++) if (sizes[id] >= min) pieces++;
  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    area++; if (edge[i]) edgeN++;
    if (lab[i] && sizes[lab[i]] >= min) { keep[i] = 1; kept++; if (edge[i]) edgeKept++; }
  }
  // how solid the item is: its pixels against its convex hull (a lone outline of a socket plate is not solid)
  const pts = [];
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (keep[y * w + x]) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([l, y], [r + 1, y], [l, y + 1], [r + 1, y + 1]);
  }
  const solid = kept / Math.max(1, hullArea(pts));
  fitMask.last = { kept: kept / area, pieces, edge: edgeKept / Math.max(1, edgeN), solid };
  if (kept < 40) return null; // nothing stands out from the wall: keep the whole box
  // a patterned wall (tiles with motifs) breaks into many pieces along the box's edge: then the whole box is safer
  if (pieces > 3 || edgeKept > edgeN * 0.2) return null;
  // several loose pieces, or one thin scrap, mean the item's outline was found but not the item itself
  if ((pieces > 1 && solid < 0.4) || solid < 0.15) return null;
  // soft 1-px edge outside the item (the item itself stays fully opaque)
  const soft = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      s += keep[Y * w + X]; c++;
    }
    soft[y * w + x] = (keep[y * w + x] ? 1 : (s / c) * 0.6) * (inside[y * w + x] ? 1 : 0);
  }
  return soft;
}

// One item: its cut-out (the fitted item, or the whole area) as a small canvas, cached by its points.
const pieces = new Map();
function piece(photo, px, poly, fit) {
  const key = `${fit ? 1 : 0}|${poly.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}`;
  const hit = pieces.get(key);
  if (hit) return hit;
  const W = photo.width, H = photo.height;
  const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(W, Math.ceil(Math.max(...xs))), y1 = Math.min(H, Math.ceil(Math.max(...ys)));
  const w = x1 - x0, h = y1 - y0;
  if (w < 2 || h < 2) return null;
  const m = mk(w, h), mx = m.getContext('2d', { willReadFrequently: true });
  mx.beginPath(); poly.forEach((q, i) => (i ? mx.lineTo(q.x - x0, q.y - y0) : mx.moveTo(q.x - x0, q.y - y0))); mx.closePath();
  mx.fillStyle = '#000'; mx.fill();
  const md = mx.getImageData(0, 0, w, h).data, inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inside[i] = md[i * 4 + 3] > 127 ? 1 : 0;
  // a box much bigger than a switch or a tap takes in other things (cabinets, worktop): fitting there is a guess
  const small = w * h <= W * H * 0.03;
  const a = (fit && small && fitMask(px, W, x0, y0, w, h, inside)) || null;
  const img = mx.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const s = (((y0 + Math.floor(i / w)) * W) + x0 + (i % w)) * 4;
    d[i * 4] = px[s]; d[i * 4 + 1] = px[s + 1]; d[i * 4 + 2] = px[s + 2];
    d[i * 4 + 3] = a ? Math.round(a[i] * 255) : md[i * 4 + 3];
  }
  mx.putImageData(img, 0, 0);
  const out = { canvas: m, x0, y0, fitted: !!a };
  if (pieces.size > 200) pieces.clear();
  pieces.set(key, out);
  return out;
}

// One photo-sized layer with the marked items cut out of the photo. The area `live` (being dragged) is drawn
// as its plain outline, without fitting. Returns the layer and the areas that could not be fitted (kept whole).
let layer = null;
export function keepLayer(photo, areas, fit, live = -1) {
  if (!areas.length) return null;
  const W = photo.width, H = photo.height, px = pixels(photo);
  if (photoRef !== layer?.photo) pieces.clear();
  if (!layer || layer.canvas.width !== W || layer.canvas.height !== H) layer = { canvas: mk(W, H) };
  layer.photo = photoRef;
  const c = layer.canvas, lx = c.getContext('2d');
  lx.clearRect(0, 0, W, H);
  const boxed = [];
  areas.forEach((poly, a) => {
    if (a === live) {
      lx.save(); lx.beginPath(); poly.forEach((q, i) => (i ? lx.lineTo(q.x, q.y) : lx.moveTo(q.x, q.y))); lx.closePath();
      lx.clip(); lx.drawImage(photo, 0, 0); lx.restore();
      return;
    }
    const p = piece(photo, px, poly, fit);
    if (!p) return;
    if (fit && !p.fitted) boxed.push(a);
    lx.drawImage(p.canvas, p.x0, p.y0);
  });
  c.version = (c.version || 0) + 1; // tells the renderer's light cache that the layer changed
  return { canvas: c, boxed };
}
