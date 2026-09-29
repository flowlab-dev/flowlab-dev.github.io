// Minimal glTF 2.0 (GLB) writer: one flat panel of real size with the print as its texture.
// Used for the phone AR view (model-viewer places it on a real wall at true scale).

const pad4 = (n) => (n + 3) & ~3;

export async function panelGLB(textureCanvas, widthIn, heightIn, kind) {
  const w = widthIn * 0.0254, h = heightIn * 0.0254, d = kind === 'tile' ? 0.008 : 0.006;
  const max = 1024;
  const s = Math.min(1, max / Math.max(textureCanvas.width, textureCanvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(textureCanvas.width * s); c.height = Math.round(textureCanvas.height * s);
  c.getContext('2d').drawImage(textureCanvas, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const img = new Uint8Array(await blob.arrayBuffer());

  // front face at z = d (facing the viewer), back against the wall at z = 0
  const pos = new Float32Array([
    -w / 2, -h / 2, d, w / 2, -h / 2, d, w / 2, h / 2, d, -w / 2, h / 2, d,
  ]);
  const nor = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uv = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);

  // edges of the panel (glass or tile thickness), so it reads as a real object on the wall
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const sides = [
    [[x0, y1, 0], [x1, y1, 0], [x1, y1, d], [x0, y1, d], [0, 1, 0]],
    [[x0, y0, d], [x1, y0, d], [x1, y0, 0], [x0, y0, 0], [0, -1, 0]],
    [[x0, y0, 0], [x0, y1, 0], [x0, y1, d], [x0, y0, d], [-1, 0, 0]],
    [[x1, y0, d], [x1, y1, d], [x1, y1, 0], [x1, y0, 0], [1, 0, 0]],
  ];
  const epos = new Float32Array(sides.flatMap((q) => q.slice(0, 4).flat()));
  const enor = new Float32Array(sides.flatMap((q) => [q[4], q[4], q[4], q[4]].flat()));
  const eidx = new Uint16Array(sides.flatMap((_, k) => [0, 2, 1, 0, 3, 2].map((i) => i + k * 4)));

  const parts = [pos, nor, uv, idx, img, epos, enor, eidx];
  const offsets = [];
  let len = 0;
  for (const p of parts) { offsets.push(len); len = pad4(len + p.byteLength); }
  const bin = new Uint8Array(len);
  parts.forEach((p, i) => bin.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), offsets[i]));

  const material = {
    name: 'print',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      metallicFactor: 0,
      roughnessFactor: kind === 'tile' ? 0.35 : 0.12,
    },
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
    materials: [material, {
      name: 'edge',
      pbrMetallicRoughness: {
        baseColorFactor: kind === 'tile' ? [0.93, 0.92, 0.9, 1] : [0.62, 0.74, 0.71, 1],
        metallicFactor: 0, roughnessFactor: 0.2,
      },
    }],
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
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-w / 2, -h / 2, d], max: [w / 2, h / 2, d] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: 5, componentType: 5126, count: 16, type: 'VEC3', min: [x0, y0, 0], max: [x1, y1, d] },
      { bufferView: 6, componentType: 5126, count: 16, type: 'VEC3' },
      { bufferView: 7, componentType: 5123, count: 24, type: 'SCALAR' },
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
