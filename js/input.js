// Панель ввода подхода — три варианта, переключаются в меню тренировки и в настройках.
// Нажатия «Записать», «повторы → записать» и тап по числу (цифровая клавиатура)
// обрабатывает экран тренировки через data-a. Здесь — только удержание −/+ и колёса.

import { num } from './format.js';
import { round2 } from './stats.js';

export const VARIANTS = [
  { id: 'A', name: 'Степперы', hint: 'Вес и повторы кнопками −/+, потом «Записать». Удержание кнопки листает быстро, тап по числу — ввод с клавиатуры.' },
  { id: 'B', name: 'Быстрый', hint: 'Вес кнопками −/+, а нажатие на число повторений сразу записывает подход. Подсвечено число из прошлого раза.' },
  { id: 'C', name: 'Колёса', hint: 'Вес и повторы прокруткой, потом «Записать». Тап по выбранному значению — ввод с клавиатуры.' },
];

export const clampField = (field, v) => (field === 'w' ? Math.max(0, round2(v)) : Math.min(99, Math.max(1, Math.round(v))));

const unitOf = (field, ex) => (field === 'w' ? (ex.bw ? 'кг доп.' : 'кг') : 'повт.');

function stepper(field, ctx) {
  const step = field === 'w' ? ctx.ex.step : 1;
  const btn = (dir) =>
    `<button class="st-btn" data-hold="${field}" data-dir="${dir}" aria-label="${dir > 0 ? 'Больше' : 'Меньше'}">
      <span class="st-sign">${dir > 0 ? '+' : '−'}</span><span class="st-step">${num(step)}</span>
    </button>`;
  return `<div class="stepper">
    ${btn(-1)}
    <button class="st-val" data-a="pad" data-field="${field}">
      <span class="st-num num" data-val="${field}">${num(ctx.draft[field])}</span><span class="st-unit">${unitOf(field, ctx.ex)}</span>
    </button>
    ${btn(1)}
  </div>`;
}

// Подход сверх запланированного — сиреневая кнопка и «(+1 п.)»
const extraMark = (ctx) => (ctx.extra ? ` (+${ctx.extra} п.)` : '');

const recordBtn = (ctx) =>
  `<button class="btn-record ${ctx.extra ? 'extra' : ''}" data-a="record">Записать подход ${ctx.setNo}${extraMark(ctx)}</button>`;

function repsGrid(ctx) {
  const center = ctx.target?.r ?? ctx.draft.r;
  const start = Math.max(1, center - 3);
  const vals = Array.from({ length: 8 }, (_, i) => start + i);
  return `<div class="reps-head"><span>Повторы — нажми, и подход запишется${extraMark(ctx)}</span><button data-a="rec-other">другое</button></div>
    <div class="reps-grid">${vals
      .map((v) => `<button class="rg-btn num ${v === center ? 'is-target' : ''}" data-a="rec-r" data-r="${v}">${v}</button>`)
      .join('')}</div>`;
}

const ITEM_H = 40;

function weightValues(ex, w) {
  const max = Math.max(w + 60, 60);
  const out = [];
  for (let i = 0; round2(i * ex.step) <= max; i++) out.push(round2(i * ex.step));
  if (!out.includes(w)) {
    out.push(w);
    out.sort((a, b) => a - b);
  }
  return out;
}

const repsValues = () => Array.from({ length: 40 }, (_, i) => i + 1);

function wheel(field, values, current, ctx) {
  return `<div class="wheel" data-wheel="${field}">
    <div class="wheel-sel"></div>
    <div class="wheel-scroll">
      <div class="wheel-pad"></div>
      ${values.map((v) => `<div class="wheel-item num ${v === current ? 'on' : ''}" data-v="${v}">${num(v)}</div>`).join('')}
      <div class="wheel-pad"></div>
    </div>
    <div class="wheel-unit">${unitOf(field, ctx.ex)}</div>
  </div>`;
}

export function renderInput(ctx) {
  if (ctx.variant === 'B') {
    return `<div class="inp inp-b ${ctx.extra ? 'extra' : ''}">${stepper('w', ctx)}${repsGrid(ctx)}</div>`;
  }
  if (ctx.variant === 'C') {
    return `<div class="inp inp-c">
      <div class="wheels">
        ${wheel('w', weightValues(ctx.ex, ctx.draft.w), ctx.draft.w, ctx)}
        <div class="wheel-x">×</div>
        ${wheel('r', repsValues(), ctx.draft.r, ctx)}
      </div>
      ${recordBtn(ctx)}
    </div>`;
  }
  return `<div class="inp inp-a">${stepper('w', ctx)}${stepper('r', ctx)}${recordBtn(ctx)}</div>`;
}

// api: { get() → draft, set(field, value), pad(field) }
export function mountInput(root, ctx, api) {
  // Удержание −/+: первый шаг сразу, дальше автоповтор.
  root.querySelectorAll('[data-hold]').forEach((btn) => {
    const field = btn.dataset.hold;
    const delta = Number(btn.dataset.dir) * (field === 'w' ? ctx.ex.step : 1);
    let t1;
    let t2;
    const bump = () => {
      const v = clampField(field, api.get()[field] + delta);
      api.set(field, v);
      root.querySelector(`[data-val="${field}"]`).textContent = num(v);
    };
    const stop = () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
      bump();
      t1 = setTimeout(() => (t2 = setInterval(bump, 90)), 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // Колёса: прокрутка с привязкой к значению.
  root.querySelectorAll('[data-wheel]').forEach((wh) => {
    const field = wh.dataset.wheel;
    const scroller = wh.querySelector('.wheel-scroll');
    const items = [...wh.querySelectorAll('.wheel-item')];
    const cur = items.findIndex((it) => it.classList.contains('on'));
    scroller.scrollTop = Math.max(0, cur) * ITEM_H;
    let onIdx = cur;
    const highlight = () => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round(scroller.scrollTop / ITEM_H)));
      if (i === onIdx) return;
      items[onIdx]?.classList.remove('on');
      items[i].classList.add('on');
      onIdx = i;
      api.set(field, Number(items[i].dataset.v));
    };
    scroller.addEventListener('scroll', () => requestAnimationFrame(highlight), { passive: true });
    items.forEach((it, i) =>
      it.addEventListener('click', () => {
        if (i === onIdx) api.pad(field);
        else scroller.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
      }),
    );
  });
}
