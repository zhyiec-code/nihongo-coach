// 各语言共用的课程结构；每种语言的内容在 langs/ 下
import ja from './langs/ja.js';
import it from './langs/it.js';
import zh from './langs/zh.js';

export const LANGS = { ja, it, zh };
export const LANG_IDS = Object.keys(LANGS);

export const TOTAL_WEEKS = 26;
export const DAYS_PER_WEEK = 7; // 第 7 天为周复盘 + 口语评估

// 每天 60 分钟的时间分配（分钟），按阶段调整：越往后口语输出占比越高
export function dailySteps(unit, level) {
  if (unit.kana) {
    return [
      { id: 'review', name: '间隔复习', min: 10 },
      { id: 'kana', name: '假名训练', min: 20 },
      { id: 'phrases', name: '今日句型', min: 15 },
      { id: 'shadow', name: '听力跟读', min: 10 },
      { id: 'summary', name: '今日总结', min: 5 },
    ];
  }
  if (level <= 2) {
    return [
      { id: 'review', name: '间隔复习', min: 10 },
      { id: 'phrases', name: '今日句型', min: 15 },
      { id: 'shadow', name: '听力跟读', min: 15 },
      { id: 'chat', name: 'AI 情景对话', min: 15 },
      { id: 'summary', name: '纠错总结', min: 5 },
    ];
  }
  if (level <= 3) {
    return [
      { id: 'review', name: '间隔复习', min: 10 },
      { id: 'phrases', name: '今日句型', min: 10 },
      { id: 'shadow', name: '听力跟读', min: 10 },
      { id: 'chat', name: 'AI 情景对话', min: 25 },
      { id: 'summary', name: '纠错总结', min: 5 },
    ];
  }
  return [
    { id: 'review', name: '间隔复习', min: 5 },
    { id: 'phrases', name: '今日表达', min: 10 },
    { id: 'shadow', name: '听力跟读', min: 10 },
    { id: 'chat', name: 'AI 情景对话', min: 30 },
    { id: 'summary', name: '纠错总结', min: 5 },
  ];
}

export const WEEKLY_STEPS = [
  { id: 'review', name: '本周复习', min: 20 },
  { id: 'chat', name: '周口语测评', min: 30 },
  { id: 'summary', name: '测评报告', min: 10 },
];
