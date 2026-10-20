import { normalizeConfig } from './timer.js';

export const STORAGE_KEY = 'pace-routines-v2';
export const LEGACY_STORAGE_KEY = 'pace-routine-v1';
export const DEFAULT_EXERCISES = [
  { id: 'hold', name: '유지 운동', config: { work: 30, rest: 45, sets: 3, prepare: 0 } },
  { id: 'tabata', name: '타바타', config: { work: 20, rest: 10, sets: 8, prepare: 0 } },
  { id: 'stretch', name: '스트레칭', config: { work: 45, rest: 15, sets: 4, prepare: 0 } },
];

function read(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function loadPreferences(storage) {
  const exercises = DEFAULT_EXERCISES.map(exercise => ({ ...exercise, config: { ...exercise.config } }));
  const state = { version: 2, activeExercise: 'hold', exercises, sound: true, keepAwake: true };
  const saved = read(storage, STORAGE_KEY);
  if (saved?.version === 2) {
    const seen = new Set();
    for (const exercise of Array.isArray(saved.exercises) ? saved.exercises.slice(0, 50) : []) {
      if (!exercise || typeof exercise !== 'object' || typeof exercise.id !== 'string' || seen.has(exercise.id)) continue;
      if (!/^(hold|tabata|stretch|exercise-[a-z0-9-]+)$/.test(exercise.id)) continue;
      if (!exercise.config || typeof exercise.config !== 'object' || Array.isArray(exercise.config)) continue;
      seen.add(exercise.id);
      const existing = exercises.find(entry => entry.id === exercise.id);
      if (existing) existing.config = normalizeConfig({ ...existing.config, ...exercise.config });
      else if (typeof exercise.name === 'string' && exercise.name.trim()) exercises.push({
        id: exercise.id,
        name: exercise.name.trim().slice(0, 40),
        config: normalizeConfig(exercise.config),
      });
    }
    if (exercises.some(exercise => exercise.id === saved.activeExercise)) state.activeExercise = saved.activeExercise;
    state.sound = saved.sound !== false;
    state.keepAwake = saved.keepAwake !== false;
  } else {
    const legacy = read(storage, LEGACY_STORAGE_KEY);
    if (legacy) {
      if (legacy.config && typeof legacy.config === 'object' && !Array.isArray(legacy.config)) {
        const config = normalizeConfig(legacy.config);
        const selected = exercises.find(exercise => ['work', 'rest', 'sets'].every(key => exercise.config[key] === config[key])) || exercises[0];
        selected.config = config;
        state.activeExercise = selected.id;
      }
      state.sound = legacy.sound !== false;
    }
  }
  return state;
}

export function savePreferences(storage, state) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function currentExercise(state) {
  return state.exercises.find(exercise => exercise.id === state.activeExercise) || state.exercises[0];
}
