// Minimal glTF 2.0 (GLB) writer: one flat panel of real size with the print as its texture.
// Used for the phone AR view (model-viewer places it on a real wall at true scale).

const pad4 = (n) => (n + 3) & ~3;

function edgeMaterial(kind, opts) {
  if (kind === 'metal') return { baseColorFactor: METAL_EDGE[opts.metal] || METAL_EDGE.aluminium, metallicFactor: 1, roughnessFactor: 0.35 };
  if (kind === 'cabinet') return { baseColorFactor: [0.91, 0.9, 0.88, 1], metallicFactor: 0, roughnessFactor: 0.45 }; // lacquered edge banding
  if (kind === 'tile') return { baseColorFactor: [0.93, 0.92, 0.9, 1], metallicFactor: 0, roughnessFactor: 0.2 };
  return { baseColorFactor: [0.62, 0.74, 0.71, 1], metallicFactor: 0, roughnessFactor: 0.2 }; // glass edge
}

// Real thickness of each product, metres: tile 8 mm, glass 6 mm, cabinet door panel 18 mm, metal sheet 2 mm,
// glass block 3 7/8 in (98 mm).
const THICKNESS = { tile: 0.008, glass: 0.006, backlit: 0.006, cabinet: 0.018, metal: 0.002, glassblock: 0.098 };
const METAL_EDGE = { aluminium: [0.8, 0.81, 0.83, 1], steel: [0.7, 0.71, 0.72, 1], brass: [0.8, 0.64, 0.36, 1] };

// Split a simple polygon into triangles (ear clipping). pts: [[x, y]], counter-clockwise.
function triangulate(pts) {
  const idx = pts.map((_, i) => i), out = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inside(pts[j], a, b, c))) continue;
      out.push(i0, i1, i2); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(...idx);
  return out;
}

// opts: { widthIn, heightIn, kind, finish, metal, underbase, outline? }
// outline: [{u, v}] in 0–1 across and down; the panel and its edges follow it (a wall with steps).
export async function panelGLB(textureCanvas, opts) {
  const { widthIn, heightIn, kind } = opts;
  const w = widthIn * 0.0254, h = heightIn * 0.0254, d = THICKNESS[kind] ?? 0.006;
  const max = 1024;
  const s = Math.min(1, max / Math.max(textureCanvas.width, textureCanvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(textureCanvas.width * s); c.height = Math.round(textureCanvas.height * s);
  c.getContext('2d').drawImage(textureCanvas, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const img = new Uint8Array(await blob.arrayBuffer());

  // front face at z = d (facing the viewer), back against the wall at z = 0; counter-clockwise outline
  let ring = (opts.outline || [{ u: 0, v: 1 }, { u: 1, v: 1 }, { u: 1, v: 0 }, { u: 0, v: 0 }]).map((q) => [q.u, q.v]);
  const signed = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
  if (signed > 0) ring = ring.reverse(); // v grows downwards, y upwards: a clockwise ring in u,v is counter-clockwise in x,y
  // drop points that lie on a straight edge (an added "+" point never moved): they add nothing and stall the triangulation
  ring = ring.filter((q, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], c = ring[(i + 1) % ring.length];
    return Math.abs((q[0] - a[0]) * (c[1] - a[1]) - (q[1] - a[1]) * (c[0] - a[0])) > 1e-6;
  });
  const xy = ring.map(([u, v]) => [(u - 0.5) * w, (0.5 - v) * h]);
  const pos = new Float32Array(xy.flatMap(([x, y]) => [x, y, d]));
  const nor = new Float32Array(xy.flatMap(() => [0, 0, 1]));
  const uv = new Float32Array(ring.flat());
  const idx = new Uint16Array(triangulate(xy));

  // edges of the panel (glass or tile thickness), so it reads as a real object on the wall
  const xs = xy.map((q) => q[0]), ys = xy.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sides = xy.map((a, i) => {
    const b = xy[(i + 1) % xy.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [[b[0], b[1], 0], [a[0], a[1], 0], [a[0], a[1], d], [b[0], b[1], d], [(b[1] - a[1]) / len, -(b[0] - a[0]) / len, 0]];
  });
  const epos = new Float32Array(sides.flatMap((q) => q.slice(0, 4).flat()));
  const enor = new Float32Array(sides.flatMap((q) => [q[4], q[4], q[4], q[4]].flat()));
  const eidx = new Uint16Array(sides.flatMap((_, k) => [0, 2, 1, 0, 3, 2].map((i) => i + k * 4)));

  const parts = [pos, nor, uv, idx, img, epos, enor, eidx];
  const offsets = [];
  let len = 0;
  for (const p of parts) { offsets.push(len); len = pad4(len + p.byteLength); }
  const bin = new Uint8Array(len);
  parts.forEach((p, i) => bin.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), offsets[i]));

  // Face: printed surface. Bare metal under see-through ink stays partly metallic; a white underbase hides it.
  let metallic = 0, roughness = 0.12;
  if (kind === 'tile') roughness = 0.35;
  if (kind === 'cabinet') roughness = opts.finish === 'matte' ? 0.6 : 0.18;
  if (kind === 'metal') { metallic = opts.underbase ? 0.15 : 0.55; roughness = opts.underbase ? 0.3 : 0.38; }
  const material = {
    name: 'print',
    pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: metallic, roughnessFactor: roughness },
  };
  if (kind === 'backlit') {
    material.emissiveTexture = { index: 0 };
    material.emissiveFactor = [0.85, 0.85, 0.85];
  }

  const json = {
    asset: { version: '2.0', generator: 'print-visualizer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'print' }],
    meshes: [{ primitives: [
      { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
      { attributes: { POSITION: 4, NORMAL: 5 }, indices: 6, material: 1 },
    ] }],
    materials: [material, { name: 'edge', pbrMetallicRoughness: edgeMaterial(kind, opts) }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 4, mimeType: 'image/jpeg' }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: pos.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[1], byteLength: nor.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[2], byteLength: uv.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[3], byteLength: idx.byteLength, target: 34963 },
      { buffer: 0, byteOffset: offsets[4], byteLength: img.byteLength },
      { buffer: 0, byteOffset: offsets[5], byteLength: epos.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[6], byteLength: enor.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[7], byteLength: eidx.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: xy.length, type: 'VEC3', min: [x0, y0, d], max: [x1, y1, d] },
      { bufferView: 1, componentType: 5126, count: xy.length, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: xy.length, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: idx.length, type: 'SCALAR' },
      { bufferView: 5, componentType: 5126, count: sides.length * 4, type: 'VEC3', min: [x0, y0, 0], max: [x1, y1, d] },
      { bufferView: 6, componentType: 5126, count: sides.length * 4, type: 'VEC3' },
      { bufferView: 7, componentType: 5123, count: sides.length * 6, type: 'SCALAR' },
    ],
  };
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.byteLength);
  const jb = new Uint8Array(jsonLen).fill(0x20);
  jb.set(jsonBytes);
  jsonBytes = jb;

  const total = 12 + 8 + jsonLen + 8 + bin.byteLength;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonLen).set(jsonBytes);
  dv.setUint32(20 + jsonLen, bin.byteLength, true); dv.setUint32(24 + jsonLen, 0x004e4942, true);
  new Uint8Array(out, 28 + jsonLen).set(bin);
  return new Blob([out], { type: 'model/gltf-binary' });
}
