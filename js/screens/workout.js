// Экран тренировки. Два состояния:
//   упражнение — таблица «прошлый раз / сегодня / Δ», прогресс до прошлого результата, панель ввода;
//   выбор     — итог только что законченного упражнения (и группы, если она закончилась) и выбор следующего.

import {
  state,
  activeWorkout,
  saveWorkout,
  removeWorkout,
  exById,
  groupById,
  groupOf,
  workoutOrder,
  workoutTitle,
  setNote,
  setSetting,
} from '../store.js';
import { GROUPS } from '../program.js';
import { groupCard } from './parts.js';
import * as S from '../stats.js';
import { esc, icon, toast, hideToast, openSheet, closeSheet, numpad, haptic, keepAwake } from '../ui.js';
import { num, signed, pct, deltaClass, plural, setStr, setsStr, dateStr, durStr } from '../format.js';
import { renderInput, mountInput, clampField, VARIANTS } from '../input.js';
import { go, render, rerender } from '../router.js';

let draft = null; // значения в панели ввода для следующего подхода: { key, w, r }
let gapState = null; // для подсказки «≈ N повт. по W кг», которая меняется вместе с весом
let lastRecordAt = 0;
let clock = null;
let recent = null; // только что записанный подход, пока его можно отменить: { entry, set, until }
let recentTimer = null;

const UNDO_MS = 6000;

function current() {
  const workout = activeWorkout();
  if (!workout) return null;
  return { workout, order: workoutOrder(workout), entry: workout.entries.find((e) => !e.finishedAt) || null };
}

// Сколько упражнений группы уже начато в этой тренировке
const doneInGroup = (workout, gid) => workout.entries.filter((e) => groupOf(e) === gid).length;

const persist = (w) => saveWorkout(w).catch((e) => toast('Не удалось сохранить: ' + e.message));

function draftFor(workout, entry, prevSets, ex) {
  const key = `${workout.id}:${entry.startedAt}:${entry.sets.length}`;
  if (draft?.key !== key) draft = { key, ...S.prefill(entry.sets, prevSets, ex) };
  return draft;
}

const delta = (v, suffix = '') => `<span class="${deltaClass(v)}">${signed(v)}${suffix}</span>`;

function prevLine(workout, exId) {
  const prev = S.findPrev(state.workouts, exId, workout);
  if (!prev) return 'ещё не делал';
  return `${dateStr(prev.workout.startedAt)}: ${setsStr(prev.entry.sets, exById(exId))}`;
}

// ——— Шапка ———

function top(workout, order, focusGid) {
  const byEx = new Map(workout.entries.map((e) => [e.exId, e]));
  const chips = order
    .map((gid) => {
      const g = groupById(gid);
      const dots = g.exercises
        .map((id) => {
          const e = byEx.get(id);
          return `<i class="dot ${e ? (e.finishedAt ? 'done' : 'cur') : ''}"></i>`;
        })
        .join('');
      const complete = g.exercises.every((id) => byEx.get(id)?.finishedAt);
      return `<div class="gchip ${gid === focusGid ? 'on' : ''} ${complete ? 'complete' : ''}">${esc(g.name)}<span class="dots">${dots}</span></div>`;
    })
    .join('');
  return `<header class="top wbar">
      <button class="icon-btn" data-a="home" aria-label="На главную">${icon.back}</button>
      <div class="wbar-mid"><div class="wbar-day">${esc(workoutTitle(workout))}</div><div class="wbar-time" id="elapsed">${durStr(Date.now() - workout.startedAt)}</div></div>
      <button class="icon-btn" data-a="menu" aria-label="Меню">${icon.more}</button>
    </header>
    <div class="gbar">${chips}</div>`;
}

// ——— Упражнение ———

function repsHint(left, w, ex) {
  const perRep = w * (ex.mult || 1);
  return perRep > 0 ? `≈ ${Math.ceil(left / perRep)} повт. по ${num(w)} кг` : '';
}

function gapBlock(entry, prevSets, ex, weight) {
  const cur = S.summarize(entry.sets, ex);
  gapState = null;
  if (!prevSets) {
    const today = cur.sets ? `Сегодня: ${cur.sets} подх. · ${cur.reps} повт.${cur.volume ? ` · ${num(cur.volume)} кг` : ''}` : '';
    return `<section class="gap"><div class="gap-line">Первый раз — сравнивать пока не с чем.</div>${today ? `<div class="gap-mini">${today}</div>` : ''}</section>`;
  }
  const prev = S.summarize(prevSets, ex);
  const g = S.gap(cur, prev, weight, ex);
  const unit = g.byVolume ? 'кг' : 'повт.';
  let line;
  if (g.left < 0) line = `<span class="up">Прошлый раз побит: +${num(-g.left)} ${unit}</span>`;
  else if (g.left === 0) line = 'Ровно как в прошлый раз';
  else {
    line = `Осталось <b class="num">${num(g.left)} ${unit}</b>`;
    if (g.byVolume) {
      gapState = { left: g.left, ex };
      line += ` <span class="gap-reps" id="gap-reps">${repsHint(g.left, weight, ex)}</span>`;
    }
  }
  const mini = [
    `подходы ${cur.sets}/${prev.sets}`,
    `повторы ${cur.reps}/${prev.reps}`,
    prev.maxW || cur.maxW ? `макс. ${num(cur.maxW)}/${num(prev.maxW)} кг` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `<section class="gap ${g.left < 0 ? 'win' : ''}">
    <div class="gap-top"><span>${g.byVolume ? 'Тоннаж' : 'Повторения'}</span><span class="num"><b>${num(g.done)}</b> / ${num(g.target)} ${unit}</span></div>
    <div class="bar"><i style="width:${Math.min(100, g.ratio * 100)}%"></i></div>
    <div class="gap-line">${line}</div>
    <div class="gap-mini num">${mini}</div>
  </section>`;
}

function renderExercise({ workout, order, entry }) {
  const ex = exById(entry.exId);
  const gid = groupOf(entry);
  const group = groupById(gid);
  const prev = S.findPrev(state.workouts, entry.exId, workout);
  const prevSets = prev?.entry.sets || null;
  const d = draftFor(workout, entry, prevSets, ex);
  const i = entry.sets.length;
  const target = prevSets?.[i] || null;
  const note = state.notes[entry.exId];

  const tags = [];
  if (ex.mult === 2) tags.push('вес на одну руку · тоннаж ×2');
  if (ex.bw) tags.push('вводится доп. вес');
  tags.push(`шаг ${num(ex.step)} кг`);

  const head = `<section class="ex-head">
    <div class="ex-kicker">${esc(group.name)} · ${doneInGroup(workout, gid)} из ${group.exercises.length}</div>
    <h1 class="ex-name">${esc(ex.name)}</h1>
    <div class="ex-tags">${tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    <button class="note-btn ${note ? 'has' : ''}" data-a="note">${icon.note}<span>${note ? esc(note) : 'Заметка к упражнению'}</span></button>
    ${prev?.entry.note ? `<div class="prev-note">В прошлый раз: «${esc(prev.entry.note)}»</div>` : ''}
    ${entry.note ? `<div class="prev-note">Сегодня: «${esc(entry.note)}»</div>` : ''}
  </section>`;

  // Сколько подходов запланировано: как в прошлый раз, а в первый раз — по программе.
  // Подходы сверх этого подсвечиваются отдельно.
  const planned = prevSets ? prevSets.length : ex.sets;
  const extra = i >= planned ? i - planned + 1 : 0;
  const n = Math.max(planned, i + 1);
  let rows = '';
  for (let k = 0; k < n; k++) {
    const p = prevSets?.[k];
    const c = entry.sets[k];
    const prevCell = p ? setStr(p, ex) : prevSets || k >= planned ? '—' : `${ex.reps} повт.`;
    let nowCell = '';
    let dCell = '';
    if (c) {
      nowCell = setStr(c, ex);
      if (p) {
        const dw = ex.bw && !c.w && !p.w ? '' : `<div>${delta(S.round2(c.w - p.w), ' кг')}</div>`;
        dCell = dw + `<div>${delta(c.r - p.r, ' пов')}</div>`;
      }
    } else if (k === i) {
      nowCell = '<span class="now-mark">сейчас</span>';
    }
    const cls = c ? 'done' : k === i ? `next${extra ? ' extra' : ''}` : 'future';
    rows += `<tr class="${cls}"><td class="c-n">${k + 1}</td><td class="c-p num">${prevCell}</td><td class="c-c num">${nowCell}</td><td class="c-d num">${dCell}</td></tr>`;
  }
  const prevHead = prev ? `Прошлый раз<small>${dateStr(prev.workout.startedAt)}</small>` : 'План<small>первый раз</small>';
  const table = `<table class="sets"><thead><tr><th class="c-n">#</th><th>${prevHead}</th><th>Сегодня</th><th class="c-d">Δ</th></tr></thead><tbody>${rows}</tbody></table>`;

  const ready = i >= planned;
  const finishBtn = i
    ? `<button class="btn-finish ${ready ? 'is-ready' : ''}" data-a="finish-ex">Закончить ${icon.arrow}</button>`
    : `<button class="btn-finish" data-a="finish-ex">${icon.swap} Другое</button>`;

  // Сразу после записи вместо «Подход N · было …» — «✓ 45×9  Отменить», потом возвращается обратно.
  const label = `Подход <b>${i + 1}</b>${target ? ` · было <b class="num">${setStr(target, ex)}</b>` : ''}`;
  const undoable = recent?.entry === entry && Date.now() < recent.until;
  const undoLabel = undoable
    ? `<span class="rec-ok">${icon.check}<b class="num">${setStr(recent.set, ex)}</b></span><button class="undo" data-a="undo">Отменить</button>`
    : '';

  const panel = `<footer class="panel">
    <div class="panel-top">
      <div class="panel-label" id="panel-label" data-normal="${esc(label)}">${undoable ? undoLabel : label}</div>
      ${finishBtn}
    </div>
    ${renderInput({ variant: state.settings.input, ex, draft: d, target, setNo: i + 1, extra })}
  </footer>`;

  return top(workout, order, gid) + `<main class="body">${head}${table}${gapBlock(entry, prevSets, ex, d.w)}</main>` + panel;
}

// ——— Выбор следующего ———

function doneCard(workout, e) {
  const ex = exById(e.exId);
  const cur = S.summarize(e.sets, ex);
  const prev = S.findPrev(state.workouts, e.exId, workout);
  const c = S.compare(cur, prev ? S.summarize(prev.entry.sets, ex) : null);
  const md = (v, suffix = '') => (c ? `<div class="m-d num ${deltaClass(v)}">${signed(v)}${suffix}</div>` : '');
  const m = (label, value, d) => `<div class="m"><div class="m-l">${label}</div><div class="m-v num">${value}</div>${d}</div>`;
  const volD = c
    ? `<div class="m-d num ${deltaClass(c.volume)}">${signed(c.volume)} кг${c.volumePct != null ? ` · ${pct(c.volumePct)}` : ''}</div>`
    : '';
  return `<section class="done-card">
    <div class="done-title">${icon.check}<span>${esc(ex.name)}</span></div>
    <div class="done-sets num">${setsStr(e.sets, ex)}</div>
    <div class="metrics">
      ${m(ex.bw ? 'Макс. доп. вес' : 'Макс. вес', `${num(cur.maxW)} кг`, md(c?.maxW, ' кг'))}
      ${m('Подходы', cur.sets, md(c?.sets))}
      ${m('Повторения', cur.reps, md(c?.reps))}
      ${m('Тоннаж', `${num(cur.volume)} кг`, volD)}
    </div>
    <div class="done-foot"><span>${prev ? `по сравнению с ${dateStr(prev.workout.startedAt)}` : 'первый раз — сравнивать не с чем'}</span>
      <button class="link" data-a="reopen">Вернуться</button></div>
  </section>`;
}

const optBtn = (workout, exId, gid) =>
  `<button class="opt" data-a="start" data-ex="${exId}" data-group="${gid}">
    <div class="opt-name">${esc(exById(exId).name)}</div>
    <div class="opt-prev num">${prevLine(workout, exId)}</div>
  </button>`;

// Крупный блок при переходе к новой группе мышц: что в ней предстоит.
function nextGroupBlock(left, order, first) {
  const g = left.group;
  const sets = g.exercises.reduce((n, id) => n + exById(id).sets, 0);
  return `<section class="group-next">
    <div class="kicker">${first ? 'Первая группа' : 'Следующая группа'} · ${left.index + 1} из ${order.length}</div>
    <h2 class="group-next-name">${esc(g.name)}</h2>
    <div class="group-next-meta">${g.exercises.length} ${plural(g.exercises.length, 'упражнение', 'упражнения', 'упражнений')} · ${sets} ${plural(sets, 'подход', 'подхода', 'подходов')}</div>
    <ol class="group-next-list">${g.exercises
      .map((id) => `<li><span>${esc(exById(id).name)}</span><span class="num">${exById(id).sets}×${exById(id).reps}</span></li>`)
      .join('')}</ol>
  </section>`;
}

function renderChooser({ workout, order }) {
  const last = workout.entries.at(-1);
  const lastGid = last ? groupOf(last) : null;
  const left = S.planLeft(order, GROUPS, workout);
  const groupChanged = !left || left.gid !== lastGid;
  let html = last ? doneCard(workout, last) : '';

  // Группа закончилась — её итог и сравнение с прошлым разом этой же группы
  if (last && groupChanged) html += groupCard(workout, lastGid, { exercises: false, done: true });

  if (!left) {
    html += `<div class="section-label">Все упражнения сделаны</div>
      <button class="btn btn-primary big" data-a="finish-workout">${icon.check} Завершить тренировку</button>`;
  } else {
    const [next, ...others] = left.left;
    if (groupChanged) {
      html += nextGroupBlock(left, order, !last);
      html += `<div class="section-label">С чего начнём</div>`;
    } else {
      html += `<div class="section-label"><span>Дальше · ${esc(left.group.name)}</span><span>${doneInGroup(workout, left.gid) + 1} из ${left.group.exercises.length}</span></div>`;
    }
    html += `<button class="next-btn" data-a="start" data-ex="${next}" data-group="${left.gid}">
        <div class="next-name">${esc(exById(next).name)}</div>
        <div class="next-prev num">${prevLine(workout, next)}</div>
        <div class="next-go">Начать ${icon.arrow}</div>
      </button>`;
    if (others.length) {
      html += `<button class="btn btn-ghost alt-btn" data-a="toggle" data-list="others">${icon.swap} Другое из группы · ${others.length}</button>
        <div class="opt-list" id="list-others" hidden>${others.map((id) => optBtn(workout, id, left.gid)).join('')}</div>`;
    }
  }
  return top(workout, order, left ? left.gid : null) + `<main class="body chooser">${html}</main>`;
}

// ——— Действия ———

function startExercise(exId, group) {
  const c = current();
  if (!c || c.entry) return;
  c.workout.entries.push({ exId, group, startedAt: Date.now(), finishedAt: null, sets: [], note: '' });
  draft = null;
  hideToast();
  render();
  persist(c.workout);
}

function finishExercise() {
  const c = current();
  if (!c?.entry) return;
  if (c.entry.sets.length) c.entry.finishedAt = Date.now();
  else c.workout.entries = c.workout.entries.filter((e) => e !== c.entry);
  draft = null;
  hideToast();
  render();
  persist(c.workout);
}

function reopen() {
  const w = activeWorkout();
  const last = w?.entries.at(-1);
  if (!last?.finishedAt) return;
  last.finishedAt = null;
  render();
  persist(w);
}

function record(w, r) {
  const now = Date.now();
  if (now - lastRecordAt < 700) return; // защита от двойного тапа
  const c = current();
  if (!c?.entry) return;
  lastRecordAt = now;
  const set = { w: clampField('w', w), r: clampField('r', r), t: now };
  c.entry.sets.push(set);
  recent = { entry: c.entry, set, until: now + UNDO_MS };
  haptic();
  rerender();
  persist(c.workout);
}

// Отмена только что записанного подхода (на случай промаха) — несколько секунд после записи.
function undo() {
  const c = current();
  if (!recent || recent.entry !== c?.entry || c.entry.sets.at(-1) !== recent.set) return;
  const { workout, entry } = c;
  const set = entry.sets.pop();
  recent = null;
  draft = { key: `${workout.id}:${entry.startedAt}:${entry.sets.length}`, w: set.w, r: set.r };
  rerender();
  persist(workout);
}

async function editField(field) {
  const c = current();
  if (!c?.entry) return;
  const ex = exById(c.entry.exId);
  const v = await numpad({
    title: field === 'w' ? (ex.bw ? 'Дополнительный вес' : ex.mult === 2 ? 'Вес на одну руку' : 'Вес') : 'Повторения',
    value: draft[field],
    unit: field === 'w' ? 'кг' : 'повт.',
    decimal: field === 'w',
  });
  if (v == null) return;
  draft[field] = clampField(field, v);
  rerender();
}

function menu() {
  const v = state.settings.input;
  openSheet(`<div class="sheet-title">Тренировка</div>
    <div class="field-label">Ввод подходов</div>
    <div class="seg">${VARIANTS.map((x) => `<button class="${x.id === v ? 'on' : ''}" data-a="set-input" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <p class="hint">${VARIANTS.find((x) => x.id === v)?.hint || ''}</p>
    <div class="sheet-actions">
      <button class="btn btn-secondary" data-a="finish-workout">Завершить тренировку</button>
      <button class="btn btn-ghost danger" data-a="delete-workout">Удалить тренировку</button>
    </div>`);
}

function noteSheet() {
  const c = current();
  if (!c?.entry) return;
  const e = c.entry;
  openSheet(`<div class="sheet-title">${esc(exById(e.exId).name)}</div>
    <label class="field-label" for="note-perm">Постоянная — видна каждый раз</label>
    <textarea id="note-perm" rows="2" placeholder="Например: сиденье на 4, узкий хват">${esc(state.notes[e.exId] || '')}</textarea>
    <label class="field-label" for="note-today">Только к сегодняшнему разу</label>
    <textarea id="note-today" rows="2" placeholder="Например: болело плечо">${esc(e.note || '')}</textarea>
    <button class="btn btn-primary big" data-a="save-note">Сохранить</button>`);
}

async function saveNote() {
  const c = current();
  if (!c?.entry) return;
  const perm = document.getElementById('note-perm').value.trim();
  c.entry.note = document.getElementById('note-today').value.trim();
  closeSheet();
  rerender();
  await Promise.all([setNote(c.entry.exId, perm), persist(c.workout)]);
}

async function finishWorkout() {
  closeSheet();
  const w = activeWorkout();
  if (!w) return;
  const done = w.entries.filter((e) => e.sets.length);
  if (!done.length) {
    if (confirm('Ни одного подхода не записано. Удалить эту тренировку?')) {
      await removeWorkout(w);
      go('');
    }
    return;
  }
  const used = new Set(done.map((e) => e.exId));
  const leftCount = workoutOrder(w)
    .flatMap((gid) => groupById(gid).exercises)
    .filter((id) => !used.has(id)).length;
  if (leftCount && !confirm(`Не сделано упражнений: ${leftCount}. Всё равно завершить?`)) return;
  const now = Date.now();
  w.entries = done;
  for (const e of w.entries) e.finishedAt ||= now;
  w.finishedAt = now;
  draft = null;
  await persist(w);
  go(`summary/${w.id}/new`);
}

async function deleteWorkout() {
  closeSheet();
  const w = activeWorkout();
  if (!w || !confirm('Удалить текущую тренировку со всеми подходами?')) return;
  await removeWorkout(w);
  draft = null;
  go('');
}

export default {
  render() {
    const c = current();
    if (!c) return '<main class="body"></main>';
    return c.entry ? renderExercise(c) : renderChooser(c);
  },

  mount(root) {
    const c = current();
    if (!c) {
      go('', { replace: true });
      return;
    }
    keepAwake(true);
    clearInterval(clock);
    clock = setInterval(() => {
      const el = document.getElementById('elapsed');
      const w = activeWorkout();
      if (el && w) el.textContent = durStr(Date.now() - w.startedAt);
    }, 15000);
    clearTimeout(recentTimer);
    if (recent?.entry === c.entry && recent.until > Date.now()) {
      // После записи показываем «сколько осталось» — на маленьком экране он может быть ниже панели
      root.querySelector('.gap')?.scrollIntoView({ block: 'nearest' });
      recentTimer = setTimeout(() => {
        const el = document.getElementById('panel-label');
        if (el) el.innerHTML = el.dataset.normal;
        recent = null;
      }, recent.until - Date.now());
    }
    if (c.entry) {
      mountInput(root.querySelector('.panel'), { ex: exById(c.entry.exId) }, {
        get: () => draft,
        set(field, v) {
          draft[field] = v;
          const el = document.getElementById('gap-reps');
          if (field === 'w' && el && gapState) el.textContent = repsHint(gapState.left, v, gapState.ex);
        },
        pad: editField,
      });
    }
  },

  unmount() {
    keepAwake(false);
    clearInterval(clock);
    clearTimeout(recentTimer);
    recent = null;
    hideToast();
  },

  actions: {
    home: () => go(''),
    menu,
    'set-input'(el) {
      setSetting('input', el.dataset.v);
      closeSheet();
      rerender();
    },
    'finish-workout': finishWorkout,
    'delete-workout': deleteWorkout,
    start: (el) => startExercise(el.dataset.ex, el.dataset.group),
    toggle(el) {
      const list = document.getElementById('list-' + el.dataset.list);
      list.hidden = !list.hidden;
      el.classList.toggle('on', !list.hidden);
      if (!list.hidden) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    reopen,
    'finish-ex': finishExercise,
    undo,
    record: () => record(draft.w, draft.r),
    'rec-r': (el) => record(draft.w, Number(el.dataset.r)),
    async 'rec-other'() {
      const r = await numpad({ title: 'Повторения', value: draft.r, unit: 'повт.' });
      if (r) record(draft.w, r);
    },
    pad: (el) => editField(el.dataset.field),
    note: noteSheet,
    'save-note': saveNote,
  },
};
