// Ferrowyn F1 demo. The hero's live effect follows the team's speed rules:
//   - first paint is still pictures (gradient + logo) — readable at once, and the LCP is the heading, not a canvas;
//   - the shader code is loaded only after the page has loaded, and only on devices that can afford it;
//   - reduced motion, Save-Data, no WebGL2 or a low-memory phone → the stills stay, nothing else is downloaded;
//   - the effect lives only in the first screen; Paper Shaders pauses itself off screen and on hidden tabs;
//   - live and still use the same frame and the same boxes, so the switch is a fade, not a jump.
const LIB = 'https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.81/dist/'; // only the 5 modules we use (~17 KB gz)
const FRAME = 4200; // the moment the stills were rendered at — live starts from it
const root = document.documentElement;
const hero = document.querySelector('.hero');
const capture = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? new URLSearchParams(location.search).get('capture') : null; // build/prep.mjs only

// ---- theme: dark first (the hero is dark by design); light only when the visitor picks it ---------------
const themeBtn = document.getElementById('theme');
const isLight = () => root.getAttribute('data-theme') === 'light';
const label = () => { themeBtn.textContent = isLight() ? 'Dark theme' : 'Light theme'; };
themeBtn.addEventListener('click', () => { const n = isLight() ? 'dark' : 'light'; root.setAttribute('data-theme', n); try { localStorage.setItem('fw-theme', n); } catch (e) {} label(); });
label();

// ---- appear on scroll ----------------------------------------------------------------------------------
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const els = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduce.matches) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
} else els.forEach((el) => el.classList.add('in'));

// ---- demo form: says honestly that nothing is sent ----------------------------------------------------
const form = document.getElementById('reserve-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const out = document.getElementById('r-status');
  if (!form.checkValidity()) { out.textContent = 'Please add your name and a valid email.'; form.querySelector(':invalid')?.focus(); return; }
  out.textContent = 'This is a demo, so nothing was sent. On a real site this would reach the shop and confirm by email.';
  form.reset();
});

// ---- the live hero -------------------------------------------------------------------------------------
function canAfford() {
  if (capture) return true;
  if (reduce.matches) return false;
  if (navigator.connection && navigator.connection.saveData) return false;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
  if (!('WebGL2RenderingContext' in window)) return false; // Paper Shaders needs WebGL2
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // give the probe context back straight away
    return true;
  } catch (e) { return false; }
}

let mounts = null;
async function startLive() {
  const logo = new Image();
  logo.src = 'assets/logo-metal.webp'; // starts downloading while the code loads
  const [{ ShaderMount }, { meshGradientFragmentShader }, { liquidMetalFragmentShader }, { getShaderColorFromString: col }, { ShaderFitOptions: fit }] = await Promise.all([
    import(LIB + 'shader-mount.js'), import(LIB + 'shaders/mesh-gradient.js'), import(LIB + 'shaders/liquid-metal.js'),
    import(LIB + 'get-shader-color-from-string.js'), import(LIB + 'shader-sizing.js'), logo.decode(),
  ]);
  const sizing = (f, scale) => ({ u_fit: fit[f], u_scale: scale, u_rotation: 0, u_originX: 0.5, u_originY: 0.5, u_offsetX: 0, u_offsetY: 0, u_worldWidth: 0, u_worldHeight: 0 });
  const bgSpeed = capture || reduce.matches ? 0 : 0.35, logoSpeed = capture || reduce.matches ? 0 : 1;
  let bg, metal;
  try {
    // Pixel budget: the gradient is soft, so it is drawn at up to ~1.2 MP and stretched — a phone's GPU stays cool.
    if (capture !== 'logo') bg = new ShaderMount(document.querySelector('.hero-bg'), meshGradientFragmentShader, {
      u_colors: ['#0b0b0c', '#3b2c19', '#9a7434', '#1b2735', '#0e0e10'].map(col), u_colorsCount: 5,
      u_distortion: 0.85, u_swirl: 0.25, u_grainMixer: 0, u_grainOverlay: 0.04, ...sizing('none', 1),
    }, undefined, bgSpeed, FRAME, 1, 1.2e6);
    if (capture !== 'bg') metal = new ShaderMount(document.querySelector('.hero-logo'), liquidMetalFragmentShader, {
      u_image: logo, u_isImage: true, u_shape: 0,
      u_colorBack: col('rgba(0,0,0,0)'), u_colorTint: col('#f3d9a4'),
      u_repetition: 2, u_softness: 0.15, u_shiftRed: 0.25, u_shiftBlue: 0.25, u_distortion: 0.08, u_contour: 0.45, u_angle: 70,
      ...sizing('contain', 0.82),
    }, { premultipliedAlpha: false, alpha: true }, logoSpeed, FRAME, 1, 0.8e6);
  } catch (e) { bg?.dispose(); metal?.dispose(); throw e; }
  mounts = { bg, metal };
  requestAnimationFrame(() => requestAnimationFrame(() => { hero.classList.add('live'); window.__heroReady = true; }));
}
// Reduced motion switched on while the page is open → freeze on the current frame (and back).
reduce.addEventListener?.('change', (e) => { if (!mounts) return; mounts.bg?.setSpeed(e.matches ? 0 : 0.35); mounts.metal?.setSpeed(e.matches ? 0 : 1); });

if (capture) hero.classList.add('capture', 'capture-' + capture);
const go = () => { if (!canAfford()) return; startLive().catch((e) => { console.warn('Live hero skipped:', e && e.message); }); };
if (capture) go();
else {
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}
