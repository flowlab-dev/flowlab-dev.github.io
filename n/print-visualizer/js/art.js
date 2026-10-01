// Sample artwork catalogue, drawn in code (no stock images, no licensing questions).
// Each design renders once into an offscreen canvas and is cached.
// `tags` = products the design is offered for; display names are translated in i18n.js (key design.<id>).

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const designs = [
  {
    id: 'marble', name: 'Calacatta Marble', tags: ['tile', 'glass', 'cabinet', 'metal'],
    draw(ctx, w, h) {
      const r = rng(7);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f7f4ef'); g.addColorStop(1, '#ece6dc');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let k = 0; k < 26; k++) {
        const gold = k % 5 === 0;
        ctx.strokeStyle = gold ? 'rgba(176,137,72,0.55)' : `rgba(90,88,86,${0.08 + r() * 0.22})`;
        ctx.lineWidth = gold ? 1.6 + r() * 1.5 : 0.6 + r() * 2.6;
        let x = r() * w * 1.2 - w * 0.1, y = -20;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < h + 20) {
          const nx = x + (r() - 0.35) * 90, ny = y + 30 + r() * 70;
          ctx.quadraticCurveTo(x + (r() - 0.5) * 80, (y + ny) / 2, nx, ny);
          x = nx; y = ny;
        }
        ctx.stroke();
      }
      ctx.filter = 'blur(0.6px)'; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none';
    },
  },
  {
    id: 'terrazzo', name: 'Terrazzo Warm', tags: ['tile', 'glass', 'cabinet'],
    draw(ctx, w, h) {
      const r = rng(11);
      ctx.fillStyle = '#efe7dc'; ctx.fillRect(0, 0, w, h);
      const cols = ['#c9734b', '#e0b26a', '#6f8a7b', '#2f3b3a', '#d9cbb8', '#a44f3a'];
      for (let i = 0; i < 900; i++) {
        const x = r() * w, y = r() * h, s = 3 + r() ** 3 * 34;
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.beginPath();
        const n = 5 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + r() * 0.6, rr = s * (0.55 + r() * 0.5);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
    },
  },
  {
    id: 'moroccan', name: 'Moroccan Star', tags: ['tile'], repeat: true,
    draw(ctx, w, h) {
      ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = w * 0.46;
      const star = (rad, rot, fill) => {
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = rot + (k / 16) * Math.PI * 2, rr = k % 2 ? rad * 0.72 : rad;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      };
      star(R, 0, '#1f4e6b');
      star(R * 0.78, Math.PI / 8, '#f4efe6');
      star(R * 0.6, 0, '#c8912f');
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.26, 0, Math.PI * 2); ctx.fillStyle = '#1f4e6b'; ctx.fill();
      // corner quarter-motifs so the pattern links across tiles
      ctx.fillStyle = '#1f4e6b';
      for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
        ctx.beginPath(); ctx.arc(x, y, w * 0.13, 0, Math.PI * 2); ctx.fill();
      }
    },
  },
  {
    id: 'citrus', name: 'Citrus Grove', tags: ['tile', 'glass'], repeat: true,
    draw(ctx, w, h) {
      ctx.fillStyle = '#f6f1e3'; ctx.fillRect(0, 0, w, h);
      const slice = (x, y, r, c1, c2) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c1; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.fillStyle = '#fbf6e8'; ctx.fill();
        for (let k = 0; k < 9; k++) {
          const a0 = (k / 9) * Math.PI * 2 + 0.05, a1 = ((k + 1) / 9) * Math.PI * 2 - 0.05;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.8, a0, a1); ctx.closePath();
          ctx.fillStyle = c2; ctx.fill();
        }
      };
      const leaf = (x, y, s, a) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); ctx.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0);
        ctx.fillStyle = '#4f7a4a'; ctx.fill(); ctx.restore();
      };
      leaf(w * 0.18, h * 0.2, w * 0.2, 0.6); leaf(w * 0.7, h * 0.72, w * 0.22, -2.4);
      leaf(w * 0.82, h * 0.18, w * 0.16, 2.2);
      slice(w * 0.34, h * 0.36, w * 0.17, '#e8a317', '#f5c542');
      slice(w * 0.7, h * 0.4, w * 0.12, '#8fb339', '#b9d65a');
      slice(w * 0.32, h * 0.78, w * 0.13, '#e56a2f', '#f39a52');
    },
  },
  {
    id: 'coast', name: 'Coastal Sunset', tags: ['glass', 'backlit', 'cabinet', 'metal', 'glassblock'], aspect: 1.6,
    draw(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      sky.addColorStop(0, '#2b3a67'); sky.addColorStop(0.55, '#e3795a'); sky.addColorStop(1, '#f6c177');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.beginPath(); ctx.arc(w * 0.62, h * 0.56, h * 0.12, 0, Math.PI * 2); ctx.fillStyle = '#fde3a7'; ctx.fill();
      const layer = (y0, amp, col, seed) => {
        const r = rng(seed); ctx.beginPath(); ctx.moveTo(0, h);
        for (let i = 0; i <= 40; i++) { const x = i * w / 40; ctx.lineTo(x, y0 + Math.sin(x / w * 6 + seed) * amp + (r() - 0.5) * amp * 0.5); }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      };
      layer(h * 0.52, h * 0.05, '#7a4e6b', 3);
      layer(h * 0.6, h * 0.035, '#4b3a5c', 5);
      const sea = ctx.createLinearGradient(0, h * 0.64, 0, h);
      sea.addColorStop(0, '#f0a868'); sea.addColorStop(1, '#23345c');
      ctx.fillStyle = sea; ctx.fillRect(0, h * 0.64, w, h * 0.36);
      ctx.fillStyle = 'rgba(253,227,167,0.55)';
      for (let i = 0; i < 14; i++) ctx.fillRect(w * 0.62 - (60 - i * 3), h * 0.66 + i * h * 0.02, (60 - i * 3) * 2, 3);
    },
  },
  {
    id: 'aurora', name: 'Aurora Flow', tags: ['glass', 'backlit', 'metal', 'glassblock'], aspect: 1.6,
    draw(ctx, w, h) {
      ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const bands = [['#1dd3b0', 0.35], ['#3a86ff', 0.5], ['#b388eb', 0.62], ['#1dd3b0', 0.75]];
      bands.forEach(([c, y], i) => {
        ctx.filter = 'blur(28px)';
        ctx.beginPath(); ctx.moveTo(-50, h * y);
        for (let x = -50; x <= w + 50; x += 20) ctx.lineTo(x, h * y + Math.sin(x / w * 5 + i * 1.7) * h * 0.12);
        ctx.lineWidth = h * 0.09; ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.stroke();
      });
      ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const r = rng(3); ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 160; i++) ctx.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5);
    },
  },
  {
    id: 'botanical', name: 'Botanical Leaves', tags: ['glass', 'tile', 'cabinet', 'metal', 'glassblock'], aspect: 1.25,
    draw(ctx, w, h) {
      ctx.fillStyle = '#e9efe6'; ctx.fillRect(0, 0, w, h);
      const r = rng(21);
      const cols = ['#2f5d50', '#4f7f63', '#86a873', '#c6d4a8', '#1f3d36'];
      for (let i = 0; i < 38; i++) {
        const x = r() * w, y = r() * h, s = w * (0.12 + r() * 0.22), a = r() * Math.PI * 2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s * 0.3, -s * 0.42, s * 0.8, -s * 0.3, s, 0);
        ctx.bezierCurveTo(s * 0.8, s * 0.3, s * 0.3, s * 0.42, 0, 0);
        ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = 0.92; ctx.fill();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e9efe6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s * 0.05, 0); ctx.lineTo(s * 0.92, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'ink', name: 'Indigo Ink', tags: ['glass', 'backlit', 'tile', 'cabinet', 'metal', 'glassblock'], aspect: 1.5,
    draw(ctx, w, h) {
      ctx.fillStyle = '#f3f0ea'; ctx.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 9; i++) {
        const x = r() * w, y = r() * h, rad = w * (0.08 + r() * 0.22);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(28,45,110,${0.55 + r() * 0.3})`);
        g.addColorStop(0.6, 'rgba(52,86,160,0.25)'); g.addColorStop(1, 'rgba(52,86,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(190,150,80,0.7)'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); let x = r() * w, y = r() * h; ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * w * 0.2; y += (r() - 0.5) * h * 0.2; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    },
  },
];

const cache = new Map();

export function listDesigns(type) {
  return designs.filter((d) => d.tags.includes(type));
}

export function getDesign(id) {
  return designs.find((d) => d.id === id);
}

export function renderDesign(id) {
  if (cache.has(id)) return cache.get(id);
  const d = getDesign(id);
  const aspect = d.aspect || 1;
  const w = 1024, h = Math.round(1024 / aspect);
  const c = canvas(w, h);
  d.draw(c.getContext('2d'), w, h);
  cache.set(id, c);
  return c;
}

export function thumb(id, size = 120) {
  const src = renderDesign(id);
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const s = Math.max(size / src.width, size / src.height);
  ctx.drawImage(src, (size - src.width * s) / 2, (size - src.height * s) / 2, src.width * s, src.height * s);
  return c.toDataURL('image/jpeg', 0.85);
}
