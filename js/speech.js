// 朗读（speechSynthesis）与语音识别（SpeechRecognition），语言跟随当前学习的语言
import { S, L } from './store.js';

let voice = null;
let voiceLang = '';
let voiceCount = 0;
let lastError = '';
let current = null; // 持有引用，防止 Chrome 回收正在朗读的 utterance 导致中断
function pickVoice() {
  const all = speechSynthesis.getVoices();
  voiceCount = all.length;
  const lang = L();
  voiceLang = lang.id;
  let voices = all.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.id));
  // 中文优先选普通话（zh-CN），而不是粤语或台湾腔
  if (lang.voicePrefer) {
    const preferred = voices.filter((v) => lang.voicePrefer.test(v.lang));
    if (preferred.length) voices = preferred;
  }
  // 优先选择较自然的在线/高质量声音
  voice = voices.find((v) => lang.voiceRe.test(v.name)) || voices[0] || null;
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
export const hasVoice = () => {
  if (voiceLang !== L().id) pickVoice();
  return !!voice;
};

export function speak(text, rate) {
  if (!ttsSupported || !text) return Promise.resolve();
  if (!voice || voiceLang !== L().id) pickVoice(); // 安卓 Chrome 的语音列表是异步加载的；切换语言后也要重选
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
    u.lang = L().bcp47;
    if (voice) u.voice = voice;
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
  const { name, voiceInstall } = L();
  lines.push(voice ? `✅ 已找到${name}语音：${voice.name}` : `❌ 没有找到${name}语音（共 ${voiceCount} 个语音）`);
  if (lastError) lines.push(`上次朗读出错：${lastError}`);
  if (!voice) {
    lines.push(ios
      ? `请到「设置 → 辅助功能 → 朗读内容 → 声音 → ${voiceInstall.ios}」下载一个声音。`
      : `请到手机「设置 → 系统 → 语言 → 文字转语音输出」（找不到可在设置里搜“文字转语音”），首选引擎选「Google 语音服务」，点齿轮 → 安装语音数据 → 下载「${voiceInstall.android}」，然后完全关闭并重新打开 Chrome。`);
  }
  lines.push(ios ? '另外请确认：手机侧面的静音开关已关闭，媒体音量已调大。' : '另外请确认：媒体音量已调大（按音量键时调的是“媒体”而不是铃声）。');
  return lines.join('\n');
}

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = !!Rec;

const ERRORS = {
  'not-allowed': '没有麦克风权限，请在浏览器设置里允许本网站使用麦克风',
  'no-speech': '没听到声音，再试一次',
  'audio-capture': '麦克风被占用或无法使用',
  network: '语音识别需要联网',
};

// 识别一句话，返回候选文本（按可信度排序）。传入 track 时让识别直接使用这条录音轨道
function recognizeOnce(track) {
  return new Promise((resolve, reject) => {
    const r = new Rec();
    r.lang = L().bcp47;
    r.interimResults = false;
    r.maxAlternatives = 3;
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve(Array.from(e.results[0]).map((a) => a.transcript));
    };
    r.onerror = (e) => {
      done = true;
      const err = new Error(ERRORS[e.error] || `识别出错：${e.error}`);
      err.code = e.error;
      reject(err);
    };
    r.onend = () => {
      if (!done) resolve([]);
    };
    // 新版 Chrome 支持 start(audioTrack)；旧版会忽略参数或报错，此时退回普通 start()
    try {
      track ? r.start(track) : r.start();
    } catch {
      r.start();
    }
  });
}

// 录一句话，返回识别出的文本
export function listen() {
  if (!Rec) return Promise.reject(new Error('当前浏览器不支持语音识别，请用 Chrome / Edge / Safari，或直接打字'));
  speechSynthesis.cancel();
  return recognizeOnce(null);
}

// 录音方式：不同手机对“同时录音和识别”的支持不一样，按顺序尝试，记住第一个成功的
//   track    把录音轨道直接交给语音识别（新版 Chrome）
//   parallel 录音和识别各自打开麦克风
//   off      不录音，只识别（没有“我的录音”回放）
// 某个方式识别成功过一次就“确认”，之后再听不到声音就当作用户真的没说话，不再降级
const MODE_KEY = 'nihongo-coach-rec-mode';
const MODES = ['track', 'parallel', 'off'];
const MODE_NAMES = { track: '录音并识别（方式 1）', parallel: '录音并识别（方式 2）', off: '只识别，不录音' };
let recMode = { mode: 'track', confirmed: false };
try {
  const saved = JSON.parse(localStorage.getItem(MODE_KEY));
  if (MODES.includes(saved?.mode)) recMode = saved;
} catch {}
function setMode(mode, confirmed) {
  recMode = { mode, confirmed };
  try { localStorage.setItem(MODE_KEY, JSON.stringify(recMode)); } catch {}
}
export const canRecord = () => recMode.mode !== 'off' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;
export const recordModeInfo = () => `${MODE_NAMES[recMode.mode]}${recMode.confirmed ? '' : '（检测中）'}`;
export const resetRecordMode = () => setMode('track', false);

// 跟读一次：同时录音（用于回放）和识别（用于打分）
export async function recordAttempt() {
  if (!Rec) throw new Error('当前浏览器不支持语音识别，请用 Chrome 或 Safari');
  speechSynthesis.cancel();
  const mode = canRecord() ? recMode.mode : 'off';
  let stream = null;
  let rec = null;
  const chunks = [];
  if (mode !== 'off') {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
    } catch (e) {
      if (e.name === 'NotAllowedError') throw new Error(ERRORS['not-allowed']);
      stream = null;
      rec = null;
    }
  }
  const stopRecording = () => new Promise((resolve) => {
    const release = () => stream?.getTracks().forEach((t) => t.stop());
    if (!rec || rec.state === 'inactive') {
      release();
      return resolve(null);
    }
    rec.onstop = () => {
      release();
      resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })) : null);
    };
    rec.stop();
  });
  // 录音占用麦克风导致识别听不到时，换下一种方式，并请用户再说一次
  const downgrade = () => {
    const next = MODES[MODES.indexOf(mode) + 1] || 'off';
    setMode(next, false);
    return new Error(next === 'off'
      ? '这台手机不能同时录音和识别，已关闭“我的录音”回放，请再说一次'
      : '这台手机的录音和识别冲突了，已自动换一种方式，请再说一次');
  };
  try {
    const alts = await recognizeOnce(mode === 'track' ? stream?.getAudioTracks()[0] : null);
    const audioUrl = await stopRecording();
    if (alts.length) {
      if (!recMode.confirmed) setMode(mode, true);
      return { alts, audioUrl };
    }
    if (stream && !recMode.confirmed) throw downgrade();
    return { alts, audioUrl };
  } catch (e) {
    await stopRecording();
    if (stream && !recMode.confirmed && ['no-speech', 'audio-capture', 'aborted', 'service-not-allowed'].includes(e.code)) throw downgrade();
    throw e;
  }
}

// 发音相似度：基于最长公共子序列，忽略标点、空格和大小写；对原文/读音两种写法取较高分
// 日语的长音符「ー」不算标点：长音读得不够长是中国学生最常见的错误之一
const PUNCT = /[\s、。，！？；：!?,.;:「」『』（）()〜~…・'’‘"“”«»\-]/;
// 比较时忽略拉丁字母上的重音符号（caffè／caffe）：语音识别有时不带重音符号。
// 只去掉 U+0300–U+036F 的组合符号，日语的浊音符（U+3099）不受影响
const fold = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();
const norm = (s) => [...(s || '')].filter((c) => !PUNCT.test(c)).map(fold).join('');
function lcsTable(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}
function score(heard, target) {
  const a = [...norm(heard)], b = [...norm(target)];
  if (!a.length || !b.length) return 0;
  return (2 * lcsTable(a, b)[a.length][b.length]) / (a.length + b.length);
}
export function similarity(heardList, targets) {
  let best = 0;
  for (const h of heardList) for (const t of targets) best = Math.max(best, score(h, t));
  return Math.round(best * 100);
}

// 逐字比对：返回目标句每个字是否被正确读出，用于标红读错/漏读的地方
// 会在原文和读音（假名／拼音）中，选和识别结果最接近的一种来比对
export function diffChars(heardList, targets) {
  let best = { s: -1 };
  for (const h of heardList) for (const t of targets) {
    if (!t) continue;
    const s = score(h, t);
    if (s > best.s) best = { s, h, t };
  }
  if (!best.t) return [];
  const chars = [...best.t];
  const idx = chars.map((c, i) => i).filter((i) => !PUNCT.test(chars[i]));
  const a = idx.map((i) => fold(chars[i]));
  const b = [...norm(best.h)];
  const dp = lcsTable(a, b);
  const matched = new Set();
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] === b[j - 1]) {
      matched.add(idx[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return chars.map((c, i) => ({ c, ok: PUNCT.test(c) || matched.has(i) }));
}


// ---------- 只录音（“录一遍听听”）----------
// 不做识别，所以不会和语音识别抢麦克风。说完停顿约 1 秒自动停止，也可以手动停止
export const canSelfRecord = () => !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;
let selfRec = null;
export const isSelfRecording = () => !!selfRec;
export function stopSelfRecording() {
  if (selfRec?.state === 'recording') selfRec.stop();
}
export async function recordSelf() {
  speechSynthesis.cancel();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new Error(e.name === 'NotAllowedError' ? ERRORS['not-allowed'] : '无法打开麦克风');
  }
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  // 用音量判断什么时候说完了
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const started = performance.now();
  let spoke = false;
  let lastLoud = started;
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const now = performance.now();
      if (rms > 0.02) {
        spoke = true;
        lastLoud = now;
      }
      const silentAfterSpeech = spoke && now - lastLoud > 1200;
      const nothingSaid = !spoke && now - started > 7000;
      if (silentAfterSpeech || nothingSaid || now - started > 20000) stopSelfRecording();
    }, 100);
    rec.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      selfRec = null;
      resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })) : null);
    };
    rec.start();
    selfRec = rec;
  });
}
