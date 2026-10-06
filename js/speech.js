// 日语朗读（speechSynthesis）与语音识别（SpeechRecognition）
import { S } from './store.js';

let jaVoice = null;
let voiceCount = 0;
let lastError = '';
let current = null; // 持有引用，防止 Chrome 回收正在朗读的 utterance 导致中断
function pickVoice() {
  const all = speechSynthesis.getVoices();
  voiceCount = all.length;
  const voices = all.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  // 优先选择较自然的在线/高质量声音
  jaVoice = voices.find((v) => /natural|google|kyoko|o-ren|nanami/i.test(v.name)) || voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  // iPhone Safari 要求第一次朗读发生在用户点击里，这里在第一次触摸时“解锁”语音
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    document.removeEventListener('pointerdown', unlock, true);
  };
  document.addEventListener('pointerdown', unlock, true);
}

export const ttsSupported = 'speechSynthesis' in window;
export const hasJaVoice = () => !!jaVoice;

export function speak(text, rate) {
  if (!ttsSupported || !text) return Promise.resolve();
  if (!jaVoice) pickVoice(); // 安卓 Chrome 的语音列表是异步加载的
  const synth = speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  synth.resume(); // Chrome 偶尔会卡在暂停状态，导致之后都没声音
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = rate ?? S().settings.ttsRate;
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') lastError = e.error;
      finish();
    };
    current = u;
    // cancel 之后立刻 speak 在部分安卓 Chrome 上会被吞掉，稍等一下再说
    setTimeout(() => synth.speak(u), 60);
    setTimeout(finish, 8000 + text.length * 400);
  });
}

// 听不到声音时给用户看的诊断信息
export function ttsDiagnosis() {
  pickVoice();
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const lines = [];
  if (!ttsSupported) return '这个浏览器不支持语音朗读。安卓请用 Chrome，iPhone 请用 Safari。';
  lines.push(jaVoice ? `✅ 已找到日语语音：${jaVoice.name}` : `❌ 没有找到日语语音（共 ${voiceCount} 个语音）`);
  if (lastError) lines.push(`上次朗读出错：${lastError}`);
  if (!jaVoice) {
    lines.push(ios
      ? '请到「设置 → 辅助功能 → 朗读内容 → 声音 → 日语」下载一个日语声音。'
      : '请到手机「设置 → 系统 → 语言和输入法 → 文字转语音输出」，首选引擎选 Google，并在引擎设置里安装「日语」语音数据。');
  }
  lines.push(ios ? '另外请确认：手机侧面的静音开关已关闭，媒体音量已调大。' : '另外请确认：媒体音量已调大（按音量键时调的是“媒体”而不是铃声）。');
  return lines.join('\n');
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
