// Программа тренировок: упражнения → группы мышц → дни сплита.
//
// id (ключи объектов) — постоянные: к ним привязана история.
// Названия, веса, шаги, подходы менять можно, id — нельзя, иначе прошлые результаты «потеряются».
//
// Поля упражнения:
//   name  — название
//   start — вес для самого первого раза (дальше подставляется прошлый результат)
//   step  — шаг веса для кнопок −/+, кг
//   sets  — план подходов (показывается, пока упражнение ни разу не делалось)
//   reps  — план повторений
//   mult  — 2, если вес вводится на одну руку, а работают обе (гантели, кроссовер): тоннаж ×2
//   bw    — упражнение с собственным весом: вводится только доп. вес, тоннаж = доп. вес × повторы

export const EXERCISES = {
  // Грудь
  chest_db_press_15:      { name: 'Жим гантелей на лавке 15°', start: 38, step: 2, sets: 4, reps: 10, mult: 2 },
  chest_db_press_25:      { name: 'Жим гантелей на лавке 25°', start: 34, step: 2, sets: 4, reps: 10, mult: 2 },
  chest_db_press_35:      { name: 'Жим гантелей на лавке 35°', start: 30, step: 2, sets: 4, reps: 10, mult: 2 },
  chest_decline_machine:  { name: 'Жим в тренажёре сидя, отрицательный угол', start: 70, step: 1, sets: 3, reps: 12 },
  chest_db_raise_one_arm: { name: 'Подъём гантели стоя к центру груди, по одной руке', start: 16, step: 2, sets: 4, reps: 12 },
  chest_cable_fly:        { name: 'Сведение рук стоя в кроссовере', start: 15, step: 0.5, sets: 4, reps: 12, mult: 2 },
  chest_db_fly:           { name: 'Сведение рук лёжа на лавке с гантелями', start: 18, step: 2, sets: 4, reps: 12, mult: 2 },

  // Трицепс
  tri_machine_press:      { name: 'Жим в тренажёре сидя', start: 160, step: 10, sets: 6, reps: 12 },
  tri_french_press:       { name: 'Французский жим, EZ-гриф', start: 25, step: 1, sets: 4, reps: 12 },
  tri_pushdown:           { name: 'Жим блока стоя', start: 30, step: 1, sets: 4, reps: 12 },

  // Пресс
  abs_panatta_crunch:     { name: 'Скручивания в Panatta', start: 30, step: 5, sets: 6, reps: 12 },
  abs_bench_situp:        { name: 'Подъём корпуса на лавке', start: 0, step: 5, sets: 4, reps: 10, bw: true },

  // Экстензия
  back_extension:         { name: 'Экстензия', start: 20, step: 5, sets: 6, reps: 10, bw: true },

  // Ноги
  legs_extension:         { name: 'Подъём ног сидя в тренажёре', start: 45, step: 2.5, sets: 8, reps: 12 },
  legs_curl:              { name: 'Скручивание ног лёжа в тренажёре', start: 40, step: 2.5, sets: 8, reps: 10 },
  legs_press_deep:        { name: 'Жим платформы (глубокий)', start: 220, step: 10, sets: 6, reps: 12 },
  legs_press_power:       { name: 'Жим платформы (на силу)', start: 360, step: 10, sets: 4, reps: 10 },
  legs_calf_seated:       { name: 'Икры сидя (с прожимом)', start: 60, step: 5, sets: 6, reps: 12 },
  legs_glute_bridge:      { name: 'Ягодичный мост', start: 20, step: 5, sets: 6, reps: 12 },
  legs_abduction:         { name: 'Разведение ног сидя', start: 76, step: 2, sets: 6, reps: 12 },
  legs_adduction:         { name: 'Сведение ног сидя', start: 36, step: 2, sets: 6, reps: 12 },

  // Спина
  back_pulldown_technique: { name: 'Тяга блока сидя (техника)', start: 40, step: 5, sets: 6, reps: 12 },
  back_pulldown_power:     { name: 'Тяга блока сидя (сила)', start: 80, step: 5, sets: 4, reps: 10 },
  back_pulldown_wide:      { name: 'Тяга блока сидя, очень широкий хват', start: 60, step: 5, sets: 4, reps: 12 },
  back_pulldown_ergo:      { name: 'Тяга блока сидя, эргономичная ручка', start: 60, step: 1, sets: 4, reps: 12 },
  back_row_machine:        { name: 'Тяга в тренажёре сидя горизонтально', start: 80, step: 5, sets: 6, reps: 12 },
  back_row_one_arm:        { name: 'Тяга в тренажёре сидя к животу, по одной руке', start: 45, step: 5, sets: 6, reps: 12 },
  back_pulldown_narrow:    { name: 'Тяга блока сидя, узкая ручка', start: 60, step: 2, sets: 4, reps: 12 },

  // Плечи
  sh_db_press:            { name: 'Жим гантелей сидя', start: 24, step: 2, sets: 6, reps: 12, mult: 2 },
  sh_lateral_raise:       { name: 'Разведение гантелей сидя', start: 8, step: 1, sets: 6, reps: 12, mult: 2 },
  sh_rear_delt:           { name: 'Разведение гантелей в наклоне', start: 8, step: 1, sets: 4, reps: 10, mult: 2 },
  sh_upright_row:         { name: 'Тяга штанги стоя к подбородку', start: 50, step: 5, sets: 4, reps: 12 },

  // Бицепс
  bi_machine_curl:        { name: 'Бицепс в тренажёре сидя', start: 30, step: 2.5, sets: 6, reps: 12 },
  bi_hammer:              { name: 'Молотки с гантелями сидя', start: 16, step: 2, sets: 6, reps: 12, mult: 2 },
  bi_cable_curl:          { name: 'Тяга стоя в кроссовере', start: 10, step: 0.5, sets: 4, reps: 12, mult: 2 },
  bi_db_curl:             { name: 'Подъём гантелей стоя', start: 16, step: 2, sets: 4, reps: 12, mult: 2 },

  // Предплечье
  forearm_db_curl:        { name: 'Подъёмы на предплечье с гантелями', start: 10, step: 2, sets: 4, reps: 12, mult: 2 },
};

// Группа мышц — набор упражнений. Все обязательные, порядок внутри группы можно менять на ходу.
export const GROUPS = {
  chest: {
    name: 'Грудь',
    exercises: [
      'chest_db_press_15',
      'chest_db_press_25',
      'chest_db_press_35',
      'chest_decline_machine',
      'chest_db_raise_one_arm',
      'chest_cable_fly',
      'chest_db_fly',
    ],
  },
  triceps: { name: 'Трицепс', exercises: ['tri_machine_press', 'tri_french_press', 'tri_pushdown'] },
  abs: { name: 'Пресс', exercises: ['abs_panatta_crunch', 'abs_bench_situp'] },
  extension: { name: 'Экстензия', exercises: ['back_extension'] },
  legs: {
    name: 'Ноги',
    exercises: [
      'legs_extension',
      'legs_curl',
      'legs_press_deep',
      'legs_press_power',
      'legs_calf_seated',
      'legs_glute_bridge',
      'legs_abduction',
      'legs_adduction',
    ],
  },
  back: {
    name: 'Спина',
    exercises: [
      'back_pulldown_technique',
      'back_pulldown_power',
      'back_pulldown_wide',
      'back_pulldown_ergo',
      'back_row_machine',
      'back_row_one_arm',
      'back_pulldown_narrow',
    ],
  },
  shoulders: { name: 'Плечи', exercises: ['sh_db_press', 'sh_lateral_raise', 'sh_rear_delt', 'sh_upright_row'] },
  biceps: { name: 'Бицепс', exercises: ['bi_machine_curl', 'bi_hammer', 'bi_cable_curl', 'bi_db_curl'] },
  forearms: { name: 'Предплечье', exercises: ['forearm_db_curl'] },
};

// Дни сплита идут по кругу. groups — порядок групп по умолчанию, перед стартом его можно поменять.
export const DAYS = [
  { id: 'day1', groups: ['chest', 'triceps', 'abs'] },
  { id: 'day2', groups: ['extension', 'legs'] },
  { id: 'day3', groups: ['abs', 'back'] },
  { id: 'day4', groups: ['shoulders', 'biceps', 'forearms', 'extension'] },
];
