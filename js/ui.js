// Общие элементы интерфейса: иконки, шторка, цифровая клавиатура, тост, вибро, экран без сна.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const svg = (paths) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icon = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  more: svg('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  note: svg('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
  swap: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  dumbbell: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  chart: svg('<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  save: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
};

// ——— Шторка снизу ———

let sheetWrap = null;
let sheetOnClose = null;

export function openSheet(html, { onClose } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog"><div class="sheet-grip"></div>${html}</div>`;
  document.body.append(wrap);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', () => closeSheet());
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  sheetWrap = wrap;
  sheetOnClose = onClose || null;
  return wrap.querySelector('.sheet');
}

export function closeSheet() {
  if (!sheetWrap) return;
  const wrap = sheetWrap;
  const cb = sheetOnClose;
  sheetWrap = sheetOnClose = null;
  wrap.classList.remove('open');
  setTimeout(() => wrap.remove(), 250);
  cb?.();
}

// ——— Цифровая клавиатура: своя, чтобы не вылезала системная ———

export function numpad({ title, value, unit, decimal }) {
  return new Promise((resolve) => {
    let str = String(value ?? '').replace('.', ',');
    let fresh = true; // первое нажатие заменяет значение, а не дописывает
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? ',' : '', '0', 'del'];
    const el = openSheet(
      `<div class="sheet-title">${esc(title)}</div>
       <div class="pad-display num"><span class="pad-v">${esc(str || '0')}</span><span class="pad-u">${esc(unit || '')}</span></div>
       <div class="pad">${keys
         .map((k) =>
           k === '' ? '<span></span>' : `<button data-k="${k}">${k === 'del' ? '⌫' : k}</button>`,
         )
         .join('')}</div>
       <button class="btn btn-primary big" data-k="ok">Готово</button>`,
      { onClose: () => resolve(null) },
    );
    const disp = el.querySelector('.pad-v');
    el.addEventListener('click', (e) => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k == null) return;
      if (k === 'ok') {
        const v = parseFloat(str.replace(',', '.'));
        resolve(Number.isFinite(v) ? v : null);
        closeSheet();
        return;
      }
      if (fresh) {
        str = '';
        fresh = false;
      }
      if (k === 'del') str = str.slice(0, -1);
      else if (k === ',') {
        if (!str.includes(',')) str = (str || '0') + ',';
      } else if (str.replace(',', '').length < 5) {
        str = str === '0' ? k : str + k;
      }
      disp.textContent = str || '0';
    });
  });
}

// ——— Тост снизу, над панелью ввода ———

let toastEl = null;
let toastTimer = null;

export function toast(text, { action, onAction, ms = 5000 } = {}) {
  hideToast();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      hideToast();
      onAction?.();
    });
  }
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  toastEl = el;
  toastTimer = setTimeout(hideToast, ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  if (!toastEl) return;
  const el = toastEl;
  toastEl = null;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 200);
}

// ——— Тактильный отклик ———
// В Safari (iOS 18+) переключатель <input switch> даёт системный «тик» — используем его.

let hapticLabel = null;

export function haptic() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(12);
      return;
    }
    if (!hapticLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'haptic-switch';
      hapticLabel = document.createElement('label');
      hapticLabel.htmlFor = input.id;
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:0';
      box.append(input, hapticLabel);
      document.body.append(box);
    }
    hapticLabel.click();
  } catch {
    /* не поддерживается — ну и ладно */
  }
}

// ——— Не гасить экран во время тренировки ———

let wakeLock = null;
let wantAwake = false;

export async function keepAwake(on) {
  wantAwake = on;
  if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } catch {
      wakeLock = null;
    }
  } else if (!on && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantAwake) keepAwake(true);
});
