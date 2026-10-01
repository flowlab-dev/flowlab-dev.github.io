// Сцена Vireal Aero: одна модель, состояние задаёт прокрутка (app.js), кадр рисуется только по необходимости.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FRAMES = {
  silver:   { color: 0xe9e9ee, metalness: 1, roughness: 0.12 },
  graphite: { color: 0x2b2b30, metalness: 1, roughness: 0.32 },
  gold:     { color: 0xe3c07f, metalness: 1, roughness: 0.16 },
};
// линзы — зеркальное напыление: цвет зеркала + тонкая плёнка (переливы); без прозрачности — нет мутного фона и лишнего прохода рендера
const LENSES = {
  iris:  { tint: 0xa055ff, range: [300, 420], ior: 1.4 },
  ocean: { tint: 0x1f8cff, range: [300, 420], ior: 1.4 },
  amber: { tint: 0xff8a2a, range: [300, 420], ior: 1.3 },
};
const TEAL = new THREE.Color(0x22c7b8);
export const KEYS = ['x', 'y', 'scale', 'rx', 'ry', 'rz', 'fold', 'shift', 'idle', 'pz', 'ex'];

export async function createStage(canvas, opts = {}) {
  const { reduced = false, mobile = false, context } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  if (!gl) throw new Error('no webgl');
  // без видеокарты (программный WebGL) 3D будет тормозить — лучше картинка
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) { renderer.dispose(); throw new Error('software webgl: ' + gpu); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = mobile ? 0.5 : 0.75;
  let dprMax = Math.min(window.devicePixelRatio || 1, 2);
  let dpr = dprMax;
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = env;
  scene.environmentRotation = new THREE.Euler(0, 2.2, 0); // яркая панель студии — не прямо в линзы
  pmrem.dispose();

  const FOV = 26;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  const rig = new THREE.Group();     // движение от прокрутки
  const float = new THREE.Group();   // покачивание и курсор
  rig.add(float);
  scene.add(rig);

  const gltf = await new GLTFLoader().loadAsync(new URL('model/aero.gltf', import.meta.url).href);
  const model = gltf.scene;
  // центр и масштаб: ширина оправы = 1 единица
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const norm = new THREE.Group();
  norm.add(model);
  model.position.sub(center);
  norm.scale.setScalar(1 / size.x);
  float.add(norm);
  const aspectModel = size.y / size.x;
  const depth = size.z / size.x / 2;

  // шарниры: дужка + заушник крутятся вокруг точки крепления дужки
  const hinges = [];
  for (const side of ['Left', 'Right']) {
    const temple = model.getObjectByName('Temple' + side);
    const hook = model.getObjectByName('Earhook' + side);
    if (!temple) continue;
    const t = temple.parent && temple.parent.name === temple.name ? temple.parent : temple;
    const h = hook && hook.parent && hook.parent.name === hook.name ? hook.parent : hook;
    const pivot = new THREE.Group();
    t.parent.add(pivot);
    pivot.position.copy(t.position);
    pivot.attach(t);
    if (h) pivot.attach(h);
    hinges.push({ pivot, sign: t.position.x > 0 ? 1 : -1, z0: pivot.position.z, back: hinges.length ? 0.0065 : 0 });
  }

  // разбор на детали: каждая деталь улетает по своему направлению (доли ширины оправы) и со своей задержкой
  const partBox = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).sub(center);
  const top = (n) => { const o = model.getObjectByName(n); return o && o.parent && o.parent.name === n ? o.parent : o; };
  const lensC = top('LensesExterior') ? partBox(top('LensesExterior')) : new THREE.Vector3();
  const hookC = top('EarhookLeft') ? partBox(top('EarhookLeft')) : new THREE.Vector3(0, 0, -1);
  const F = Math.sign(lensC.z - hookC.z) || 1; // где перед оправы по оси z
  const W = size.x;
  const parts = [];
  const addPart = (obj, v, delay, spin = 0) => { if (obj) parts.push({ obj, p0: obj.position.clone(), v: new THREE.Vector3(...v).multiplyScalar(W), delay, spin, r0: obj.rotation.z }); };
  addPart(top('LensesExterior'), [0, 0.04, F * 0.42], 0.0);
  addPart(top('LensesInterior'), [0, 0.02, F * 0.2], 0.08);
  addPart(top('Nosepads'), [0, -0.16, F * 0.08], 0.16);
  for (const hg of hinges) {
    const s = hg.sign;
    addPart(hg.pivot, [s * 0.16, 0, -F * 0.06], 0.1);
    hg.p0 = hg.pivot.position.clone();
    const hook = hg.pivot.children.find((c) => /Earhook/.test(c.name));
    addPart(hook, [s * 0.1, 0.05, -F * 0.3], 0.22);
  }

  // материалы
  const mats = {};
  model.traverse((o) => {
    if (o.isMesh) { mats[o.material.name] = o.material; o.frustumCulled = false; }
  });
  const frameMat = mats.temples;
  const lensMat = mats.lens_exterior;
  if (lensMat) Object.assign(lensMat, { transmission: 0, metalness: 0.92, roughness: 0.3, iridescence: 1, iridescenceThicknessRange: [...LENSES.iris.range] });
  if (mats.lens_interior) Object.assign(mats.lens_interior, { transmission: 0, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.9 });
  if (mats.lens_interior) mats.lens_interior.color.set(0x16161a);
  if (mats.nose_pads) Object.assign(mats.nose_pads, { transmission: 0, thickness: 0, roughness: 0.12, transparent: true, opacity: 0.55 });
  if (mats.earhooks && mats.earhooks.map) mats.earhooks.map.anisotropy = 4;
  if (frameMat) Object.assign(frameMat, { metalness: 1, roughness: FRAMES.silver.roughness });
  if (frameMat) frameMat.color.set(FRAMES.silver.color);

  // состояние
  const cur = { x: 0, y: -0.3, scale: 1, rx: 0.12, ry: -0.9, rz: 0, fold: 0, shift: 0, idle: 1, pz: 0, ex: 0 };
  const target = { ...cur };
  const tw = { lens: { range: [...LENSES.iris.range], ior: LENSES.iris.ior, tint: new THREE.Color(LENSES.iris.tint) } };
  let lensTo = LENSES.iris, frameTo = FRAMES.silver;
  const frameCol = new THREE.Color(FRAMES.silver.color);
  let frameRough = FRAMES.silver.roughness;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let w = 0, h = 0, dirty = true, visible = true, running = true, settled = false;

  function resize() {
    const nw = canvas.clientWidth, nh = canvas.clientHeight;
    if (!nw || !nh || (nw === w && nh === h)) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  // ширина модели в долях экрана → расстояние камеры
  function fit() {
    const wide = w >= 900;
    const frac = wide ? 0.4 : 0.74;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let dist = 1 / frac / (2 * tan * camera.aspect);
    const maxH = wide ? 0.42 : 0.3; // доля высоты экрана
    dist = Math.max(dist, aspectModel / maxH / (2 * tan));
    return { dist, halfH: dist * tan, halfW: dist * tan * camera.aspect };
  }

  function apply(t) {
    const f = fit();
    camera.position.set(0, 0, f.dist);
    camera.lookAt(0, 0, 0);
    rig.position.set(cur.x * f.halfW, cur.y * f.halfH, 0);
    rig.scale.setScalar(cur.scale);
    norm.position.z = -cur.pz * depth; // точка поворота: 0 — центр модели, 1 — передняя кромка оправы
    rig.rotation.set(cur.rx, cur.ry, cur.rz);
    const k = reduced ? 0 : cur.idle;
    float.position.y = Math.sin(t * 0.0011) * 0.012 * k;
    float.rotation.set(pointer.y * 0.12 * k + Math.sin(t * 0.0007) * 0.02 * k, pointer.x * 0.22 * k + Math.sin(t * 0.0005) * 0.05 * k, 0);
    for (const pt of parts) {
      const e = cur.ex <= 0 ? 0 : ease(Math.min(1, Math.max(0, (cur.ex * 1.3 - pt.delay) / (1.3 - 0.22))));
      pt.obj.position.copy(pt.p0).addScaledVector(pt.v, e);
    }
    for (const hg of hinges) {
      hg.pivot.rotation.y = -hg.sign * cur.fold * Math.PI / 2;
      hg.pivot.position.z -= hg.back * cur.fold; // вторая дужка ложится за первую
    }
    if (lensMat) {
      const r = tw.lens.range, s = cur.shift * 180;
      lensMat.iridescenceThicknessRange[0] = r[0] + s;
      lensMat.iridescenceThicknessRange[1] = r[1] + s;
      lensMat.iridescenceIOR = tw.lens.ior;
      lensMat.color.copy(tw.lens.tint).lerp(TEAL, cur.shift * 0.9); // глава «Линзы»: цвет перетекает в бирюзовый
      lensMat.envMapIntensity = envLens;
    }
    if (frameMat) { frameMat.color.copy(frameCol); frameMat.roughness = frameRough; }
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  let envLens = 0.55;

  // кадр
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  let last = performance.now(), slow = 0, frames = 0;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(64, now - last); last = now;
    if (!visible) return;
    const a = reduced ? 1 : 1 - Math.exp(-dt / 140);
    let moving = false;
    for (const k of KEYS) {
      const d = target[k] - cur[k];
      if (Math.abs(d) > 1e-4) { cur[k] += d * a; moving = true; } else cur[k] = target[k];
    }
    // цвета: мягкий переход
    const c = 1 - Math.exp(-dt / 160);
    const tgtCol = _c1.set(frameTo.color);
    if (!colorsEqual(frameCol, tgtCol)) { frameCol.lerp(tgtCol, c); moving = true; }
    if (Math.abs(frameRough - frameTo.roughness) > 1e-3) { frameRough += (frameTo.roughness - frameRough) * c; moving = true; }
    const L = tw.lens;
    for (let i = 0; i < 2; i++) if (Math.abs(L.range[i] - lensTo.range[i]) > 0.5) { L.range[i] += (lensTo.range[i] - L.range[i]) * c; moving = true; }
    if (Math.abs(L.ior - lensTo.ior) > 1e-3) { L.ior += (lensTo.ior - L.ior) * c; moving = true; }
    const tt = _c2.set(lensTo.tint);
    if (!colorsEqual(L.tint, tt)) { L.tint.lerp(tt, c); moving = true; }
    pointer.x += (pointer.tx - pointer.x) * a; pointer.y += (pointer.ty - pointer.y) * a;
    if (Math.abs(pointer.tx - pointer.x) > 1e-3 || Math.abs(pointer.ty - pointer.y) > 1e-3) moving = true;
    const idling = !reduced && cur.idle > 0.01;
    if (!(dirty || moving || idling)) { settled = true; return; }
    settled = false;
    dirty = false;
    const t0 = performance.now();
    apply(now);
    renderer.render(scene, camera);
    watchSpeed(dt, performance.now() - t0);
  }
  function colorsEqual(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.003; }

  // медленные кадры → меньше пикселей
  function watchSpeed(dt) {
    if (dt > 40) return; // после паузы не считаем
    frames++; if (dt > 21) slow++;
    if (frames >= 45) {
      if (slow > 18 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
      frames = 0; slow = 0;
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
  // прогреть шейдеры до первого показа
  apply(0);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);

  // границы модели на экране (−1…1) в позе s при x = y = 0 и масштабе 1 — по всем вершинам
  const _v = new THREE.Vector3();
  function measure(s) {
    const keep = { ...cur };
    Object.assign(cur, s, { x: 0, y: 0, scale: 1, idle: 0 });
    apply(0);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
        if (_v.x < x0) x0 = _v.x; if (_v.x > x1) x1 = _v.x;
        if (_v.y < y0) y0 = _v.y; if (_v.y > y1) y1 = _v.y;
      }
    });
    Object.assign(cur, keep);
    dirty = true;
    return { x0, x1, y0, y1 };
  }

  // снимок модели на прозрачном фоне (для запасной картинки без WebGL)
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
    set(s, instant = false) {
      Object.assign(target, s);
      if (instant) Object.assign(cur, target);
      dirty = true;
    },
    setVisible(v) { if (v !== visible) { visible = v; last = performance.now(); dirty = true; } },
    setFrame(name) { if (FRAMES[name]) { frameTo = FRAMES[name]; dirty = true; } },
    setLens(name) { if (LENSES[name]) { lensTo = LENSES[name]; dirty = true; } },
    setTheme(theme) { renderer.toneMappingExposure = theme === 'light' ? 1.0 : 1.08; envLens = theme === 'light' ? 0.5 : 0.55; dirty = true; },
    tuneLens(o) { Object.assign(lensTo = { ...lensTo }, o); if (o.roughness != null) lensMat.roughness = o.roughness; if (o.metalness != null) lensMat.metalness = o.metalness; if (o.env != null) envLens = o.env; if (o.envRot != null) scene.environmentRotation.y = o.envRot; dirty = true; },
    get settled() { return settled; },
    get dpr() { return dpr; },
    renderer,
  };
}
