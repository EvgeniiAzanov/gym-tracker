// Состояние в памяти + запись в IndexedDB. Все данные грузятся целиком при старте —
// даже за несколько лет тренировок это сотни килобайт.

import * as db from './db.js';
import { DAYS, EXERCISES, GROUPS } from './program.js';

export const state = {
  workouts: [],
  notes: {}, // exId → постоянная заметка (настройки тренажёра и т.п.)
  settings: { input: 'A' },
  lastBackupAt: null,
};

const byStart = (a, b) => a.startedAt - b.startedAt;

export async function load() {
  const { workouts, kv } = await db.loadAll();
  state.workouts = workouts.sort(byStart);
  state.notes = kv.notes || {};
  state.settings = { input: 'A', ...(kv.settings || {}) };
  state.lastBackupAt = kv.lastBackupAt || null;
}

export const exById = (id) => EXERCISES[id] || { name: id, step: 2.5, sets: 3, reps: 10, missing: true };
export const dayById = (id) => DAYS.find((d) => d.id === id) || { id, groups: [] };
export const groupById = (id) =>
  GROUPS[id] || { name: id === 'other' ? 'Не из программы' : id, exercises: [], missing: true };

// Группа упражнения в тренировке: запоминается при старте упражнения,
// для старых записей — ищется в программе.
export const groupOf = (entry) =>
  entry.group || Object.keys(GROUPS).find((g) => GROUPS[g].exercises.includes(entry.exId)) || 'other';

// Порядок групп конкретной тренировки (выбирается перед стартом).
export const workoutOrder = (w) => w.groupOrder || dayById(w.dayId).groups;

export const titleOf = (order) => order.map((g) => groupById(g).name).join(' + ');
export const dayTitle = (day) => titleOf(day.groups);
export const workoutTitle = (w) => titleOf(workoutOrder(w));

export const activeWorkout = () => state.workouts.find((w) => !w.finishedAt) || null;
export const finishedWorkouts = () => state.workouts.filter((w) => w.finishedAt);

export async function saveWorkout(w) {
  if (!state.workouts.includes(w)) {
    state.workouts.push(w);
    state.workouts.sort(byStart);
  }
  await db.putWorkout(w);
}

export async function removeWorkout(w) {
  state.workouts = state.workouts.filter((x) => x !== w);
  await db.deleteWorkout(w.id);
}

export async function setNote(exId, text) {
  if (text) state.notes[exId] = text;
  else delete state.notes[exId];
  await db.setKV('notes', state.notes);
}

export async function setSetting(key, value) {
  state.settings[key] = value;
  await db.setKV('settings', state.settings);
}

export async function markBackup() {
  state.lastBackupAt = Date.now();
  await db.setKV('lastBackupAt', state.lastBackupAt);
}

export function exportData() {
  return {
    app: 'gymlog',
    format: 1,
    exportedAt: new Date().toISOString(),
    workouts: state.workouts,
    notes: state.notes,
    settings: state.settings,
  };
}

export function validateImport(data) {
  if (!data || data.app !== 'gymlog' || !Array.isArray(data.workouts)) {
    throw new Error('Это не резервная копия тренировок');
  }
  for (const w of data.workouts) {
    if (!w.id || !w.startedAt || !Array.isArray(w.entries)) throw new Error('Файл повреждён');
  }
  return data;
}

export async function importData(data) {
  const kv = { notes: data.notes || {}, settings: data.settings || state.settings, lastBackupAt: Date.now() };
  await db.replaceAll({ workouts: data.workouts, kv });
  await load();
}

export async function wipe() {
  await db.replaceAll({ workouts: [], kv: { settings: state.settings } });
  await load();
}
