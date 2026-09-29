import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/stats.js';
import { DAYS } from '../js/program.js';

const barbell = { step: 2.5 };
const dumbbells = { step: 2, mult: 2 };
const bodyweight = { step: 2, bw: true };

const set = (w, r, t = 0) => ({ w, r, t });
const workout = (id, startedAt, entries, extra = {}) => ({ id, dayId: 'd', startedAt, finishedAt: startedAt + 1, entries, ...extra });
const entry = (exId, sets, slot = exId) => ({ exId, slot, sets, finishedAt: 1 });

test('summarize: тоннаж, повторы, макс. вес', () => {
  const s = S.summarize([set(50, 10), set(45, 10), set(40, 8)], barbell);
  assert.deepEqual(s, { sets: 3, reps: 28, volume: 50 * 10 + 45 * 10 + 40 * 8, maxW: 50 });
});

test('summarize: гантели двумя руками — тоннаж ×2', () => {
  assert.equal(S.summarize([set(20, 10)], dumbbells).volume, 400);
});

test('summarize: собственный вес — тоннаж только от доп. веса', () => {
  assert.equal(S.summarize([set(0, 12), set(10, 8)], bodyweight).volume, 80);
});

test('compare: дельты и процент', () => {
  const c = S.compare({ sets: 3, reps: 27, volume: 2200, maxW: 82.5 }, { sets: 3, reps: 28, volume: 2000, maxW: 80 });
  assert.deepEqual(c, { sets: 0, reps: -1, maxW: 2.5, volume: 200, volumePct: 10 });
});

test('gap: осталось по тоннажу и сколько это повторов при текущем весе', () => {
  const prev = S.summarize([set(80, 10), set(80, 10), set(80, 8)], barbell); // 2240
  const cur = S.summarize([set(80, 10)], barbell); // 800
  const g = S.gap(cur, prev, 80, barbell);
  assert.equal(g.left, 1440);
  assert.equal(g.reps, 18);
  assert.equal(g.byVolume, true);
});

test('gap: побит — left отрицательный', () => {
  const prev = S.summarize([set(80, 10)], barbell);
  const cur = S.summarize([set(82.5, 10)], barbell);
  assert.equal(S.gap(cur, prev, 82.5, barbell).left, -25);
});

test('gap: собственный вес без доп. веса — считаем повторы', () => {
  const prev = S.summarize([set(0, 12), set(0, 10)], bodyweight);
  const cur = S.summarize([set(0, 12)], bodyweight);
  const g = S.gap(cur, prev, 0, bodyweight);
  assert.equal(g.byVolume, false);
  assert.equal(g.left, 10);
  assert.equal(g.reps, 10);
});

test('findPrev: последний раз, до текущей тренировки, пропуская пустые', () => {
  const w1 = workout('a', 100, [entry('x', [set(50, 10)])]);
  const w2 = workout('b', 200, [entry('y', [set(10, 10)])]);
  const w3 = workout('c', 300, [entry('x', [])]); // упражнение начато, но без подходов
  const cur = workout('d', 400, [entry('x', [set(55, 10)])], { finishedAt: null });
  const later = workout('e', 500, [entry('x', [set(60, 10)])]);
  const all = [w1, w2, w3, cur, later];
  assert.equal(S.findPrev(all, 'x', cur).workout.id, 'a');
  assert.equal(S.findPrev(all, 'x', null).workout.id, 'e');
  assert.equal(S.findPrev(all, 'z', cur), null);
});

test('findPrev: замена сравнивается со своей историей, а не со слотом', () => {
  const w1 = workout('a', 100, [entry('bench', [set(80, 10)])]);
  const w2 = workout('b', 200, [entry('db_bench', [set(30, 10)], 'bench')]);
  const cur = workout('c', 300, [], { finishedAt: null });
  assert.equal(S.findPrev([w1, w2, cur], 'bench', cur).workout.id, 'a');
  assert.equal(S.findPrev([w1, w2, cur], 'db_bench', cur).workout.id, 'b');
});

test('planLeft: по выбранному порядку групп, внутри группы — оставшиеся', () => {
  const groups = { a: { name: 'A', exercises: ['a1', 'a2'] }, b: { name: 'B', exercises: ['b1'] } };
  const w = { entries: [] };
  assert.equal(S.planLeft(['b', 'a'], groups, w).gid, 'b'); // порядок групп выбран перед стартом
  assert.deepEqual(S.planLeft(['a', 'b'], groups, w).left, ['a1', 'a2']);
  w.entries.push({ exId: 'a2' }); // сделал второе раньше первого
  assert.deepEqual(S.planLeft(['a', 'b'], groups, w).left, ['a1']);
  w.entries.push({ exId: 'a1' });
  const next = S.planLeft(['a', 'b'], groups, w);
  assert.equal(next.gid, 'b');
  assert.equal(next.index, 1);
  w.entries.push({ exId: 'b1' });
  assert.equal(S.planLeft(['a', 'b'], groups, w), null);
});

test('nextDayId: по кругу после последней завершённой', () => {
  const days = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
  assert.equal(S.nextDayId(days, []), 'd1');
  assert.equal(S.nextDayId(days, [{ dayId: 'd1', finishedAt: 1 }]), 'd2');
  assert.equal(S.nextDayId(days, [{ dayId: 'd3', finishedAt: 1 }]), 'd1');
  assert.equal(S.nextDayId(days, [{ dayId: 'd1', finishedAt: 1 }, { dayId: 'd2', finishedAt: null }]), 'd2');
});

test('prefill: первый подход — как первый подход прошлого раза', () => {
  const prev = [set(50, 10), set(45, 10), set(40, 8)];
  assert.deepEqual(S.prefill([], prev, barbell), { w: 50, r: 10 });
});

test('prefill: со второго подхода — как первый подход сегодня', () => {
  const prev = [set(50, 10), set(45, 10), set(40, 8)];
  assert.deepEqual(S.prefill([set(52.5, 9)], prev, barbell), { w: 52.5, r: 9 });
  assert.deepEqual(S.prefill([set(52.5, 9), set(50, 8)], prev, barbell), { w: 52.5, r: 9 });
});

test('prefill: первый раз — стартовый вес и план из программы', () => {
  assert.deepEqual(S.prefill([], null, { step: 2, start: 38, reps: 10 }), { w: 38, r: 10 });
  assert.deepEqual(S.prefill([], null, { step: 5, start: 0, reps: 12, bw: true }), { w: 0, r: 12 });
});

test('workoutStats: длительность до последнего подхода', () => {
  const w = workout('a', 1000, [entry('x', [set(50, 10, 5000), set(50, 10, 9000)])]);
  const st = S.workoutStats(w, () => barbell);
  assert.equal(st.volume, 1000);
  assert.equal(st.duration, 8000);
});

test('groupSummary / prevGroup: группа сравнивается сама с собой, в любой день', () => {
  const groupOf = (e) => e.group;
  const exOf = () => barbell;
  const e = (group, sets) => ({ exId: group + '_x', group, sets, finishedAt: 1 });
  const w1 = workout('a', 100, [e('chest', [set(50, 10)]), e('abs', [set(20, 10)])]);
  const w2 = workout('b', 200, [e('back', [set(60, 10)]), e('abs', [set(25, 10)])]); // другой день, тоже пресс
  const w3 = workout('c', 300, [e('chest', [set(55, 10)]), e('abs', [set(25, 12)])], { finishedAt: null });
  const all = [w1, w2, w3];
  assert.deepEqual(S.workoutGroups(w3, groupOf), ['chest', 'abs']);
  assert.equal(S.groupSummary(w3, 'chest', groupOf, exOf).volume, 550);
  assert.equal(S.prevGroup(all, 'chest', groupOf, w3).id, 'a');
  assert.equal(S.prevGroup(all, 'abs', groupOf, w3).id, 'b');
  assert.equal(S.prevGroup(all, 'legs', groupOf, w3), null);
});

test('программа: все упражнения групп и группы дней описаны, у каждого упражнения есть план', async () => {
  const { EXERCISES, GROUPS } = await import('../js/program.js');
  for (const day of DAYS) for (const gid of day.groups) assert.ok(GROUPS[gid], `нет группы ${gid}`);
  for (const [gid, g] of Object.entries(GROUPS)) {
    for (const id of g.exercises) {
      const ex = EXERCISES[id];
      assert.ok(ex, `нет упражнения ${id} (группа ${gid})`);
      for (const f of ['step', 'sets', 'reps', 'start']) assert.ok(typeof ex[f] === 'number', `${id}: нет ${f}`);
    }
  }
  const all = Object.values(GROUPS).flatMap((g) => g.exercises);
  assert.equal(all.length, new Set(all).size, 'упражнение в двух группах сразу');
});
