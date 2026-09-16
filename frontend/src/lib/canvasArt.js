export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: ctx, w: w, h: h };
}
export function paintSilicon(canvas, opts) {
  opts = opts || {};
  const s = sizeCanvas(canvas);
  const ctx = s.ctx, w = s.w, h = s.h;
  const rng = mulberry32((opts.seed || 1) * 9301 + 49297);
  const accentRGB = opts.accent === 'gold' ? '201,162,106' : '167,139,250';
  const cell = opts.cell || Math.max(34, Math.min(w, h) / 9);
  const lineAlpha = opts.lineAlpha != null ? opts.lineAlpha : 0.15;
  const nodeAlpha = opts.nodeAlpha != null ? opts.nodeAlpha : 0.5;
  const bgAlpha = opts.bgAlpha != null ? opts.bgAlpha : 0.045;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,' + bgAlpha + ')';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const nodes = [];
  const traceCount = opts.traces != null ? opts.traces : 16;
  for (let i = 0; i < traceCount; i++) {
    let x = Math.round((rng() * w) / cell) * cell;
    let y = Math.round((rng() * h) / cell) * cell;
    const segs = 2 + Math.floor(rng() * 3);
    const gold = rng() > 0.78;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.strokeStyle = 'rgba(' + (gold ? '201,162,106' : accentRGB) + ',' + lineAlpha + ')';
    ctx.lineWidth = 1;
    for (let k = 0; k < segs; k++) {
      if (rng() > 0.5) x += (rng() > 0.5 ? 1 : -1) * cell * (1 + Math.floor(rng() * 2));
      else y += (rng() > 0.5 ? 1 : -1) * cell * (1 + Math.floor(rng() * 2));
      x = Math.max(0, Math.min(w, x));
      y = Math.max(0, Math.min(h, y));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    nodes.push({ x: x, y: y, c: gold ? '201,162,106' : accentRGB });
  }
  nodes.forEach(function (n) {
    ctx.beginPath(); ctx.arc(n.x, n.y, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + n.c + ',' + nodeAlpha + ')';
    ctx.fill();
  });
}
