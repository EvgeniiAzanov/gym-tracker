// Хэш-роутер: #/workout, #/summary/<id>, … Каждый экран — объект
// { render(...args) → html, mount?(root, ...args), unmount?(), actions?: { имя: fn(el, event) }, tabs?: true }.
// Клики по элементам с data-a="имя" уходят в actions текущего экрана (в том числе из шторок).

import { icon } from './ui.js';

const screens = {};
let active = null;

export const register = (name, screen) => (screens[name] = screen);

function parse() {
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: name || 'home', args: args.map(decodeURIComponent) };
}

export function go(path, { replace = false } = {}) {
  const url = '#/' + path;
  if (replace) {
    history.replaceState(null, '', url);
    render();
  } else if (location.hash === url) {
    render();
  } else {
    location.hash = url;
  }
}

const TABS = [
  ['home', '', 'Тренировка', icon.dumbbell],
  ['history', 'history', 'История', icon.history],
  ['progress', 'progress', 'Прогресс', icon.chart],
  ['settings', 'settings', 'Настройки', icon.sliders],
];

const tabbar = (name) =>
  `<nav class="tabbar">${TABS.map(
    ([id, path, label, ic]) => `<a class="tab ${id === name ? 'on' : ''}" href="#/${path}">${ic}<span>${label}</span></a>`,
  ).join('')}</nav>`;

export function render({ keepScroll = false } = {}) {
  const { name, args } = parse();
  const screen = screens[name] || screens.home;
  const root = document.getElementById('app');
  const prevBody = root.querySelector('.body');
  const y = keepScroll && active?.name === name && prevBody ? prevBody.scrollTop : 0;
  if (active && active.screen !== screen) active.screen.unmount?.();
  active = { name, screen };
  root.innerHTML = screen.render(...args) + (screen.tabs ? tabbar(name) : '');
  root.dataset.screen = name;
  const body = root.querySelector('.body');
  if (body) body.scrollTop = y;
  const footer = root.querySelector('.panel, .tabbar');
  document.documentElement.style.setProperty(
    '--toast-b',
    footer ? `${footer.offsetHeight + 12}px` : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
  );
  screen.mount?.(root, ...args);
}

export const rerender = () => render({ keepScroll: true });

export function dispatch(e) {
  const el = e.target.closest('[data-a]');
  if (!el || !active) return;
  const fn = active.screen.actions?.[el.dataset.a];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
}

window.addEventListener('hashchange', () => render());
