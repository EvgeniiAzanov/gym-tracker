const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export const num = (x) => nf.format(x ?? 0);

export const signed = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + nf.format(Math.abs(x));

export const pct = (x) => signed(Math.round(x)) + '%';

export const deltaClass = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'eq');

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// «80 × 10», для собственного веса — «+10 × 8» или «12 повт.»
const X = ' × ';
export function setStr(s, ex) {
  if (ex?.bw) return s.w ? `+${num(s.w)}${X}${s.r}` : `${s.r} повт.`;
  return `${num(s.w)}${X}${s.r}`;
}

export const setsStr = (sets, ex) => sets.map((s) => setStr(s, ex)).join(' · ');

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function dateStr(ts, { weekday = false } = {}) {
  const d = new Date(ts);
  let s = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (d.getFullYear() !== new Date().getFullYear()) s += ` ${d.getFullYear()}`;
  return weekday ? `${WEEKDAYS[d.getDay()]}, ${s}` : s;
}

export const monthStr = (ts) => {
  const d = new Date(ts);
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

export const timeStr = (ts) => {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function agoStr(ts) {
  const dayStart = (t) => new Date(t).setHours(0, 0, 0, 0);
  const n = Math.round((dayStart(Date.now()) - dayStart(ts)) / 864e5);
  if (n <= 0) return 'сегодня';
  if (n === 1) return 'вчера';
  return `${n} ${plural(n, 'день', 'дня', 'дней')} назад`;
}

export function durStr(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}
