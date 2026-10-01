// Сцена Lantern One: модель из 4 слоёв, состояние задаёт прокрутка (app.js), кадр рисуется только по необходимости.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const KEYS = ['x', 'y', 'scale', 'rx', 'ry', 'rz', 'ex', 'idle', 'glow', 'focus'];
const LAYERS = ['shell', 'core', 'board', 'cooling'];
// куда уезжает слой при полном раскрытии (единицы модели, ширина корпуса ≈ 1,44)
const OPEN = { shell: 1.62, core: 0.52, board: 0.1, cooling: -0.38 };

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildModel() {
  const root = new THREE.Group();
  const layer = {};
  for (const n of LAYERS) { layer[n] = new THREE.Group(); layer[n].name = n; root.add(layer[n]); }

  const alu = new THREE.MeshStandardMaterial({ color: 0xd9dade, metalness: 1, roughness: 0.3 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x8d9096, metalness: 1, roughness: 0.42 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xd98a56, metalness: 1, roughness: 0.28 });
  const slot = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.2, roughness: 0.7 });
  const pcb = new THREE.MeshStandardMaterial({ color: 0x14231c, metalness: 0.2, roughness: 0.55 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.5, roughness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b45a, metalness: 1, roughness: 0.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.14,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, depthWrite: false });
  const strip = new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: 0xffa53a, emissiveIntensity: 1.6 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffb347, emissiveIntensity: 2.2, roughness: 0.4 });
  const mats = { alu, aluDark, copper, glass, strip, coreMat };

  const box = (w, h, d, r, m, seg = 4) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), m);

  // охлаждение: алюминиевое основание, прорези спереди, медная испарительная камера, рёбра
  const C = layer.cooling;
  const tray = box(1.44, 0.22, 1.04, 0.07, alu, 5); tray.position.y = 0.11; C.add(tray);
  const slots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), slot, 15);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 15; i++) { m4.makeTranslation(-0.49 + i * 0.07, 0.07, 0.522); slots.setMatrixAt(i, m4); }
  C.add(slots);
  const led = box(0.18, 0.012, 0.01, 0.004, strip, 1); led.position.set(0, 0.155, 0.522); C.add(led);
  const plate = box(1.3, 0.04, 0.92, 0.015, copper, 2); plate.position.y = 0.24; C.add(plate);
  const finN = 24;
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.13, 0.82), copper, finN);
  for (let i = 0; i < finN; i++) { m4.makeTranslation(-0.6 + i * (1.2 / (finN - 1)), 0.325, 0); fins.setMatrixAt(i, m4); }
  C.add(fins);
  // мягкая тень под корпусом
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(0,0,0,0.42)'], [0.45, 'rgba(0,0,0,0.16)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.002; shadow.userData.skip = true; shadow.renderOrder = -1;
  C.add(shadow);

  // плата: тёмный текстолит, процессор, память, золотые контакты, два порта
  const B = layer.board;
  const board = box(1.24, 0.03, 0.86, 0.012, pcb, 2); board.position.y = 0.42; B.add(board);
  const cpu = box(0.36, 0.035, 0.36, 0.01, chip, 2); cpu.position.set(0, 0.452, 0); B.add(cpu);
  const lid = box(0.26, 0.012, 0.26, 0.004, aluDark, 1); lid.position.set(0, 0.475, 0); B.add(lid);
  for (const [x, z] of [[-0.42, -0.22], [-0.42, 0.02], [-0.42, 0.26], [0.42, -0.22], [0.42, 0.02], [0.42, 0.26]]) {
    const m = box(0.2, 0.025, 0.14, 0.006, chip, 1); m.position.set(x, 0.448, z); B.add(m);
  }
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.006, 0.05), gold, 20);
  for (let i = 0; i < 20; i++) { m4.makeTranslation(-0.475 + i * 0.05, 0.438, -0.4); pins.setMatrixAt(i, m4); }
  B.add(pins);
  for (const x of [0.36, 0.5]) { const p = box(0.1, 0.05, 0.06, 0.008, aluDark, 1); p.position.set(x, 0.46, 0.4); B.add(p); }

  // ядро: светящаяся сфера в кольце-держателе и мягкое свечение
  const K = layer.core;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 24), coreMat); sphere.position.y = 0.76; K.add(sphere);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.014, 16, 96), alu); ring.position.y = 0.76; K.add(ring);
  const ring2 = ring.clone(); ring2.rotation.x = Math.PI / 2; K.add(ring2);
  const stem = box(0.05, 0.26, 0.05, 0.02, alu, 2); stem.position.y = 0.55; K.add(stem);
  const glowMat = new THREE.SpriteMaterial({ map: radialTexture([[0, 'rgba(255,190,100,0.95)'], [0.25, 'rgba(255,170,70,0.45)'], [0.6, 'rgba(255,150,50,0.1)'], [1, 'rgba(255,140,40,0)']]),
    transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  const glow = new THREE.Sprite(glowMat); glow.position.y = 0.76; glow.scale.setScalar(1.15); glow.userData.skip = true; K.add(glow);
  const light = new THREE.PointLight(0xffb347, 1.2, 2.2, 1.6); light.position.y = 0.76; K.add(light);

  // корпус: стекло, четыре стойки, верхняя крышка с тонкой световой щелью
  const S = layer.shell;
  const shell = box(1.42, 0.92, 1.02, 0.06, glass, 5); shell.position.y = 0.7; shell.renderOrder = 2; S.add(shell);
  for (const [x, z] of [[-0.69, -0.49], [0.69, -0.49], [-0.69, 0.49], [0.69, 0.49]]) {
    const p = box(0.05, 0.92, 0.05, 0.02, alu, 2); p.position.set(x, 0.7, z); S.add(p);
  }
  const cap = box(1.46, 0.07, 1.06, 0.03, alu, 3); cap.position.y = 1.195; S.add(cap);
  const capRim = box(1.1, 0.008, 0.7, 0.004, aluDark, 1); capRim.position.y = 1.232; S.add(capRim);
  const rim = box(1.46, 0.03, 1.06, 0.012, aluDark, 2); rim.position.y = 0.24; S.add(rim);

  root.position.y = -0.62; // центр собранного корпуса — в нуле
  return { root, layer, mats, glow, light, sphere };
}

export async function createStage(canvas, opts = {}) {
  const { reduced = false, mobile = false, context } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  if (!gl) throw new Error('no webgl');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) { renderer.dispose(); throw new Error('software webgl: ' + gpu); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  // чёткость: до 2x; на телефоне автоспуск не опускает ниже 1.5 (на экране 3x при 1x сцена мыльная), на ПК — до 1
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  const minDpr = Math.min(maxDpr, mobile ? 1.5 : 1);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentRotation = new THREE.Euler(0, 0.6, 0);
  pmrem.dispose();

  const FOV = 26;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  const rig = new THREE.Group();
  const float = new THREE.Group();
  rig.add(float);
  scene.add(rig);
  const M = buildModel();
  float.add(M.root);
  const base = {};
  for (const n of LAYERS) base[n] = M.layer[n].position.clone();
  // у каждого слоя свои материалы: неактивные слои при раскрытии притушены (только отражения и свечение, прозрачность не трогаем)
  const seen = new Map();
  const orig = new Map(); // исходные отражения и цвет (в userData нельзя: clone() превращает цвет в число)
  const dimMats = LAYERS.map((n) => {
    const list = new Set();
    M.layer[n].traverse((o) => {
      if (!o.isMesh || o.userData.skip) return;
      let m = o.material;
      if (seen.has(m) && seen.get(m) !== n) { const c = m.clone(); o.material = c; m = c; }
      seen.set(m, n);
      if ('envMapIntensity' in m && !orig.has(m)) { orig.set(m, { env: m.envMapIntensity, col: m.color ? m.color.clone() : null }); list.add(m); }
    });
    return [...list];
  });
  const SIZE = { w: 1.46, h: 1.24 };

  const cur = { x: 0, y: 0, scale: 1, rx: 0.3, ry: -0.6, rz: 0, ex: 0, idle: 1, glow: 1, focus: -1 };
  const target = { ...cur };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let w = 0, h = 0, dirty = true, visible = true, settled = false, theme = 'dark';

  function resize() {
    const nw = canvas.clientWidth, nh = canvas.clientHeight;
    if (!nw || !nh || (nw === w && nh === h)) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  // ширина корпуса = доля экрана → расстояние камеры
  function fit() {
    const wide = w >= 900;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let dist = SIZE.w / (wide ? 0.34 : 0.62) / (2 * tan * camera.aspect);
    dist = Math.max(dist, SIZE.h / (wide ? 0.5 : 0.36) / (2 * tan));
    return { dist, halfH: dist * tan, halfW: dist * tan * camera.aspect };
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const dim = [1, 1, 1, 1];
  function apply(t) {
    const f = fit();
    camera.position.set(0, 0, f.dist);
    camera.lookAt(0, 0, 0);
    rig.position.set(cur.x * f.halfW, cur.y * f.halfH, 0);
    rig.scale.setScalar(cur.scale);
    rig.rotation.set(cur.rx, cur.ry, cur.rz);
    const k = reduced ? 0 : cur.idle;
    float.position.y = Math.sin(t * 0.0011) * 0.015 * k;
    float.rotation.set(pointer.y * 0.1 * k + Math.sin(t * 0.0007) * 0.02 * k, pointer.x * 0.2 * k + Math.sin(t * 0.0005) * 0.06 * k, 0);
    // раскрытие: слои расходятся с небольшой задержкой друг за другом; активный слой выходит к зрителю
    LAYERS.forEach((n, i) => {
      const e = cur.ex <= 0 ? 0 : ease(Math.min(1, Math.max(0, (cur.ex * 1.24 - i * 0.08) / 1)));
      const act = Math.max(0, 1 - Math.abs(cur.focus - i));
      const L = M.layer[n];
      L.position.copy(base[n]);
      L.position.y += OPEN[n] * e;
      L.position.z += 0.22 * ease(act) * Math.min(1, cur.ex * 2);
      const d = cur.focus < 0 ? 1 : 1 - 0.6 * Math.min(1, cur.ex * 1.5) * (1 - ease(act));
      for (const m of dimMats[i]) { const o = orig.get(m); m.envMapIntensity = o.env * d; if (o.col) m.color.copy(o.col).multiplyScalar(0.4 + 0.6 * d); }
      dim[i] = d;
    });
    // ядро «дышит»: яркость света — это загрузка машины
    const pulse = reduced ? 1 : 1 + Math.sin(t * 0.0016) * 0.12 * cur.idle;
    const g = cur.glow * pulse;
    M.mats.coreMat.emissiveIntensity = (0.6 + 1.8 * g) * (0.25 + 0.75 * dim[1]);
    M.glow.material.opacity = Math.min(1, (theme === 'light' ? 0.5 : 1) * g) * (0.25 + 0.75 * dim[1]);
    M.glow.scale.setScalar(0.9 + 0.35 * g);
    M.light.intensity = 1.4 * g * (0.4 + 0.6 * dim[1]);
    M.mats.strip.emissiveIntensity = 0.4 + 1.4 * g;
  }

  let last = performance.now(), slow = 0, frames = 0, steady30 = 0, warm = 90;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(64, now - last); last = now;
    if (!visible) return;
    const a = reduced ? 1 : 1 - Math.exp(-dt / 140);
    let moving = false;
    for (const key of KEYS) {
      const d = target[key] - cur[key];
      if (Math.abs(d) > 1e-4) { cur[key] += d * a; moving = true; } else cur[key] = target[key];
    }
    pointer.x += (pointer.tx - pointer.x) * a; pointer.y += (pointer.ty - pointer.y) * a;
    if (Math.abs(pointer.tx - pointer.x) > 1e-3 || Math.abs(pointer.ty - pointer.y) > 1e-3) moving = true;
    const idling = !reduced && cur.idle > 0.01;
    if (!(dirty || moving || idling)) { settled = true; return; }
    settled = false; dirty = false;
    apply(now);
    renderer.render(scene, camera);
    // первые 90 кадров не считаем: шейдеры, картинки и библиотеки прокрутки ещё грузятся
    if (dt <= 40) { if (warm > 0) warm--; else { frames++; if (dt > 21) slow++; if (dt > 29 && dt < 38) steady30++; } }
    if (frames >= 45) {
      // ровные ~33 мс — экран 30 Гц (энергосбережение iPhone): меньше пикселей не ускорит, только размоет
      if (slow > 18 && steady30 < 36 && dpr > minDpr) { dpr = Math.max(minDpr, dpr - 0.25); renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
      frames = 0; slow = 0; steady30 = 0;
    }
  }

  resize();
  addEventListener('resize', () => { resize(); dirty = true; });
  if (!mobile && !reduced) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = performance.now(); dirty = true; });
  apply(0);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);

  // границы модели на экране (−1…1) в позе s при x = y = 0 и масштабе 1 — по углам рамок всех деталей
  const _b = new THREE.Box3(), _v = new THREE.Vector3();
  function measure(s) {
    const keep = { ...cur };
    Object.assign(cur, s, { x: 0, y: 0, scale: 1, idle: 0 });
    apply(0);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    M.root.traverse((o) => {
      if (!o.isMesh || o.userData.skip) return;
      if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); _b.copy(o.boundingBox); }
      else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox); }
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? _b.max.x : _b.min.x, i & 2 ? _b.max.y : _b.min.y, i & 4 ? _b.max.z : _b.min.z).applyMatrix4(o.matrixWorld).project(camera);
        if (_v.x < x0) x0 = _v.x; if (_v.x > x1) x1 = _v.x;
        if (_v.y < y0) y0 = _v.y; if (_v.y > y1) y1 = _v.y;
      }
    });
    Object.assign(cur, keep);
    dirty = true;
    return { x0, x1, y0, y1 };
  }
  function snapshot(s, type = 'image/webp') {
    const keep = { ...cur };
    Object.assign(cur, s, { idle: 0 });
    apply(0);
    renderer.render(scene, camera);
    const url = canvas.toDataURL(type, 0.86);
    Object.assign(cur, keep);
    dirty = true;
    return url;
  }

  return {
    measure,
    snapshot,
    set(s, instant = false) { Object.assign(target, s); if (instant) Object.assign(cur, target); dirty = true; },
    setVisible(v) { if (v !== visible) { visible = v; last = performance.now(); dirty = true; } },
    setTheme(t) {
      theme = t;
      renderer.toneMappingExposure = t === 'light' ? 1.0 : 1.08;
      M.mats.glass.opacity = t === 'light' ? 0.2 : 0.14;
      dirty = true;
    },
    get settled() { return settled; },
    get dpr() { return dpr; },
    renderer,
  };
}
