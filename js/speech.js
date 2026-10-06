// 日语朗读（speechSynthesis）与语音识别（SpeechRecognition）
import { S } from './store.js';

let jaVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('ja'));
  // 优先选择较自然的在线/高质量声音
  jaVoice = voices.find((v) => /natural|google|kyoko|o-ren|nanami/i.test(v.name)) || voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export const ttsSupported = 'speechSynthesis' in window;
export const hasJaVoice = () => !!jaVoice;

export function speak(text, rate) {
  if (!ttsSupported || !text) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = rate ?? S().settings.ttsRate;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = !!Rec;

// 录一句话，返回识别出的日语文本
export function listen() {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('当前浏览器不支持语音识别，请用 Chrome / Edge / Safari，或直接打字'));
    speechSynthesis.cancel();
    const r = new Rec();
    r.lang = 'ja-JP';
    r.interimResults = false;
    r.maxAlternatives = 3;
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve(Array.from(e.results[0]).map((a) => a.transcript));
    };
    r.onerror = (e) => {
      done = true;
      reject(new Error(e.error === 'not-allowed' ? '没有麦克风权限' : e.error === 'no-speech' ? '没听到声音，再试一次' : `识别出错：${e.error}`));
    };
    r.onend = () => {
      if (!done) resolve([]);
    };
    r.start();
  });
}

// 发音相似度：基于最长公共子序列，忽略标点与空格；对汉字/假名两种写法取较高分
const norm = (s) => (s || '').replace(/[\s、。！？!?,.「」『』（）()〜~ー…・]/g, '').toLowerCase();
function lcs(a, b) {
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}
export function similarity(heardList, targets) {
  let best = 0;
  for (const h of heardList) {
    for (const t of targets) {
      const a = norm(h), b = norm(t);
      if (!a || !b) continue;
      best = Math.max(best, (2 * lcs(a, b)) / (a.length + b.length));
    }
  }
  return Math.round(best * 100);
}
