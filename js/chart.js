// Простые SVG-графики для экрана прогресса: линия (макс. вес) и столбцы (тоннаж).
// Одна серия на график, одна ось. Тап/ведение пальцем показывает значение.

import { num, dateStr } from './format.js';

function niceTicks(min, max, count = 3) {
  if (min === max) {
    min -= min ? Math.abs(min) * 0.1 : 1;
    max += max ? Math.abs(max) * 0.1 : 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

const tickStr = (v) => (Math.abs(v) >= 10000 ? `${num(Math.round(v / 100) / 10)}k` : num(v));

function colPath(cx, w, y0, y1) {
  const r = Math.max(0, Math.min(4, w / 2, y0 - y1));
  const a = cx - w / 2;
  const b = cx + w / 2;
  return `M${a},${y0}V${y1 + r}Q${a},${y1} ${a + r},${y1}H${b - r}Q${b},${y1} ${b},${y1 + r}V${y0}Z`;
}

// pts: [{ t: время, v: значение }], kind: 'line' | 'col', unit: подпись к значению в подсказке
export function drawChart(host, pts, { kind, unit }) {
  const W = host.clientWidth;
  const H = 168;
  const m = { l: 44, r: 16, t: 20, b: 24 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = pts.map((p) => p.v);
  const { lo, hi, ticks } = niceTicks(kind === 'col' ? 0 : Math.min(...vals), Math.max(...vals));
  const band = iw / pts.length;
  const x = (i) =>
    kind === 'col' ? m.l + band * (i + 0.5) : m.l + (pts.length === 1 ? iw / 2 : (iw * i) / (pts.length - 1));
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  let g = ticks
    .map(
      (t) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>
        <text class="tick" x="${m.l - 8}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${tickStr(t)}</text>`,
    )
    .join('');

  if (kind === 'col') {
    const w = Math.max(2, Math.min(24, band - 2));
    g += pts.map((p, i) => `<path class="col" d="${colPath(x(i), w, y(lo), y(p.v))}"/>`).join('');
  } else {
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join('');
    if (pts.length > 1) {
      g += `<path class="area" d="${line}L${x(pts.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z"/>`;
      g += `<path class="line" d="${line}"/>`;
    }
    g += pts.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.v)}" r="4"/>`).join('');
  }

  // Подпись последнего значения и даты по краям
  const last = pts.length - 1;
  g += `<text class="end" x="${Math.min(x(last), W - m.r)}" y="${y(pts[last].v) - 10}" text-anchor="end">${num(pts[last].v)}</text>`;
  // У столбцов дата по центру столбца, у линии — по краям графика
  const edge = kind === 'line' && pts.length > 1;
  g += `<text class="tick" x="${x(0)}" y="${H - 6}" text-anchor="${edge ? 'start' : 'middle'}">${dateStr(pts[0].t)}</text>`;
  if (pts.length > 1) g += `<text class="tick" x="${x(last)}" y="${H - 6}" text-anchor="${edge ? 'end' : 'middle'}">${dateStr(pts[last].t)}</text>`;

  g += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
  g += `<circle class="dot hi" r="5" visibility="hidden"/>`;

  host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip" hidden></div>`;

  const svg = host.querySelector('svg');
  const xh = svg.querySelector('.xhair');
  const hiDot = svg.querySelector('.hi');
  const tip = host.querySelector('.tip');

  const show = (clientX) => {
    const px = clientX - svg.getBoundingClientRect().left;
    let i = 0;
    let best = Infinity;
    pts.forEach((_, k) => {
      const dx = Math.abs(x(k) - px);
      if (dx < best) {
        best = dx;
        i = k;
      }
    });
    const cx = x(i);
    xh.setAttribute('x1', cx);
    xh.setAttribute('x2', cx);
    xh.setAttribute('visibility', 'visible');
    hiDot.setAttribute('cx', cx);
    hiDot.setAttribute('cy', y(pts[i].v));
    hiDot.setAttribute('visibility', kind === 'line' ? 'visible' : 'hidden');
    tip.hidden = false;
    tip.innerHTML = `<b>${num(pts[i].v)} ${unit}</b><span>${dateStr(pts[i].t)}</span>`;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(W - tw, cx - tw / 2))}px`;
  };
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointermove', (e) => e.buttons && show(e.clientX));
}
