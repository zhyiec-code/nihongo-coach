// 本地存储 + 间隔重复（SRS）+ 课程进度
import { UNITS, PRACTICE_UNITS, START_UNIT, TOTAL_WEEKS, DAYS_PER_WEEK } from './data.js';

const KEY = 'nihongo-coach-v1';
const DAY_MS = 86400000;

const defaults = () => ({
  settings: { apiKey: '', model: 'claude-opus-5-5', ttsRate: 0.9, showReading: true },
  profile: null, // { level, placement: {...}, startedAt }
  progress: { day: 1, completed: {}, weekScores: {} },
  cards: [],
  lessons: {},
  log: {}, // 'YYYY-MM-DD' -> 分钟数
  dict: {}, // 点词查询缓存：'词|句子' -> 解释
});

let state;
try {
  state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {
  state = defaults();
}

export const S = () => state;
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存失败', e);
  }
}
export function resetAll() {
  state = defaults();
  save();
}
export function exportData() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.apiKey = '';
  return JSON.stringify(copy, null, 2);
}
export function importData(text) {
  const data = JSON.parse(text);
  const key = state.settings.apiKey;
  state = Object.assign(defaults(), data);
  if (!state.settings.apiKey) state.settings.apiKey = key;
  save();
}

// ---------- 课程进度 ----------
export const TOTAL_DAYS = TOTAL_WEEKS * DAYS_PER_WEEK;

export function unitForWeek(week) {
  const idx = START_UNIT[state.profile?.level ?? 0] + week - 1;
  if (idx < UNITS.length) return { ...UNITS[idx], index: idx };
  const p = PRACTICE_UNITS[(idx - UNITS.length) % PRACTICE_UNITS.length];
  return { ...p, index: idx };
}

// 当前单元对应的难度等级（随课程推进而提升）
export function levelForUnit(unit) {
  const i = unit.index;
  if (i < 2) return 0;
  if (i < 6) return 1;
  if (i < 12) return 2;
  if (i < 18) return 3;
  if (i < 24) return 4;
  return 5;
}

export function dayInfo(day = state.progress.day) {
  const week = Math.ceil(day / DAYS_PER_WEEK);
  const dow = ((day - 1) % DAYS_PER_WEEK) + 1;
  const unit = unitForWeek(week);
  return { day, week, dow, unit, level: levelForUnit(unit), weekly: dow === DAYS_PER_WEEK };
}

export function completeDay(day, minutes) {
  state.progress.completed[day] = new Date().toISOString();
  if (day === state.progress.day) state.progress.day = Math.min(day + 1, TOTAL_DAYS + 1);
  logMinutes(minutes);
  save();
}

export function logMinutes(min) {
  const k = today();
  state.log[k] = (state.log[k] || 0) + Math.round(min);
  save();
}

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!state.log[today(d)]) d.setDate(d.getDate() - 1);
  while (state.log[today(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- SRS（简化版 SM-2）----------
// 卡片以“中文意思 → 说出日语”的方向复习，直接训练口语输出
export function addCards(list, source) {
  const have = new Set(state.cards.map((c) => c.ja));
  let added = 0;
  for (const c of list) {
    if (!c.ja || have.has(c.ja)) continue;
    have.add(c.ja);
    state.cards.push({
      id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
      ja: c.ja, reading: c.reading || '', zh: c.zh || '', note: c.note || '',
      source, ease: 2.5, interval: 0, reps: 0, due: Date.now(), lapses: 0,
    });
    added++;
  }
  save();
  return added;
}

export function dueCards(limit = 60) {
  const now = Date.now();
  return state.cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due).slice(0, limit);
}

// grade: 0 忘了 / 1 困难 / 2 记得 / 3 简单
export function gradeCard(id, grade) {
  const c = state.cards.find((x) => x.id === id);
  if (!c) return;
  if (grade === 0) {
    c.reps = 0;
    c.lapses++;
    c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = Date.now() + 10 * 60 * 1000;
  } else {
    if (grade === 1) {
      c.interval = Math.max(1, c.interval * 1.2);
      c.ease = Math.max(1.3, c.ease - 0.15);
    } else if (c.reps === 0) {
      c.interval = grade === 3 ? 3 : 1;
    } else if (c.reps === 1) {
      c.interval = grade === 3 ? 6 : 3;
    } else {
      c.interval = c.interval * c.ease * (grade === 3 ? 1.3 : 1);
    }
    if (grade === 3) c.ease += 0.15;
    c.reps++;
    c.due = Date.now() + c.interval * DAY_MS;
  }
  save();
}
