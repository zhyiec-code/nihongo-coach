import {
  LANGS, LANG_IDS, TOTAL_WEEKS, DAYS_PER_WEEK, dailySteps, WEEKLY_STEPS,
} from './data.js';
import {
  S, save, resetAll, exportData, importData, TOTAL_DAYS, unitForWeek, levelForUnit, dayInfo,
  completeDay, logMinutes, today, streak, addCards, dueCards, gradeCard, L, switchLang, hasCourse,
  T, LX, uiLang, setUiLang,
} from './store.js';
import {
  speak, listen, recordAttempt, similarity, diffChars, sttSupported, ttsSupported, hasVoice, ttsDiagnosis,
  recordModeInfo, resetRecordMode, canSelfRecord, recordSelf, stopSelfRecording, isSelfRecording,
  stopListening, cancelListening, isListening,
} from './speech.js';
import {
  hasKey, generateLesson, chatSystem, chatTurn, summarize, evalSpeaking, pronunciationFeedback, lookupWord, ROUTE_IDS, routeName,
} from './ai.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const main = () => $('#main');
// 当前学习语言的 HTML lang 属性（影响字体和浏览器朗读）
const HL = () => L().htmlLang;
// 当前学习语言的名称（英文界面显示英文名）
const LN = () => LX(L(), 'name');
// “标签：内容”的冒号：中文界面用全角，英文界面用半角加空格
const COLON = () => T('：', ': ');
const levelName = (i) => LX(L().levels[i], 'name');

// 每一步的名称（英文界面用；中文名在 data.js）
const STEP_EN = { review: 'Review', kana: 'Kana', phrases: 'Key phrases', shadow: 'Shadowing', chat: 'AI conversation', summary: 'Summary' };
const WEEKLY_STEP_EN = { review: 'Weekly review', chat: 'Speaking test', summary: 'Test report' };
const stepName = (s, weekly) => (uiLang() === 'en' ? (weekly ? WEEKLY_STEP_EN : STEP_EN)[s.id] : s.name);

// ---------- 通用组件 ----------
// 一行目标语言的句子：原文 + 读音 + 可点开的中文 + 朗读按钮
function jaBlock({ ja, reading, zh, note }, { big = false, showZh = false } = {}) {
  const showReading = S().settings.showReading && reading && reading !== ja;
  return `<div class="ja-block ${big ? 'big' : ''}">
    <div class="ja-row"><button class="say" data-say="${esc(ja)}" aria-label="${T('朗读', 'Play')}">🔊</button><span class="ja" lang="${HL()}" data-sent="${esc(ja)}">${tappable(ja)}</span></div>
    ${showReading ? `<div class="reading" lang="${HL()}">${esc(reading)}</div>` : ''}
    ${zh ? `<div class="zh ${showZh ? 'shown' : ''}" data-reveal data-hint="${T('点击显示中文', 'Tap to show the meaning')}">${esc(zh)}</div>` : ''}
    ${note ? `<div class="note">💡 ${esc(note)}</div>` : ''}
  </div>`;
}

// 把句子切成可点击的词（浏览器自带的分词，按当前语言）
const segmenters = {};
function tappable(text) {
  if (!window.Intl?.Segmenter) return esc(text);
  const lang = HL();
  const segmenter = segmenters[lang] || (segmenters[lang] = new Intl.Segmenter(lang, { granularity: 'word' }));
  return [...segmenter.segment(text)]
    .map((s) => (s.isWordLike ? `<span class="w" data-w="${esc(s.segment)}">${esc(s.segment)}</span>` : esc(s.segment)))
    .join('');
}

// 点词弹出的解释面板：读出这个词，显示意思；面板一直显示，直到关闭或点下一个词
function wordSheet() {
  let el = $('#wordsheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wordsheet';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}
function closeWordSheet() {
  const el = $('#wordsheet');
  if (el) el.hidden = true;
  $$('.w.picked').forEach((w) => w.classList.remove('picked'));
}
async function showWord(word, sentence) {
  const el = wordSheet();
  el.hidden = false;
  // 日语查过的词用平假名读音朗读，避免汉字单独出现时被读错
  // 查词结果按界面语言分开缓存（中文界面和英文界面的解释语言不同）
  const pick = `${word}|${sentence}`;
  const key = `${uiLang()}|${pick}`;
  const cached = (S().dict || {})[key];
  speak(L().id === 'ja' && cached?.reading ? cached.reading : word);
  const head = `<button class="ws-close" data-wsclose aria-label="${T('关闭', 'Close')}">✕</button>
    <div class="ws-word"><span lang="${HL()}">${esc(word)}</span><button class="say" data-say="${esc(word)}">🔊</button></div>`;
  if (!hasKey()) {
    el.innerHTML = `${head}<p class="hint">${T('填写 Claude API Key 后，可以在这里看到这个词的读音和解释。', 'Add a Claude API key in Settings to see the reading and meaning of words here.')}</p>`;
    return;
  }
  const dict = S().dict || (S().dict = {});
  let info = dict[key];
  if (!info) {
    el.innerHTML = `${head}<p class="hint">${T('正在查询…', 'Looking it up…')}</p>`;
    try {
      info = await lookupWord({ word, sentence });
      dict[key] = info;
      save();
    } catch (e) {
      el.innerHTML = `${head}${errorBox(e.message)}`;
      return;
    }
    if (el.dataset.word !== pick) return; // 查询期间又点了别的词
  }
  el.innerHTML = `${head}
    <div class="ws-reading" lang="${HL()}">${esc(info.reading)}${info.dictionary_form && info.dictionary_form !== word ? `　${T('原形', 'base form')}${COLON()}${esc(info.dictionary_form)}` : ''}</div>
    <div class="ws-meaning"><span class="ws-pos">${esc(info.pos_zh)}</span>${esc(info.meaning_zh)}</div>
    ${info.usage_zh ? `<p>${esc(info.usage_zh)}</p>` : ''}
    ${info.kanji_zh ? `<p class="ws-kanji">🈶 ${esc(info.kanji_zh)}</p>` : ''}
    <button class="btn sm" data-wsadd>${T('＋ 加入复习卡片', '+ Add to review cards')}</button>`;
  if (L().id === 'ja') $('[data-say]', el).dataset.say = info.reading || word;
  $('[data-wsadd]', el).onclick = (e) => {
    const form = info.dictionary_form || word;
    const n = addCards([{ ja: form, reading: info.reading, zh: info.meaning_zh, note: `${T('出自', 'From')}${COLON()}${sentence}` }], 'word');
    e.target.textContent = n ? T('✅ 已加入', '✅ Added') : T('已经在卡片里了', 'Already in your cards');
    e.target.disabled = true;
  };
}

function micButton(label = T('跟读', 'Repeat')) {
  return `<div class="practice">
    <div class="pr-btns"><button class="mic" data-mic>🎤 ${label}</button>${canSelfRecord() ? `<button class="mic" data-selfrec>🎙 ${T('录一遍听听', 'Record & listen')}</button>` : ''}</div>
    <div class="self-out"></div><div class="pr-out"></div></div>`;
}

// “录一遍听听”：只录音不打分。录完先放自己的录音，再放标准发音，方便对比
function bindSelfRecord(box, getJa) {
  const btn = $('[data-selfrec]', box);
  if (!btn) return;
  const out = $('.self-out', box);
  let url = null;
  const playCompare = () => {
    speechSynthesis.cancel();
    const a = new Audio(url);
    a.onended = () => setTimeout(() => speak(getJa()), 400);
    // iPhone 只允许在点击时播放声音：录音自动停止后的自动播放可能被拦截，这时让用户点按钮播放
    return a.play().then(() => true, () => false);
  };
  btn.onclick = async () => {
    if (isSelfRecording()) return stopSelfRecording();
    const micBtn = $('[data-mic]', box);
    micBtn.disabled = true;
    btn.classList.add('listening');
    btn.textContent = T('■ 说完会自动停止（点这里停止）', '■ Stops when you finish (tap to stop)');
    try {
      const newUrl = await recordSelf();
      if (!newUrl) {
        out.innerHTML = `<div class="pr-result fail">${T('没有录到声音，再试一次', 'Nothing was recorded. Please try again.')}</div>`;
        return;
      }
      if (url) URL.revokeObjectURL(url);
      url = newUrl;
      out.innerHTML = `<div class="self-result">
        <span>🎙 ${T('你的录音：', 'Your recording:')}</span>
        <button class="btn sm" data-playself>▶ ${T('我的录音', 'My recording')}</button>
        <button class="btn sm" data-compare>🔁 ${T('我的 + 标准对比', 'Mine + model')}</button></div>`;
      $('[data-playself]', out).onclick = () => { speechSynthesis.cancel(); new Audio(url).play().catch(() => {}); };
      $('[data-compare]', out).onclick = playCompare;
      if (!(await playCompare())) {
        out.insertAdjacentHTML('beforeend', `<div class="pr-legend">${T('录好了，点「🔁 我的 + 标准对比」播放', 'Recorded! Tap "🔁 Mine + model" to play it.')}</div>`);
      }
    } catch (e) {
      out.innerHTML = `<div class="pr-result fail">${esc(e.message)}</div>`;
    } finally {
      micBtn.disabled = false;
      btn.classList.remove('listening');
      btn.textContent = T('🎙 再录一遍', '🎙 Record again');
    }
  };
}

// 绑定跟读练习：录音 + 识别 → 打分、标出读错的字、回放自己的录音、AI 分析，直到读对为止
// getTargets(i) 返回 [原文, 读音（假名／拼音）]；onProgress(passedCount) 在读对一句时调用
function bindShadowMics(root, getTargets, onProgress) {
  const passed = new Set();
  $$('[data-mic]', root).forEach((btn, i) => {
    const box = btn.closest('.practice');
    const out = $('.pr-out', box);
    bindSelfRecord(box, () => getTargets(i)[0]);
    const label = btn.textContent;
    let tries = 0;
    let myAudio = null;
    btn.onclick = async () => {
      if (isSelfRecording()) return;
      if (btn.classList.contains('listening')) return stopListening(); // 再点一次：说完了
      if (isListening()) return;
      const [ja, reading] = getTargets(i);
      btn.classList.add('listening');
      btn.textContent = T('🎤 请开始说…（说完点这里）', '🎤 Speak now… (tap when done)');
      try {
        const { alts, audioUrl } = await recordAttempt();
        if (myAudio) URL.revokeObjectURL(myAudio);
        myAudio = audioUrl;
        if (!alts.length) {
          out.innerHTML = `<div class="pr-result fail">${T('没听清，靠近一点再试一次', "Couldn't hear you clearly. Move closer and try again.")}</div>`;
          return;
        }
        tries++;
        const thisTry = tries;
        const score = similarity(alts, [ja, reading]);
        const diff = diffChars(alts, [ja, reading]);
        const exact = diff.length > 0 && diff.every((d) => d.ok);
        // 每个字都对上才直接通过。只错一个音（如 おばあさん→おばさん）相似度也有 95%，所以不能只看分数。
        // 有标红时，有 Key 就让 AI 判断是真读错还是只是汉字写法不同；没有 Key 时由学生自己确认
        const useAI = !exact && hasKey();
        const state = exact ? 'pass' : useAI ? 'checking' : 'fail';

        // 结果一直显示，直到下一次跟读出结果或进入下一句；通过时也保留标红和 AI 的说明
        const render = (st, fb, selfPassed = false) => {
          const ok = st === 'pass';
          const head = ok ? T('✅ 读对了！', '✅ Correct!') : st === 'checking' ? T('🤖 AI 正在检查你的发音…', '🤖 AI is checking your pronunciation…') : T('还没读对，看看下面的说明，听一下区别再试一次', 'Not quite. Read the notes below, listen to the difference and try again.');
          const ai = fb?.problems ? fb : null;
          out.innerHTML = `
            <div class="pr-result ${st}">
              <div class="pr-head"><span class="score ${ok ? 's3' : st === 'checking' ? 's2' : 's1'}">${score}%</span><span>${T(`第 ${tries} 次`, `Try ${tries}`)} · ${head}</span></div>
              ${exact ? '' : `<div class="pr-diff" lang="${HL()}">${diff.map((d) => (d.ok ? esc(d.c) : `<mark>${esc(d.c)}</mark>`)).join('')}</div>
              <div class="pr-legend">${ok && selfPassed ? T('你确认了读对（语音识别可能听错了）。', 'You marked it correct (speech recognition may have misheard).') : ok && ai ? T('AI 判断：标红处只是写法不同，发音是对的。', 'AI says the red parts are only written differently; your pronunciation is right.') : T('标红的是没读出来或读错的部分', 'Red = sounds that were missed or wrong')}</div>`}
              <div class="pr-heard">${T('识别到', 'Heard')}${COLON()}<span lang="${HL()}">${esc(alts[0])}</span></div>
              ${ai && (ai.problems.length || ai.tip_zh) ? `<div class="pr-ai">
                ${ai.problems.map((p) => `<div class="pr-problem"><b lang="${HL()}">${esc(p.part)}</b>：${esc(p.issue_zh)}<div class="how">👉 ${esc(p.how_zh)}</div></div>`).join('')}
                ${ai.tip_zh ? `<div class="pr-tip">💡 ${esc(ai.tip_zh)}</div>` : ''}</div>` : ''}
              <div class="pr-actions">
                ${myAudio ? `<button class="btn sm" data-mine>▶ ${T('我的录音', 'My recording')}</button>` : ''}
                <button class="btn sm" data-say="${esc(ja)}">🔊 ${T('标准发音', 'Model')}</button>
                <button class="btn sm" data-slow>🐢 ${T('慢速', 'Slow')}</button>
              </div>
              ${st === 'fail' ? `<button class="selfpass" data-selfpass>${T('识别错了？我确定读对了', 'Misheard? I\'m sure I said it right')}</button>` : ''}
            </div>`;
          if (myAudio) $('[data-mine]', out).onclick = () => { speechSynthesis.cancel(); new Audio(myAudio).play(); };
          $('[data-slow]', out).onclick = () => speak(ja, 0.6);
          const self = $('[data-selfpass]', out);
          if (self) self.onclick = () => render('pass', fb, true);
          if (ok) {
            btn.closest('.item')?.classList.add('passed');
            if (!passed.has(i)) {
              passed.add(i);
              onProgress?.(passed.size);
            }
          }
        };
        render(state);
        if (useAI) {
          pronunciationFeedback({ ja, reading, heard: alts })
            .then((fb) => { if (thisTry === tries) render(fb.correct ? 'pass' : 'fail', fb); }) // 已开始新的一次时丢弃旧结果
            .catch(() => { if (thisTry === tries) render('fail'); });
        }
      } catch (e) {
        out.innerHTML = `<div class="pr-result fail">${esc(e.message)}</div>`;
      } finally {
        btn.classList.remove('listening');
        btn.textContent = tries ? T('🎤 再读一次', '🎤 Try again') : label;
      }
    };
  });
}

document.addEventListener('click', (e) => {
  const say = e.target.closest('[data-say]');
  if (say) speak(say.dataset.say);
  if (e.target.closest('[data-diag]')) alert(ttsDiagnosis());
  const w = e.target.closest('.w[data-w]');
  if (w) {
    $$('.w.picked').forEach((x) => x.classList.remove('picked'));
    w.classList.add('picked');
    const sentence = w.closest('[data-sent]')?.dataset.sent || w.dataset.w;
    wordSheet().dataset.word = `${w.dataset.w}|${sentence}`;
    showWord(w.dataset.w, sentence);
  }
  if (e.target.closest('[data-wsclose]')) closeWordSheet();
  const rev = e.target.closest('[data-reveal]');
  if (rev) rev.classList.toggle('shown');
});

function spinner(text) {
  return `<div class="loading"><div class="spin"></div><p>${esc(text)}</p></div>`;
}
function errorBox(msg) {
  return `<div class="error">⚠️ ${esc(msg)}</div>`;
}

// ---------- 路由 ----------
const routes = {
  '': viewHome, welcome: viewWelcome, test: viewTest, plan: viewPlan, session: viewSession,
  review: viewReview, chat: viewChat, settings: viewSettings,
};
let leaveHook = null;
function router() {
  speechSynthesis?.cancel?.();
  cancelListening();
  closeWordSheet();
  if (leaveHook) leaveHook();
  leaveHook = null;
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (!S().profile && !['welcome', 'test', 'settings'].includes(name)) {
    location.hash = '#/welcome';
    return;
  }
  document.title = LX(L(), 'appTitle');
  document.documentElement.lang = uiLang() === 'en' ? 'en' : 'zh-CN';
  const TAB_NAMES = { home: T('今日', 'Today'), review: T('复习', 'Review'), chat: T('对话', 'Chat'), plan: T('课程', 'Course'), settings: T('设置', 'Settings') };
  $$('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === (name || 'home'));
    if (TAB_NAMES[a.dataset.tab] && a.lastChild?.nodeType === Node.TEXT_NODE) a.lastChild.nodeValue = TAB_NAMES[a.dataset.tab];
  });
  document.body.classList.toggle('no-tabs', ['welcome', 'test', 'session'].includes(name));
  document.body.classList.toggle('in-session', name === 'session');
  window.scrollTo(0, 0);
  (routes[name] || viewHome)(arg);
}
window.addEventListener('hashchange', router);

// ---------- 语言切换 ----------
function langSwitcher() {
  return `<div class="lang-switch">${LANG_IDS.map((id) => `<button class="${id === L().id ? 'active' : ''}" data-lang="${id}">${LANGS[id].flag} ${esc(uiLang() === 'en' ? LANGS[id].name_en : LANGS[id].name)}</button>`).join('')}</div>`;
}
// 切换后：这种语言学过就回首页，没学过就去欢迎页做水平测试。before 在切换前调用（如保存已填的内容）
function bindLangSwitcher(before = () => {}) {
  $$('[data-lang]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.lang;
    if (id === L().id) return;
    before();
    switchLang(id);
    const target = hasCourse(id) ? '#/' : '#/welcome';
    if (location.hash === target || (target === '#/' && !location.hash)) router();
    else location.hash = target;
  }));
}

// ---------- 首页 ----------
function viewHome() {
  const st = S();
  const p = st.progress;
  const done = Object.keys(p.completed).length;
  const finished = p.day > TOTAL_DAYS;
  const info = finished ? null : dayInfo();
  const due = dueCards(999).length;
  const steps = info ? (info.weekly ? WEEKLY_STEPS : dailySteps(info.unit, info.level)) : [];
  const unitTitle = info ? LX(info.unit, 'title') : '';
  const todayMin = st.log[today()] || 0;
  const scores = Object.entries(p.weekScores);
  main().innerHTML = `
    ${langSwitcher()}
    <header class="hero">
      <div class="level-badge">${L().flag} ${esc(LN())} · ${T('当前水平', 'Level')} · ${esc(levelName(info ? info.level : 5))}</div>
      <h1>${finished ? T('🎉 26 周课程完成！', '🎉 26-week course complete!') : T(`第 ${info.week} 周 · 第 ${info.dow} 天`, `Week ${info.week} · Day ${info.dow}`)}</h1>
      ${info ? `<p class="unit-title">${esc(unitTitle)}${info.weekly ? T(' · 周复盘与口语测评', ' · Weekly review & speaking test') : ''}</p>` : `<p>${T('建议重新做一次水平测试，看看半年的进步。', 'Take the level test again to see how much you improved.')}</p>`}
    </header>
    <div class="stats">
      <div><b>${done}</b><span>/ ${TOTAL_DAYS} ${T('天', 'days')}</span></div>
      <div><b>${streak()}</b><span>${T('连续天数', 'Day streak')}</span></div>
      <div><b>${todayMin}</b><span>${T('今日分钟', 'Min today')}</span></div>
      <div><b>${due}</b><span>${T('待复习', 'To review')}</span></div>
    </div>
    <div class="progress"><div style="width:${Math.min(100, (done / TOTAL_DAYS) * 100)}%"></div></div>
    ${info ? `
    <section class="card">
      <h2>${T('今天的 60 分钟', "Today's 60 minutes")}</h2>
      <ol class="steps-preview">${steps.map((s) => `<li><span>${esc(stepName(s, info.weekly))}</span><span>${s.min} ${T('分钟', 'min')}</span></li>`).join('')}</ol>
      <a class="btn primary block" href="#/session/${info.day}">${T('开始今天的学习', "Start today's lesson")}</a>
      ${!hasKey() ? `<p class="hint">⚠️ ${T('还没有填写 Claude API Key，课程生成和 AI 对话无法使用。', 'No Claude API key yet, so lessons and AI conversation will not work.')}<a href="#/settings">${T('去设置', 'Open Settings')}</a></p>` : ''}
    </section>` : `<section class="card"><a class="btn primary block" href="#/test">${T('重新测试水平', 'Retake the level test')}</a></section>`}
    <section class="card">
      <h2>${T('目标', 'Goal')}</h2>
      <p>${esc(LX(L().levels[st.profile.level], 'target'))}</p>
      ${scores.length ? `<h3>${T('每周口语测评', 'Weekly speaking tests')}</h3><div class="score-bars">${scores.map(([w, s]) => `<div title="${T(`第${w}周`, `Week ${w}`)}${COLON()}${s}/5"><i style="height:${s * 20}%"></i><span>${w}</span></div>`).join('')}</div>` : ''}
    </section>
    <section class="quick">
      <a class="card link" href="#/review">🔁 ${T('复习卡片', 'Review cards')}<small>${T(`${due} 张待复习`, `${due} due`)}</small></a>
      <a class="card link" href="#/chat">💬 ${T('自由对话', 'Free chat')}<small>${T('随时和 AI 聊天', 'Chat with AI anytime')}</small></a>
    </section>`;
  bindLangSwitcher();
}

// ---------- 欢迎页 ----------
function viewWelcome() {
  const name = LN();
  main().innerHTML = `
    <section class="welcome">
      <div class="logo">${L().flag}</div>
      <h1>${esc(LX(L(), 'appTitle'))}</h1>
      <p class="lead">${T(`每天 1 小时，26 周，用最高效的方法练到能开口说${esc(name)}。`, `One hour a day for 26 weeks: the most effective way to start speaking ${esc(name)}.`)}</p>
      <div class="card">
        <h2>${T('想学哪种语言？', 'Which language do you want to learn?')}</h2>
        ${langSwitcher()}
        <p class="hint">${T('每种语言有自己的水平测试、课程和复习卡片，随时可以在首页切换。', 'Each language has its own level test, course and review cards. You can switch anytime on the home page.')}</p>
      </div>
      <div class="card">
        <h2>${T('它怎么帮你', 'How it helps you')}</h2>
        <ul class="method">
          <li>${T('<b>先测水平</b>：笔试 + 口语测试，从适合你的单元开始，不浪费时间。', '<b>Level test first</b>: a listening and speaking test so you start at the right unit.')}</li>
          <li>${T('<b>整句学习</b>：每天 8 个高频句子，直接学能说出口的整句。', '<b>Whole sentences</b>: 8 useful sentences a day that you can say right away.')}</li>
          <li>${T('<b>影子跟读</b>：跟着朗读逐句模仿，语音识别给发音打分。', '<b>Shadowing</b>: repeat after the audio and get a pronunciation score.')}</li>
          <li>${T('<b>AI 情景对话</b>：每天和 AI 角色扮演，实时纠错，这是提升口语最关键的一环。', '<b>AI role-play</b>: talk with AI every day and get instant corrections. This is the key to speaking well.')}</li>
          <li>${T(`<b>间隔复习</b>：看中文说${esc(name)}，按遗忘曲线安排复习，记住你说错过的句子。`, `<b>Spaced review</b>: see the meaning and say it in ${esc(name)}, timed so you remember your mistakes.`)}</li>
          <li>${T('<b>每周测评</b>：第 7 天做口语测评，跟踪进步并调整节奏。', '<b>Weekly test</b>: a speaking test on day 7 to track your progress.')}</li>
        </ul>
      </div>
      <div class="card">
        <h2>Claude API Key</h2>
        <p class="hint">${T('课程内容和 AI 对话需要 API Key（在 console.anthropic.com 获取）。Key 只保存在这台设备的浏览器里。也可以先跳过，之后在设置里填。', 'Lessons and AI conversation need an API key (from console.anthropic.com). The key is stored only in this browser. You can skip this and add it later in Settings.')}</p>
        <input type="password" id="key" placeholder="sk-ant-..." value="${esc(S().settings.apiKey)}" autocomplete="off">
      </div>
      <button class="btn primary block" id="go">${T('开始水平测试', 'Start the level test')}</button>
    </section>`;
  $('#go').onclick = () => {
    S().settings.apiKey = $('#key').value.trim();
    save();
    location.hash = '#/test';
  };
  // 欢迎页上切换语言前，先保存已经填好的 Key
  bindLangSwitcher(() => {
    S().settings.apiKey = $('#key').value.trim();
    save();
  });
}

// ---------- 分级测试 ----------
function viewTest() {
  const t = { lv: 1, block: [], idx: 0, correct: 0, passed: 0, answers: [], qa: [] };

  function showSelf() {
    main().innerHTML = `
      <section class="card">
        <h2>${T('水平测试 · 1/3 基本情况', 'Level test · 1/3 About you')}</h2>
        <p>${esc(LX(L().selfCheck, 'q'))}</p>
        <div class="choices">
          ${L().selfCheck.options.map((o, i) => `<button class="btn" data-k="${i}">${esc(LX(o, 'label'))}</button>`).join('')}
        </div>
        <p class="hint">${T('接下来的笔试会自动调整难度，遇到不会的题请选「不知道」，不要猜，这样结果更准。', 'The next part adjusts to your level. If you don\'t know an answer, choose "I don\'t know" instead of guessing, so the result is accurate.')}</p>
      </section>`;
    $$('[data-k]').forEach((b) => (b.onclick = () => {
      if (L().selfCheck.options[+b.dataset.k].skip) return finish(0, null, '');
      nextBlock();
    }));
  }

  function nextBlock() {
    t.block = shuffle(L().placement.filter((x) => x.lv === t.lv)).slice(0, 4);
    t.idx = 0;
    t.correct = 0;
    showItem();
  }

  function showItem() {
    const it = t.block[t.idx];
    const qNo = (t.lv - 1) * 4 + t.idx + 1;
    main().innerHTML = `
      <section class="card">
        <h2>${T('水平测试 · 2/3 笔试与听力', 'Level test · 2/3 Listening & reading')}</h2>
        <div class="test-meta" data-lv="${t.lv}">${T(`难度 ${t.lv}/5 · 第 ${qNo} 题`, `Level ${t.lv}/5 · Question ${qNo}`)}</div>
        ${it.type === 'listen' ? `<button class="btn big-say" data-say="${esc(it.audio)}">🔊 ${T('播放语音', 'Play audio')}</button><button class="diag" data-diag>${T('听不到声音？', "Can't hear anything?")}</button>` : ''}
        <p class="question">${esc(LX(it, 'q'))}</p>
        <div class="choices">
          ${LX(it, 'options').map((o, i) => `<button class="btn" data-i="${i}">${esc(o)}</button>`).join('')}
          <button class="btn ghost" data-i="-1">${T('不知道', "I don't know")}</button>
        </div>
      </section>`;
    if (it.type === 'listen') setTimeout(() => speak(it.audio), 300);
    $$('[data-i]').forEach((b) => (b.onclick = () => {
      if (+b.dataset.i === it.answer) t.correct++;
      t.idx++;
      if (t.idx < t.block.length) return showItem();
      // 本级答对 3 题及以上才进入下一级
      if (t.correct >= 3) {
        t.passed = t.lv;
        if (t.lv < 5) {
          t.lv++;
          return nextBlock();
        }
      }
      afterQuiz();
    }));
  }

  function afterQuiz() {
    // 口语测试需要 AI 评分；没有语音识别时也可以打字回答
    if (!hasKey() || t.passed === 0) return finish(t.passed, null, '');
    showSpeak(0);
  }

  function showSpeak(i) {
    if (i >= L().speaking.length) return evalSpeak();
    const q = L().speaking[i];
    main().innerHTML = `
      <section class="card">
        <h2>${T('水平测试 · 3/3 口语', 'Level test · 3/3 Speaking')}</h2>
        <div class="test-meta">${T(`第 ${i + 1} / ${L().speaking.length} 题 · 听问题，用${esc(LN())}回答`, `Question ${i + 1} / ${L().speaking.length} · Listen and answer in ${esc(LN())}`)}</div>
        <button class="btn big-say" data-say="${esc(q)}">🔊 ${T('再听一次', 'Listen again')}</button><button class="diag" data-diag>${T('听不到声音？', "Can't hear anything?")}</button>
        <p class="question zh" data-reveal lang="${HL()}">${esc(q)}<small>${T('（点击显示文字）', '(tap to show the text)')}</small></p>
        ${sttSupported ? `<button class="mic big" id="rec">🎤 ${T('按下后开始说', 'Tap and start speaking')}</button>` : ''}
        <textarea id="ans" rows="2" placeholder="${T('识别结果会出现在这里，也可以直接打字输入', 'What you say appears here. You can also type.')}" lang="${HL()}"></textarea>
        <div class="row">
          <button class="btn ghost" id="skip">${T('听不懂 / 跳过', "Don't understand / skip")}</button>
          <button class="btn primary" id="next">${T('下一题', 'Next')}</button>
        </div>
      </section>`;
    setTimeout(() => speak(q), 300);
    if (sttSupported) {
      $('#rec').onclick = async () => {
        const btn = $('#rec');
        if (btn.classList.contains('listening')) return stopListening(); // 再点一次：说完了
        btn.classList.add('listening');
        btn.textContent = T('🎤 正在听…（说完点这里）', '🎤 Listening… (tap when done)');
        try {
          const heard = await listen();
          if (heard[0]) $('#ans').value = heard[0];
        } catch (e) {
          alert(e.message);
        }
        btn.classList.remove('listening');
        btn.textContent = T('🎤 重新说', '🎤 Say it again');
      };
    }
    $('#skip').onclick = () => { cancelListening(); t.qa.push({ q, a: '' }); showSpeak(i + 1); };
    $('#next').onclick = () => { cancelListening(); t.qa.push({ q, a: $('#ans').value.trim() }); showSpeak(i + 1); };
  }

  async function evalSpeak() {
    main().innerHTML = spinner(T('AI 正在评估你的口语水平…', 'AI is checking your speaking level…'));
    try {
      const r = await evalSpeaking(t.qa);
      const spk = Math.max(0, Math.min(5, r.speaking_level));
      // 课程以口语为目标：综合笔试与口语，取偏向口语的平均值
      finish(Math.floor((t.passed + spk) / 2), spk, r.comment_zh);
    } catch (e) {
      finish(t.passed, null, T(`口语评估失败（${e.message}），暂按笔试结果定级。`, `The speaking check failed (${e.message}), so your level is based on the first part only.`));
    }
  }

  function finish(level, spk, comment) {
    const written = t.passed;
    main().innerHTML = `
      <section class="card result">
        <h2>${T('测试结果', 'Your result')}</h2>
        <div class="result-level">${esc(levelName(level))}</div>
        <p>${esc(LX(L().levels[level], 'desc'))}</p>
        <div class="stats two">
          <div><b>${esc(levelName(written))}</b><span>${T('笔试/听力', 'Listening/reading')}</span></div>
          <div><b>${spk == null ? '—' : esc(levelName(spk))}</b><span>${T('口语', 'Speaking')}</span></div>
        </div>
        ${comment ? `<p class="comment">${esc(comment)}</p>` : ''}
        <h3>${T('半年后的现实目标', 'Realistic goal in 6 months')}</h3>
        <p>${esc(LX(L().levels[level], 'target'))}</p>
        <label class="adjust">${T('觉得不准？手动选择起点：', "Doesn't look right? Pick your starting level:")}
          <select id="lv">${L().levels.map((l) => `<option value="${l.id}" ${l.id === level ? 'selected' : ''}>${esc(LX(l, 'name'))}（${esc(LX(l, 'desc'))}）</option>`).join('')}</select>
        </label>
        <button class="btn primary block" id="start">${T('生成我的 26 周课程', 'Create my 26-week course')}</button>
      </section>`;
    $('#start').onclick = () => {
      const lv = +$('#lv').value;
      const st = S();
      const firstTime = !st.profile;
      st.profile = { level: lv, placement: { written, speaking: spk, comment, date: today() }, startedAt: st.profile?.startedAt || today() };
      if (firstTime || confirm(T('要按新的水平重新开始 26 周课程吗？（复习卡片会保留）', 'Restart the 26-week course at the new level? (Your review cards are kept.)'))) {
        st.progress = { day: 1, completed: {}, weekScores: {} };
        st.lessons = {};
      }
      save();
      location.hash = '#/plan';
    };
  }

  showSelf();
}

// ---------- 课程表 ----------
function viewPlan() {
  const p = S().progress;
  const curWeek = Math.ceil(Math.min(p.day, TOTAL_DAYS) / DAYS_PER_WEEK);
  const weeks = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const u = unitForWeek(w);
    const lv = levelForUnit(u);
    const days = [];
    for (let d = 1; d <= DAYS_PER_WEEK; d++) {
      const day = (w - 1) * DAYS_PER_WEEK + d;
      const cls = p.completed[day] ? 'done' : day === p.day ? 'current' : day < p.day ? 'done' : '';
      const label = d === DAYS_PER_WEEK ? T('测', 'T') : d;
      days.push(day <= p.day ? `<a class="d ${cls}" href="#/session/${day}">${label}</a>` : `<span class="d">${label}</span>`);
    }
    const sc = p.weekScores[w];
    weeks.push(`
      <div class="week ${w === curWeek ? 'cur' : ''} ${w < curWeek ? 'past' : ''}">
        <div class="week-head"><span class="wk">${T(`第 ${w} 周`, `Week ${w}`)}</span><span class="lv">${esc(levelName(lv))}</span>${sc ? `<span class="sc">${T('测评', 'Test')} ${sc}/5</span>` : ''}</div>
        <div class="week-title">${esc(LX(u, 'title'))}</div>
        <div class="week-grammar">${u.grammar.map(esc).join(' · ')}</div>
        <div class="days">${days.join('')}</div>
      </div>`);
  }
  main().innerHTML = `
    <section class="card">
      <h2>${T('你的 26 周课程', 'Your 26-week course')}</h2>
      <p class="hint">${T(`起点：${esc(levelName(S().profile.level))}。每周 6 节课 + 1 次口语测评，每节 60 分钟。越往后，AI 对话的时间占比越高。错过一天不会跳课，进度按完成的天数推进。`, `Starting level: ${esc(levelName(S().profile.level))}. Each week has 6 lessons and 1 speaking test, 60 minutes each. Later weeks have more AI conversation. Missing a day doesn't skip a lesson: you move on as you finish days.`)}</p>
    </section>
    ${weeks.join('')}`;
  $('.week.cur')?.scrollIntoView({ block: 'center' });
}

// ---------- 每日学习 ----------
async function viewSession(arg) {
  const day = +arg;
  if (!day || day > S().progress.day || day > TOTAL_DAYS) {
    location.hash = '#/';
    return;
  }
  const info = dayInfo(day);
  const steps = info.weekly ? WEEKLY_STEPS : dailySteps(info.unit, info.level);
  const ss = { step: 0, started: Date.now(), stepStarted: Date.now(), lesson: null, history: [], transcript: [], summary: null };
  const timer = setInterval(updateTimer, 1000);
  leaveHook = () => {
    clearInterval(timer);
    // 中途离开也记录学习时长
    if (!ss.completed) logMinutes((Date.now() - ss.started) / 60000);
  };

  main().innerHTML = `
    <div class="session-top">
      <a href="#/" class="back">✕</a>
      <div class="session-title">${T(`第 ${info.week} 周 · 第 ${info.dow} 天`, `Week ${info.week} · Day ${info.dow}`)} · ${esc(LX(info.unit, 'title'))}</div>
      <span id="timer" class="timer"></span>
    </div>
    <div class="stepper">${steps.map((s, i) => `<button data-step="${i}">${i + 1}. ${esc(stepName(s, info.weekly))}</button>`).join('')}</div>
    <div id="step"></div>
    <div class="session-foot"><button class="btn primary block" id="nextStep"></button></div>`;
  $$('[data-step]').forEach((b) => (b.onclick = () => go(+b.dataset.step)));
  $('#nextStep').onclick = () => (ss.step < steps.length - 1 ? go(ss.step + 1) : finishDay());

  function updateTimer() {
    const el = $('#timer');
    if (!el) return;
    const sec = Math.floor((Date.now() - ss.stepStarted) / 1000);
    const goal = steps[ss.step].min;
    el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} / ${goal}:00`;
    el.classList.toggle('over', sec >= goal * 60);
  }

  async function ensureLesson() {
    if (info.weekly) return null;
    if (ss.lesson) return ss.lesson;
    const cached = S().lessons[day];
    // 课程里的说明是按生成时的界面语言写的；换了界面语言就重新生成（旧课程没有 ui 字段，都是中文）
    if (cached && (cached.ui || 'zh') === uiLang()) return (ss.lesson = cached);
    const prev = [];
    for (let d = day - info.dow + 1; d < day; d++) if (S().lessons[d]) prev.push(S().lessons[d].goal_zh);
    ss.lesson = { ...(await generateLesson(info, prev)), ui: uiLang() };
    S().lessons[day] = ss.lesson;
    save();
    return ss.lesson;
  }

  async function go(i) {
    ss.step = i;
    ss.stepStarted = Date.now();
    speechSynthesis.cancel();
    $$('[data-step]').forEach((b, j) => b.classList.toggle('active', j === i));
    $('#nextStep').textContent = i < steps.length - 1 ? `${T('下一步', 'Next')}${COLON()}${stepName(steps[i + 1], info.weekly)} →` : T('✅ 完成今天的学习', "✅ Finish today's lesson");
    updateTimer();
    const box = $('#step');
    const id = steps[i].id;
    if (id === 'review') return renderReview(box, info.weekly ? weekCards() : null);
    if (id === 'kana') return renderKana(box, info);
    if (id === 'summary') return renderSummary(box);
    if (id === 'chat' && info.weekly) return renderChat(box, { system: chatSystem({ level: info.level, exam: info.unit }), opening: null, ss });
    box.innerHTML = spinner(T('正在为你生成今天的课程（约 20–60 秒，只需生成一次）…', "Creating today's lesson (about 20–60 seconds, only once)…"));
    let lesson;
    try {
      lesson = await ensureLesson();
    } catch (e) {
      box.innerHTML = errorBox(e.message) + `<button class="btn" id="retry">${T('重试', 'Retry')}</button> <a class="btn ghost" href="#/settings">${T('设置', 'Settings')}</a>`;
      $('#retry').onclick = () => go(i);
      return;
    }
    if (ss.step !== i) return;
    if (id === 'phrases') renderPhrases(box, lesson);
    if (id === 'shadow') renderShadow(box, lesson);
    if (id === 'chat') renderChat(box, { system: chatSystem({ level: info.level, roleplay: lesson.roleplay }), opening: lesson.roleplay, ss });
  }

  // 本周学过的卡片（周复盘用）：包括未到期的
  function weekCards() {
    const first = day - DAYS_PER_WEEK + 1;
    const ids = new Set();
    for (let d = first; d < day; d++) ids.add(`d${d}`);
    return S().cards.filter((c) => ids.has(c.source) || c.due <= Date.now());
  }

  function renderPhrases(box, L) {
    addCards(L.phrases.map((p) => ({ ...p, note: p.note_zh })), `d${day}`);
    const gram = L.grammar.map((g) => `
      <div class="grammar">
        <h3>${esc(g.point)}</h3>
        <p>${esc(g.explanation_zh)}</p>
        ${g.examples.map((x) => jaBlock(x)).join('')}
      </div>`).join('');
    box.innerHTML = `
      <section class="card goal">🎯 ${esc(L.goal_zh)}</section>
      <section class="card">
        <h2>${T('核心句子', 'Key sentences')}</h2>
        <p class="hint">${T('先听 → 点 🎤 跟读，读错的字会标红，一直练到读对；点 🎙 录一遍听听，会先放你的录音再放标准发音，对比哪里不一样 → 再遮住原文看中文试着说出来。不认识的词，直接点它就能听读音、看解释。这些句子已自动加入复习卡片。', 'Listen first → tap 🎤 to repeat. Wrong sounds turn red; keep going until it\'s right. Tap 🎙 to hear your recording next to the model. Then cover the sentence and try saying it from the meaning. Tap any word you don\'t know to hear it and see what it means. These sentences are added to your review cards.')}</p>
        <div class="pass-count">${T('已读对', 'Correct')} <b id="pc">0</b> / ${L.phrases.length} ${T('句', '')}</div>
        ${L.phrases.map((p) => `<div class="item">${jaBlock({ ...p, note: p.note_zh })}${micButton()}</div>`).join('')}
      </section>
      <section class="card"><h2>${T('语法要点', 'Grammar')}</h2>${gram}</section>`;
    bindShadowMics(box, (i) => [L.phrases[i].ja, L.phrases[i].reading], (n) => ($('#pc', box).textContent = n));
  }

  function renderShadow(box, L) {
    box.innerHTML = `
      <section class="card">
        <h2>${T('影子跟读', 'Shadowing')}</h2>
        <p class="hint">${T('方法：① 先听整段，不看文字；② 逐句跟读，读错的字会标红，每句练到 ✅ 读对；③ 合上中文，紧跟着声音同步说（影子跟读）。', 'How: ① Listen to the whole dialogue without reading. ② Repeat line by line until each one is ✅ correct. ③ Hide the meaning and speak along with the audio (shadowing).')}</p>
        <div class="row">
          <button class="btn" id="playAll">${T('▶ 播放整段', '▶ Play all')}</button>
          <button class="btn ghost" id="slow">${T('🐢 慢速', '🐢 Slow')}</button>
        </div>
        <div class="pass-count">${T('已读对', 'Correct')} <b id="pc">0</b> / ${L.dialogue.length} ${T('句', '')}</div>
        ${L.dialogue.map((l) => `<div class="item line"><span class="spk">${esc(l.speaker)}</span>${jaBlock(l)}${micButton()}</div>`).join('')}
      </section>`;
    let playing = false;
    let rate = S().settings.ttsRate;
    $('#slow').onclick = (e) => {
      rate = rate > 0.75 ? 0.65 : S().settings.ttsRate;
      e.target.textContent = rate < 0.75 ? T('🐇 正常速度', '🐇 Normal speed') : T('🐢 慢速', '🐢 Slow');
    };
    $('#playAll').onclick = async (e) => {
      if (playing) { playing = false; speechSynthesis.cancel(); return; }
      playing = true;
      e.target.textContent = T('■ 停止', '■ Stop');
      const lines = $$('.line', box);
      for (let i = 0; i < L.dialogue.length && playing; i++) {
        lines[i].classList.add('playing');
        await speak(L.dialogue[i].ja, rate);
        lines[i].classList.remove('playing');
        await new Promise((r) => setTimeout(r, 500));
      }
      playing = false;
      e.target.textContent = T('▶ 播放整段', '▶ Play all');
    };
    bindShadowMics(box, (i) => [L.dialogue[i].ja, L.dialogue[i].reading], (n) => ($('#pc', box).textContent = n));
  }

  async function renderSummary(box) {
    const userTurns = ss.transcript.filter((t) => t.role === 'user').length;
    if (!userTurns) {
      box.innerHTML = `<section class="card"><h2>${T('今日总结', "Today's summary")}</h2>
        <p>${T(`今天学习了「${esc(LX(info.unit, 'title'))}」。`, `Today you studied "${esc(LX(info.unit, 'title'))}". `)}${steps.some((s) => s.id === 'chat') ? T('你还没有完成 AI 对话，建议回到对话步骤至少说 5 轮再来总结。', "You haven't done the AI conversation yet. Go back and talk for at least 5 turns, then come back for your summary.") : T('继续保持，明天见！', 'Keep it up, see you tomorrow!')}</p></section>`;
      return;
    }
    if (ss.summary) return showSummary(box, ss.summary);
    box.innerHTML = spinner(T('AI 正在复盘你的对话…', 'AI is reviewing your conversation…'));
    try {
      ss.summary = await summarize({ level: info.level, transcript: transcriptText(ss.transcript), weekly: info.weekly, unit: info.unit });
      const s = ss.summary;
      const n = addCards([
        ...s.mistakes.map((m) => ({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh, note: `${T('之前说成', 'You said')}${COLON()}${m.wrong}` })),
        ...s.new_cards,
      ], `d${day}`);
      s.addedCards = n;
      if (info.weekly) S().progress.weekScores[info.week] = s.score;
      save();
      showSummary(box, s);
    } catch (e) {
      box.innerHTML = errorBox(e.message) + `<button class="btn" id="retry">${T('重试', 'Retry')}</button>`;
      $('#retry').onclick = () => renderSummary(box);
    }
  }

  function showSummary(box, s) {
    const advice = info.weekly
      ? s.score <= 2 ? T('本周内容还不够熟练。建议在课程表里重做本周的 1–2 节课的 AI 对话，再进入下一周。', "This week isn't solid yet. Redo the AI conversation of 1–2 lessons from this week in the Course tab before moving on.")
        : s.score >= 5 ? T('本周掌握得非常好！可以保持节奏，下周的对话会更有挑战。', 'Excellent work this week! Keep going; next week will be more challenging.') : T('掌握得不错，继续前进。', 'Good job, keep going.')
      : '';
    box.innerHTML = `
      <section class="card">
        <h2>${info.weekly ? T('周测评报告', 'Weekly test report') : T('对话复盘', 'Conversation review')}</h2>
        <div class="result-level">${'★'.repeat(s.score)}${'☆'.repeat(5 - s.score)}</div>
        <p>${esc(s.summary_zh)}</p>
        ${advice ? `<p class="comment">${esc(advice)}</p>` : ''}
        <h3>${T('做得好的', 'What went well')}</h3><ul>${s.strengths_zh.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3>${T('需要改正的', 'To fix')}</h3>
        ${s.mistakes.length ? s.mistakes.map((m) => `<div class="mistake"><div class="wrong" lang="${HL()}">✗ ${esc(m.wrong)}</div>${jaBlock({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh }, { showZh: true })}</div>`).join('') : `<p>${T('没有明显错误 👍', 'No obvious mistakes 👍')}</p>`}
        <h3>${T('下次重点', 'Focus next time')}</h3><p>${esc(s.next_focus_zh)}</p>
        <p class="hint">${T(`已把 ${s.addedCards ?? 0} 个句子加入复习卡片。`, `Added ${s.addedCards ?? 0} sentences to your review cards.`)}</p>
      </section>`;
  }

  function finishDay() {
    const minutes = (Date.now() - ss.started) / 60000;
    ss.completed = true;
    completeDay(day, minutes);
    prefetchNext();
    location.hash = '#/';
  }

  go(0);
}

function transcriptText(tr) {
  return tr.map((t) => `${t.role === 'user' ? '学生' : 'AI'}：${t.text}`).join('\n');
}

// 后台预先生成下一天的课程，第二天打开就不用等
function prefetchNext() {
  const next = S().progress.day;
  if (!hasKey() || next > TOTAL_DAYS || S().lessons[next]) return;
  const info = dayInfo(next);
  if (info.weekly) return;
  const prev = [];
  for (let d = next - info.dow + 1; d < next; d++) if (S().lessons[d]) prev.push(S().lessons[d].goal_zh);
  const ui = uiLang();
  generateLesson(info, prev).then((l) => { S().lessons[next] = { ...l, ui }; save(); }).catch(() => {});
}

// ---------- 假名训练 ----------
function renderKana(box, info) {
  const groups = L().kana[info.unit.kana];
  const todays = groups[Math.min(info.dow - 1, groups.length - 1)];
  const learned = groups.slice(0, info.dow).flat();
  // 片假名周也混入平假名复习
  const pool = info.unit.kana === 'katakana' ? [...learned, ...L().kana.hiragana.flat()] : learned;
  box.innerHTML = `
    <section class="card">
      <h2>今天的${info.unit.kana === 'hiragana' ? '平假名' : '片假名'}</h2>
      <p class="hint">点击每个假名听发音，边听边在纸上写 3 遍。</p>
      <div class="kana-grid">${todays.map((k) => `<button class="kana" data-say="${esc(k.k)}"><b lang="${HL()}">${esc(k.k)}</b><small>${esc(k.r)}</small></button>`).join('')}</div>
    </section>
    <section class="card" id="quiz"></section>`;
  let n = 0, right = 0;
  const total = 20;
  function q() {
    if (n >= total) {
      $('#quiz').innerHTML = `<h2>测验完成：${right}/${total}</h2><button class="btn" id="again">再来一轮</button>`;
      $('#again').onclick = () => { n = 0; right = 0; q(); };
      return;
    }
    // 70% 出今天的新假名
    const src = Math.random() < 0.7 ? todays : pool;
    const target = src[Math.floor(Math.random() * src.length)];
    const opts = shuffle([target, ...shuffle(pool.filter((x) => x.r !== target.r)).slice(0, 3)]);
    $('#quiz').innerHTML = `
      <h2>快速认读 ${n + 1}/${total}</h2>
      <div class="kana-q" lang="${HL()}">${esc(target.k)}</div>
      <div class="choices grid4">${opts.map((o) => `<button class="btn" data-r="${esc(o.r)}">${esc(o.r)}</button>`).join('')}</div>`;
    $$('#quiz [data-r]').forEach((b) => (b.onclick = async () => {
      const ok = b.dataset.r === target.r;
      if (ok) right++;
      b.classList.add(ok ? 'ok' : 'bad');
      if (!ok) $(`#quiz [data-r="${CSS.escape(target.r)}"]`)?.classList.add('ok');
      await speak(target.k);
      n++;
      setTimeout(q, ok ? 200 : 700);
    }));
  }
  q();
}

// ---------- 复习（SRS）----------
function renderReview(box, cardsOverride) {
  const list = cardsOverride ? shuffle(cardsOverride).slice(0, 60) : dueCards();
  let i = 0;
  if (!list.length) {
    box.innerHTML = `<section class="card"><h2>${T('没有待复习的卡片 🎉', 'No cards to review 🎉')}</h2><p class="hint">${T('每天学过的句子和对话里说错的句子会自动变成卡片，按遗忘曲线安排复习。', 'Sentences you learn and mistakes from conversations become cards automatically, and come back right before you would forget them.')}</p></section>`;
    return;
  }
  function show() {
    if (i >= list.length) {
      box.innerHTML = `<section class="card"><h2>${T('复习完成 ✅', 'Review done ✅')}</h2><p>${T(`共复习 ${list.length} 张卡片。`, `You reviewed ${list.length} cards.`)}</p></section>`;
      return;
    }
    const c = list[i];
    box.innerHTML = `
      <section class="card srs">
        <div class="test-meta">${i + 1} / ${list.length} · ${L().id === 'zh' ? T('看提示，把这句话说出来', 'Read the hint and say the sentence') : T(`看中文，用${esc(LN())}说出来`, `Say it in ${esc(LN())}`)}</div>
        <div class="srs-front">${esc(c.zh)}</div>
        ${c.note ? `<div class="note">💡 ${esc(c.note)}</div>` : ''}
        ${sttSupported ? micButton(T(`说出${LN()}`, 'Say it')) : ''}
        <div id="back" hidden>${jaBlock(c, { big: true })}</div>
        <button class="btn block" id="show">${T('显示答案', 'Show answer')}</button>
        <div class="grades" hidden>
          <button class="btn g0" data-g="0">${T('忘了', 'Forgot')}<small>${T('10 分钟', '10 min')}</small></button>
          <button class="btn g1" data-g="1">${T('困难', 'Hard')}</button>
          <button class="btn g2" data-g="2">${T('记得', 'Good')}</button>
          <button class="btn g3" data-g="3">${T('简单', 'Easy')}</button>
        </div>
      </section>`;
    bindShadowMics(box, () => [c.ja, c.reading]);
    $('#show').onclick = () => {
      $('#back').hidden = false;
      $('#show').hidden = true;
      $('.grades').hidden = false;
      speak(c.ja);
    };
    $$('[data-g]', box).forEach((b) => (b.onclick = () => {
      gradeCard(c.id, +b.dataset.g);
      i++;
      show();
    }));
  }
  show();
}

function viewReview() {
  main().innerHTML = '<div id="rv"></div>';
  const started = Date.now();
  leaveHook = () => logMinutes((Date.now() - started) / 60000);
  renderReview($('#rv'));
}

// ---------- AI 对话 ----------
function renderChat(box, { system, opening, ss }) {
  const history = ss.history;
  const tr = ss.transcript;
  box.innerHTML = `
    ${opening ? `<section class="card roleplay">
      <h2>🎭 ${esc(opening.scenario_zh)}</h2>
      <p>AI${COLON()}${esc(opening.ai_role_zh)}　${T('你', 'You')}${COLON()}${esc(opening.user_role_zh)}</p>
      <ul class="tasks">${opening.tasks_zh.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>` : ''}
    <div class="chat" id="chatlog"></div>
    <div class="chat-input">
      ${sttSupported ? '<button class="mic big" id="talk">🎤</button>' : ''}
      <textarea id="msg" rows="1" placeholder="${L().id === 'zh' ? T('说中文或打字输入', 'Speak or type in Chinese') : T(`说${esc(LN())}或输入${esc(LN())}（不会说可以打中文问）`, `Speak or type in ${esc(LN())}`)}" lang="${HL()}"></textarea>
      <button class="btn primary" id="send">${T('发送', 'Send')}</button>
    </div>
    <div class="row"><button class="btn ghost" id="hint">💡 ${T('提示', 'Hint')}</button><button class="btn ghost" id="restart">↺ ${T('重新开始', 'Restart')}</button></div>`;
  const log = $('#chatlog', box);
  let lastHint = '';

  function addAI(t) {
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.innerHTML = jaBlock({ ja: t.reply_ja, reading: t.reply_reading, zh: t.reply_zh });
    log.appendChild(div);
    if (t.better_ja || t.correction?.has_error) {
      const prev = log.querySelectorAll('.msg.user');
      const u = prev[prev.length - 1];
      if (u) {
        u.insertAdjacentHTML('beforeend', `<div class="fix">
          ${t.correction?.has_error ? `<div>✏️ <span lang="${HL()}">${esc(t.correction.corrected_ja)}</span> <button class="say sm" data-say="${esc(t.correction.corrected_ja)}">🔊</button></div><div class="why">${esc(t.correction.explanation_zh)}</div>` : ''}
          ${t.better_ja ? `<div>✨ ${T('更地道', 'More natural')}${COLON()}<span lang="${HL()}">${esc(t.better_ja)}</span> <button class="say sm" data-say="${esc(t.better_ja)}">🔊</button></div>` : ''}
        </div>`);
      }
    }
    if (t.finished) log.insertAdjacentHTML('beforeend', `<div class="done-note">${T('✅ 对话任务完成！可以进入下一步，或继续聊。', '✅ Conversation done! Go to the next step, or keep chatting.')}</div>`);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    speak(t.reply_ja);
  }
  function addUser(text) {
    log.insertAdjacentHTML('beforeend', `<div class="msg user"><div lang="${HL()}">${esc(text)}</div></div>`);
  }

  // 恢复已有对话（在步骤之间切换时）
  for (const m of ss.rendered || []) m.role === 'user' ? addUser(m.text) : addAI(m.turn);
  ss.rendered = ss.rendered || [];
  speechSynthesis.cancel();

  async function send(text) {
    text = text.trim();
    if (!text) return;
    addUser(text);
    ss.rendered.push({ role: 'user', text });
    history.push({ role: 'user', content: text });
    tr.push({ role: 'user', text });
    ss.summary = null;
    $('#msg', box).value = '';
    const wait = document.createElement('div');
    wait.className = 'msg ai typing';
    wait.textContent = '…';
    log.appendChild(wait);
    wait.scrollIntoView({ block: 'end' });
    try {
      const t = await chatTurn(system, history);
      wait.remove();
      history.push({ role: 'assistant', content: t.reply_ja });
      tr.push({ role: 'ai', text: t.reply_ja });
      ss.rendered.push({ role: 'ai', turn: t });
      lastHint = t.hint_zh;
      addAI(t);
    } catch (e) {
      wait.remove();
      history.pop();
      tr.pop();
      ss.rendered.pop();
      log.lastElementChild?.remove();
      log.insertAdjacentHTML('beforeend', errorBox(e.message));
      $('#msg', box).value = text;
    }
  }

  async function start() {
    if (ss.rendered.length) return;
    if (opening) {
      // API 要求第一条消息来自用户，因此用一句开场指令引出 AI 的第一句
      history.push({ role: 'user', content: '（开始角色扮演）' }, { role: 'assistant', content: opening.opening_ja });
      tr.push({ role: 'ai', text: opening.opening_ja });
      const t = { reply_ja: opening.opening_ja, reply_reading: '', reply_zh: '', correction: { has_error: false } };
      ss.rendered.push({ role: 'ai', turn: t });
      addAI(t);
    } else {
      await send(L().greeting);
    }
  }

  $('#send', box).onclick = () => send($('#msg', box).value);
  $('#msg', box).onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send($('#msg', box).value);
    }
  };
  $('#hint', box).onclick = () => alert(lastHint || T('先试着回答 AI 的问题吧。可以用今天学的句子！', "Try answering the AI's question first. Use today's sentences!"));
  $('#restart', box).onclick = () => {
    if (!confirm(T('清空这段对话重新开始？', 'Clear this conversation and start over?'))) return;
    history.length = 0; tr.length = 0; ss.rendered.length = 0; ss.summary = null;
    log.innerHTML = '';
    start();
  };
  if (sttSupported) {
    $('#talk', box).onclick = async () => {
      const b = $('#talk', box);
      if (b.classList.contains('listening')) return stopListening(); // 再点一次：说完了
      b.classList.add('listening');
      try {
        const heard = await listen();
        if (heard[0]) {
          $('#msg', box).value = heard[0];
          send(heard[0]);
        }
      } catch (e) {
        alert(e.message);
      }
      b.classList.remove('listening');
    };
  }
  start();
}

function viewChat() {
  const level = S().progress.day <= TOTAL_DAYS ? dayInfo().level : 5;
  const ss = { history: [], transcript: [] };
  const started = Date.now();
  leaveHook = () => logMinutes((Date.now() - started) / 60000);
  main().innerHTML = `
    <section class="card">
      <h2>💬 ${T('自由对话', 'Free chat')}</h2>
      <p class="hint">${T(`想聊什么都行。AI 会按你当前水平（${esc(levelName(level))}）说话，并纠正你的错误。`, `Talk about anything. The AI speaks at your level (${esc(levelName(level))}) and corrects your mistakes.`)}</p>
      <input id="topic" placeholder="${T('话题（可选），如：我喜欢的动漫、明天的面试…', 'Topic (optional), e.g. my favorite game, my school…')}">
      <button class="btn primary block" id="go">${T('开始聊天', 'Start chatting')}</button>
    </section>
    <div id="chatbox"></div>`;
  $('#go').onclick = () => {
    const topic = $('#topic').value.trim();
    if (!hasKey()) {
      $('#chatbox').innerHTML = errorBox(T('请先在「设置」里填写 Claude API Key', 'Please enter your Claude API key in Settings first.'));
      return;
    }
    const system = chatSystem({ level }) + (topic ? `\n这次的话题：${topic}。` : '\n请你先找一个轻松的日常话题开始。');
    $('#go').closest('.card').innerHTML = `<h2>💬 ${esc(topic || T('自由对话', 'Free chat'))}</h2><button class="btn ghost" id="sum">${T('结束并复盘', 'Finish and review')}</button><div id="sumbox"></div>`;
    renderChat($('#chatbox'), { system, opening: null, ss });
    $('#sum').onclick = async () => {
      if (!ss.transcript.some((t) => t.role === 'user')) return;
      $('#sumbox').innerHTML = spinner(T('正在复盘…', 'Reviewing…'));
      try {
        const s = await summarize({ level, transcript: transcriptText(ss.transcript), weekly: false, unit: { title: topic || '自由对话' } });
        const n = addCards([...s.mistakes.map((m) => ({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh, note: `${T('之前说成', 'You said')}${COLON()}${m.wrong}` })), ...s.new_cards], 'chat');
        $('#sumbox').innerHTML = `<p>${'★'.repeat(s.score)}${'☆'.repeat(5 - s.score)} ${esc(s.summary_zh)}</p>
          ${s.mistakes.map((m) => `<div class="mistake"><div class="wrong" lang="${HL()}">✗ ${esc(m.wrong)}</div>${jaBlock({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh }, { showZh: true })}</div>`).join('')}
          <p class="hint">${T(`已加入 ${n} 张复习卡片。`, `Added ${n} review cards.`)}</p>`;
      } catch (e) {
        $('#sumbox').innerHTML = errorBox(e.message);
      }
    };
  };
}

// ---------- 设置 ----------
// 今天和本月的 API 费用，按功能分开
function usageReport() {
  const usage = S().usage || {};
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const sum = (days) => {
    const out = {};
    for (const [d, routes] of Object.entries(usage)) {
      if (!days(d)) continue;
      for (const [r, v] of Object.entries(routes)) {
        const o = (out[r] ||= { calls: 0, cost: 0 });
        o.calls += v.calls;
        o.cost += v.cost;
      }
    }
    return out;
  };
  const todayU = sum((d) => d === today);
  const monthU = sum((d) => d.startsWith(month));
  const total = (u) => Object.values(u).reduce((a, v) => a + v.cost, 0);
  const usd = (n) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
  const routes = ROUTE_IDS.filter((r) => monthU[r]);
  if (!routes.length) return `<p class="hint">${T('还没有记录。用量从这个版本开始统计。', 'Nothing recorded yet.')}</p>`;
  const times = (n) => T(`${n} 次`, `${n}×`);
  return `<div class="stats two"><div><b>${usd(total(todayU))}</b><span>${T('今天', 'Today')}</span></div><div><b>${usd(total(monthU))}</b><span>${T('本月', 'This month')}</span></div></div>
    <table class="usage"><tr><th>${T('功能', 'Feature')}</th><th>${T('今天', 'Today')}</th><th>${T('本月', 'This month')}</th></tr>
    ${routes.map((r) => `<tr><td>${esc(routeName(r))}</td><td>${usd(todayU[r]?.cost || 0)}<small>${times(todayU[r]?.calls || 0)}</small></td><td>${usd(monthU[r].cost)}<small>${times(monthU[r].calls)}</small></td></tr>`).join('')}
    </table>`;
}

function viewSettings() {
  const st = S().settings;
  main().innerHTML = `
    <section class="card">
      <h2>Claude API</h2>
      <label>API Key<input type="password" id="key" value="${esc(st.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
      <label>${T('模型方案', 'AI model')}
        <select id="plan">
          ${[['haiku', T('全部用 Haiku 5.5（最省钱）', 'Haiku 5.5 for everything (cheapest)')], ['tiered', T('分级使用（费用中等）', 'Mixed (medium cost)')], ['opus', T('全部用 Opus 5.5（效果最好，最贵）', 'Opus 5.5 for everything (best, most expensive)')]]
            .map(([v, label]) => `<option value="${v}" ${st.modelPlan === v ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <p class="hint">${T('分级使用：课程生成和水平评估用 Opus 5.5，AI 对话和复盘用 Sonnet 5.5，发音检查和查词用 Haiku 5.5。如果觉得 Haiku 生成的课程或纠错质量不够好，可以换成分级使用。', 'Mixed: Opus 5.5 for lessons and the level test, Sonnet 5.5 for conversation and reviews, Haiku 5.5 for pronunciation checks and word lookup.')}<br>
      ${T('Key 只保存在本设备浏览器中，由浏览器直接请求 Anthropic API。', 'The key is stored only in this browser, which talks to the Anthropic API directly.')}</p>
    </section>
    ${L().defaultUi === 'en' ? `<section class="card">
      <h2>${T('界面语言', 'Interface language')}</h2>
      <select id="ui">
        <option value="en" ${uiLang() === 'en' ? 'selected' : ''}>English</option>
        <option value="zh" ${uiLang() === 'zh' ? 'selected' : ''}>中文</option>
      </select>
      <p class="hint">${T('按钮、提示和 AI 的讲解都用这种语言。', 'Buttons, hints and AI explanations use this language.')}</p>
    </section>` : ''}
    <section class="card">
      <h2>${T('API 用量（估算）', 'API usage (estimate)')}</h2>
      ${usageReport()}
      <p class="hint">${T('按官方价格估算，所有语言合计，只统计这台设备。实际费用以 platform.claude.com 的账单为准。', 'Estimated from official prices, all languages, this device only. Your bill on platform.claude.com is the real number.')}</p>
    </section>
    <section class="card">
      <h2>${T('语音', 'Voice')}</h2>
      <label>${T('朗读速度', 'Speaking speed')} <span id="rv">${st.ttsRate}</span><input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${st.ttsRate}"></label>
      <div class="row"><button class="btn" id="test">🔊 ${T('试听', 'Test')}</button><button class="btn ghost" data-diag>${T('听不到声音？', "Can't hear anything?")}</button></div>
      <label class="check"><input type="checkbox" id="reading" ${st.showReading ? 'checked' : ''}> ${T(`显示${esc(LX(L(), 'readingLabel'))}`, `Show ${esc(LX(L(), 'readingLabel'))}`)}</label>
      <p class="hint">${T('朗读', 'Voice')}${COLON()}${ttsSupported ? (hasVoice() ? T(`✅ 已找到${esc(LN())}语音`, `✅ ${esc(LN())} voice found`) : T(`⚠️ 没找到${esc(LN())}语音，点「听不到声音？」查看解决办法`, `⚠️ No ${esc(LN())} voice found. Tap "Can't hear anything?" for help.`)) : T('❌ 不支持', '❌ Not supported')}<br>
      ${T('语音识别', 'Speech recognition')}${COLON()}${sttSupported ? T('✅ 支持', '✅ Supported') : T('❌ 当前浏览器不支持（可打字代替）。推荐 Android 用 Chrome，iPhone 用 Safari', '❌ Not supported in this browser (you can type instead). Use Chrome on Android or Safari on iPhone.')}<br>
      ${T('跟读录音', 'Recording')}${COLON()}<span id="recmode">${esc(recordModeInfo())}</span> <button class="selfpass inline" id="recreset">${T('重新检测', 'Re-test')}</button></p>
    </section>
    <section class="card">
      <h2>${T('学习语言', 'Language to learn')}</h2>
      ${langSwitcher()}
      <p class="hint">${T('每种语言的水平测试、课程进度和复习卡片分开保存，切换不会丢失进度。', 'Each language keeps its own level, progress and cards. Switching never loses progress.')}</p>
    </section>
    <section class="card">
      <h2>${T('数据', 'Data')}</h2>
      <div class="row wrap">
        <a class="btn" href="#/test">${T('重新测试水平', 'Retake the level test')}</a>
        <button class="btn" id="exp">${T('导出数据', 'Export data')}</button>
        <button class="btn" id="imp">${T('导入数据', 'Import data')}</button>
        <button class="btn danger" id="reset">${T('清空全部数据', 'Erase all data')}</button>
      </div>
      <input type="file" id="file" accept=".json" hidden>
    </section>
    <button class="btn primary block" id="save">${T('保存设置', 'Save settings')}</button>`;
  $('#rate').oninput = (e) => ($('#rv').textContent = e.target.value);
  bindLangSwitcher();
  $('#test').onclick = () => speak(L().sample, +$('#rate').value);
  $('#recreset').onclick = () => {
    resetRecordMode();
    $('#recmode').textContent = recordModeInfo();
  };
  $('#save').onclick = () => {
    st.apiKey = $('#key').value.trim();
    st.modelPlan = $('#plan').value;
    st.ttsRate = +$('#rate').value;
    st.showReading = $('#reading').checked;
    if ($('#ui')) setUiLang($('#ui').value);
    save();
    location.hash = S().profile ? '#/' : '#/welcome';
  };
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    a.download = `nihongo-coach-${today()}.json`;
    a.click();
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    try {
      importData(await e.target.files[0].text());
      alert(T('导入成功', 'Import complete'));
      location.hash = '#/';
    } catch {
      alert(T('文件格式不正确', 'This file is not in the right format'));
    }
  };
  $('#reset').onclick = () => {
    if (confirm(T('确定清空所有学习记录和卡片吗？此操作不可恢复。', 'Erase all progress and cards? This cannot be undone.'))) {
      resetAll();
      location.hash = '#/welcome';
    }
  };
}

// ---------- 启动 ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
router();
