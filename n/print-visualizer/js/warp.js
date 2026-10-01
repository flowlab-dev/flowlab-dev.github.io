// Perspective math and textured-quad drawing for Canvas 2D.
// A print is a texture mapped onto 4 corners (TL, TR, BR, BL) with a projective transform.

// Homography that maps the unit square (0,0)-(1,1) to the quad p[0..3] (TL, TR, BR, BL).
export function squareToQuad(p) {
  const [a, b, c, d] = p; // TL(0,0) TR(1,0) BR(1,1) BL(0,1)
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return {
    a: b.x - a.x + g * b.x, b: d.x - a.x + h * d.x, c: a.x,
    d: b.y - a.y + g * b.y, e: d.y - a.y + h * d.y, f: a.y,
    g, h,
  };
}

export function applyH(H, u, v) {
  const w = H.g * u + H.h * v + 1;
  return { x: (H.a * u + H.b * v + H.c) / w, y: (H.d * u + H.e * v + H.f) / w };
}

// Inverse mapping: screen point -> (u, v) in the unit square.
export function invertH(H) {
  const { a, b, c, d, e, f, g, h } = H;
  const A = e - f * h, B = c * h - b, C = b * f - c * e;
  const D = f * g - d, E = a - c * g, F = c * d - a * f;
  const G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
  return (x, y) => {
    const w = G * x + Hh * y + I;
    return { u: (A * x + B * y + C) / w, v: (D * x + E * y + F) / w };
  };
}

export function pointInQuad(p, pt) {
  const uv = invertH(squareToQuad(p))(pt.x, pt.y);
  return uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1;
}

export function quadPath(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
}

export function centroid(p) {
  return { x: (p[0].x + p[1].x + p[2].x + p[3].x) / 4, y: (p[0].y + p[1].y + p[2].y + p[3].y) / 4 };
}

// Rebuild a quad from its homography with the unit square scaled around its centre.
export function scaleQuad(p, sx, sy) {
  const H = squareToQuad(p);
  const u0 = 0.5 - sx / 2, u1 = 0.5 + sx / 2, v0 = 0.5 - sy / 2, v1 = 0.5 + sy / 2;
  return [applyH(H, u0, v0), applyH(H, u1, v0), applyH(H, u1, v1), applyH(H, u0, v1)];
}

// Draw one textured triangle: source triangle s (texture px) -> destination d (canvas px).
function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  // Grow the destination triangle a little so neighbouring triangles overlap (no hairline seams).
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (q) => {
    const vx = q.x - cx, vy = q.y - cy, len = Math.hypot(vx, vy) || 1;
    return { x: q.x + (vx / len) * 0.6, y: q.y + (vy / len) * 0.6 };
  };
  const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y);
  ctx.closePath();
  ctx.clip();
  // Affine transform that maps s -> d.
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
  const m11 = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const m12 = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const m21 = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const m22 = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const dx = d0.x - m11 * s0.x - m21 * s0.y;
  const dy = d0.y - m12 * s0.x - m22 * s0.y;
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ---------- exact perspective on the GPU (WebGL2): no triangle seams ----------
let gl = null, glCanvas = null, glProg = null, glBuf = null, glFailed = false;
const glTextures = new WeakMap();

function initGL() {
  if (gl || glFailed) return !!gl;
  glCanvas = document.createElement('canvas');
  gl = glCanvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
  if (!gl) { glFailed = true; return false; }
  // phones drop the GPU context under memory pressure: then a print would come out empty.
  // Fall back to the 2D mesh for good instead of drawing nothing.
  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; glFailed = true; });
  const vs = `#version 300 es
  in vec2 pos; uniform vec2 size;
  void main() { gl_Position = vec4(pos.x / size.x * 2.0 - 1.0, 1.0 - pos.y / size.y * 2.0, 0.0, 1.0); }`;
  const fs = `#version 300 es
  precision highp float;
  uniform sampler2D tex; uniform mat3 inv; uniform vec2 size; out vec4 color;
  void main() {
    vec3 r = inv * vec3(gl_FragCoord.x, size.y - gl_FragCoord.y, 1.0);
    vec2 uv = r.xy / r.z;
    if (uv.x < -0.002 || uv.y < -0.002 || uv.x > 1.002 || uv.y > 1.002) discard;
    color = texture(tex, clamp(uv, 0.0, 1.0));
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    glProg = gl.createProgram();
    gl.attachShader(glProg, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(glProg, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(glProg);
    if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) throw new Error('link');
  } catch { gl = null; glFailed = true; return false; }
  glBuf = gl.createBuffer();
  return true;
}

function textureFor(img) {
  let t = glTextures.get(img);
  if (t && t.w === img.width && t.h === img.height && !img.__dirty) return t.tex;
  if (t) gl.deleteTexture(t.tex);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  glTextures.set(img, { tex, w: img.width, h: img.height });
  return tex;
}

export function releaseTexture(img) {
  const t = glTextures.get(img);
  if (t && gl) gl.deleteTexture(t.tex);
  glTextures.delete(img);
}

function drawQuadGL(ctx, img, p) {
  if (!initGL()) return false;
  if (gl.isContextLost()) { gl = null; glFailed = true; return false; }
  const m = ctx.getTransform();
  const d = p.map((q) => ({ x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f }));
  const xs = d.map((q) => q.x), ys = d.map((q) => q.y);
  // draw only the quad's bounding box (1 px margin) into a small GL canvas, then copy it in
  const x0 = Math.floor(Math.max(0, Math.min(...xs)) - 1), y0 = Math.floor(Math.max(0, Math.min(...ys)) - 1);
  const x1 = Math.ceil(Math.min(ctx.canvas.width, Math.max(...xs)) + 1), y1 = Math.ceil(Math.min(ctx.canvas.height, Math.max(...ys)) + 1);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return true;
  if (w > 8192 || h > 8192) return false;
  if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
  const local = d.map((q) => ({ x: q.x - x0, y: q.y - y0 }));
  const H = squareToQuad(local);
  const { a, b, c, d: dd, e, f, g, h: hh } = H;
  const A = e - f * hh, B = c * hh - b, C = b * f - c * e;
  const D = f * g - dd, E = a - c * g, F = c * dd - a * f;
  const G = dd * hh - e * g, Hh = b * g - a * hh, I = a * e - b * dd;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(glProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
  const v = [local[0], local[1], local[2], local[0], local[2], local[3]].flatMap((q) => [q.x, q.y]);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
  const loc = gl.getAttribLocation(glProg, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(glProg, 'size'), w, h);
  gl.uniformMatrix3fv(gl.getUniformLocation(glProg, 'inv'), false, [A, D, G, B, E, Hh, C, F, I]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureFor(img));
  gl.uniform1i(gl.getUniformLocation(glProg, 'tex'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(glCanvas, x0, y0);
  ctx.restore();
  return true;
}

// Draw a texture (canvas or image) onto the quad p with perspective.
// GPU path first; the Canvas 2D mesh below is a fallback for browsers without WebGL2.
export function drawQuad(ctx, img, p, steps = 14) {
  if (!isConvex(p)) return;
  if (drawQuadGL(ctx, img, p)) return;
  drawQuadMesh(ctx, img, p, steps);
}

export function isConvex(p) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    const s = Math.sign(z);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

function drawQuadMesh(ctx, img, p, steps) {
  const H = squareToQuad(p);
  const W = img.width, Ht = img.height;
  const pts = [];
  for (let j = 0; j <= steps; j++) {
    const row = [];
    for (let i = 0; i <= steps; i++) row.push(applyH(H, i / steps, j / steps));
    pts.push(row);
  }
  for (let j = 0; j < steps; j++) {
    for (let i = 0; i < steps; i++) {
      const u0 = (i / steps) * W, u1 = ((i + 1) / steps) * W;
      const v0 = (j / steps) * Ht, v1 = ((j + 1) / steps) * Ht;
      const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
      drawTri(ctx, img, { x: u0, y: v0 }, { x: u1, y: v0 }, { x: u1, y: v1 }, a, b, c);
      drawTri(ctx, img, { x: u0, y: v0 }, { x: u1, y: v1 }, { x: u0, y: v1 }, a, c, d);
    }
  }
}

export function edgeLengths(p) {
  const L = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return { top: L(p[0], p[1]), right: L(p[1], p[2]), bottom: L(p[3], p[2]), left: L(p[0], p[3]) };
}
