import {
  LANGS, LANG_IDS, TOTAL_WEEKS, DAYS_PER_WEEK, dailySteps, WEEKLY_STEPS,
} from './data.js';
import {
  S, save, resetAll, exportData, importData, TOTAL_DAYS, unitForWeek, levelForUnit, dayInfo,
  completeDay, logMinutes, today, streak, addCards, dueCards, gradeCard, L, switchLang, hasCourse,
} from './store.js';
import {
  speak, listen, recordAttempt, similarity, diffChars, sttSupported, ttsSupported, hasVoice, ttsDiagnosis,
  recordModeInfo, resetRecordMode, canSelfRecord, recordSelf, stopSelfRecording, isSelfRecording,
} from './speech.js';
import {
  hasKey, generateLesson, chatSystem, chatTurn, summarize, evalSpeaking, pronunciationFeedback, lookupWord, ROUTE_NAMES,
} from './ai.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const main = () => $('#main');
// 当前学习语言的 HTML lang 属性（影响字体和浏览器朗读）
const HL = () => L().htmlLang;

// ---------- 通用组件 ----------
// 一行目标语言的句子：原文 + 读音 + 可点开的中文 + 朗读按钮
function jaBlock({ ja, reading, zh, note }, { big = false, showZh = false } = {}) {
  const showReading = S().settings.showReading && reading && reading !== ja;
  return `<div class="ja-block ${big ? 'big' : ''}">
    <div class="ja-row"><button class="say" data-say="${esc(ja)}" aria-label="朗读">🔊</button><span class="ja" lang="${HL()}" data-sent="${esc(ja)}">${tappable(ja)}</span></div>
    ${showReading ? `<div class="reading" lang="${HL()}">${esc(reading)}</div>` : ''}
    ${zh ? `<div class="zh ${showZh ? 'shown' : ''}" data-reveal>${esc(zh)}</div>` : ''}
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
  const cached = (S().dict || {})[`${word}|${sentence}`];
  speak(L().id === 'ja' && cached?.reading ? cached.reading : word);
  const head = `<button class="ws-close" data-wsclose aria-label="关闭">✕</button>
    <div class="ws-word"><span lang="${HL()}">${esc(word)}</span><button class="say" data-say="${esc(word)}">🔊</button></div>`;
  if (!hasKey()) {
    el.innerHTML = `${head}<p class="hint">填写 Claude API Key 后，可以在这里看到这个词的读音和解释。</p>`;
    return;
  }
  const key = `${word}|${sentence}`;
  const dict = S().dict || (S().dict = {});
  let info = dict[key];
  if (!info) {
    el.innerHTML = `${head}<p class="hint">正在查询…</p>`;
    try {
      info = await lookupWord({ word, sentence });
      dict[key] = info;
      save();
    } catch (e) {
      el.innerHTML = `${head}${errorBox(e.message)}`;
      return;
    }
    if (el.dataset.word !== key) return; // 查询期间又点了别的词
  }
  el.innerHTML = `${head}
    <div class="ws-reading" lang="${HL()}">${esc(info.reading)}${info.dictionary_form && info.dictionary_form !== word ? `　原形：${esc(info.dictionary_form)}` : ''}</div>
    <div class="ws-meaning"><span class="ws-pos">${esc(info.pos_zh)}</span>${esc(info.meaning_zh)}</div>
    ${info.usage_zh ? `<p>${esc(info.usage_zh)}</p>` : ''}
    ${info.kanji_zh ? `<p class="ws-kanji">🈶 ${esc(info.kanji_zh)}</p>` : ''}
    <button class="btn sm" data-wsadd>＋ 加入复习卡片</button>`;
  if (L().id === 'ja') $('[data-say]', el).dataset.say = info.reading || word;
  $('[data-wsadd]', el).onclick = (e) => {
    const form = info.dictionary_form || word;
    const n = addCards([{ ja: form, reading: info.reading, zh: info.meaning_zh, note: `出自：${sentence}` }], 'word');
    e.target.textContent = n ? '✅ 已加入' : '已经在卡片里了';
    e.target.disabled = true;
  };
}

function micButton(label = '跟读') {
  return `<div class="practice">
    <div class="pr-btns"><button class="mic" data-mic>🎤 ${label}</button>${canSelfRecord() ? '<button class="mic" data-selfrec>🎙 录一遍听听</button>' : ''}</div>
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
    a.play();
  };
  btn.onclick = async () => {
    if (isSelfRecording()) return stopSelfRecording();
    const micBtn = $('[data-mic]', box);
    micBtn.disabled = true;
    btn.classList.add('listening');
    btn.textContent = '■ 说完会自动停止（点这里停止）';
    try {
      const newUrl = await recordSelf();
      if (!newUrl) {
        out.innerHTML = '<div class="pr-result fail">没有录到声音，再试一次</div>';
        return;
      }
      if (url) URL.revokeObjectURL(url);
      url = newUrl;
      out.innerHTML = `<div class="self-result">
        <span>🎙 你的录音：</span>
        <button class="btn sm" data-playself>▶ 我的录音</button>
        <button class="btn sm" data-compare>🔁 我的 + 标准对比</button></div>`;
      $('[data-playself]', out).onclick = () => { speechSynthesis.cancel(); new Audio(url).play(); };
      $('[data-compare]', out).onclick = playCompare;
      playCompare();
    } catch (e) {
      out.innerHTML = `<div class="pr-result fail">${esc(e.message)}</div>`;
    } finally {
      micBtn.disabled = false;
      btn.classList.remove('listening');
      btn.textContent = '🎙 再录一遍';
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
      const [ja, reading] = getTargets(i);
      btn.disabled = true;
      btn.classList.add('listening');
      btn.textContent = '🎤 请开始说…';
      try {
        const { alts, audioUrl } = await recordAttempt();
        if (myAudio) URL.revokeObjectURL(myAudio);
        myAudio = audioUrl;
        if (!alts.length) {
          out.innerHTML = '<div class="pr-result fail">没听清，靠近一点再试一次</div>';
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
          const head = ok ? '✅ 读对了！' : st === 'checking' ? '🤖 AI 正在检查你的发音…' : '还没读对，看看下面的说明，听一下区别再试一次';
          const ai = fb?.problems ? fb : null;
          out.innerHTML = `
            <div class="pr-result ${st}">
              <div class="pr-head"><span class="score ${ok ? 's3' : st === 'checking' ? 's2' : 's1'}">${score}%</span><span>第 ${tries} 次 · ${head}</span></div>
              ${exact ? '' : `<div class="pr-diff" lang="${HL()}">${diff.map((d) => (d.ok ? esc(d.c) : `<mark>${esc(d.c)}</mark>`)).join('')}</div>
              <div class="pr-legend">${ok && selfPassed ? '你确认了读对（语音识别可能听错了）。' : ok && ai ? 'AI 判断：标红处只是汉字和假名的写法不同，发音是对的。' : '标红的是没读出来或读错的部分'}</div>`}
              <div class="pr-heard">识别到：<span lang="${HL()}">${esc(alts[0])}</span></div>
              ${ai && (ai.problems.length || ai.tip_zh) ? `<div class="pr-ai">
                ${ai.problems.map((p) => `<div class="pr-problem"><b lang="${HL()}">${esc(p.part)}</b>：${esc(p.issue_zh)}<div class="how">👉 ${esc(p.how_zh)}</div></div>`).join('')}
                ${ai.tip_zh ? `<div class="pr-tip">💡 ${esc(ai.tip_zh)}</div>` : ''}</div>` : ''}
              <div class="pr-actions">
                ${myAudio ? '<button class="btn sm" data-mine>▶ 我的录音</button>' : ''}
                <button class="btn sm" data-say="${esc(ja)}">🔊 标准发音</button>
                <button class="btn sm" data-slow>🐢 慢速</button>
              </div>
              ${st === 'fail' ? '<button class="selfpass" data-selfpass>识别错了？我确定读对了</button>' : ''}
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
        btn.disabled = false;
        btn.classList.remove('listening');
        btn.textContent = tries ? '🎤 再读一次' : label;
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
  closeWordSheet();
  if (leaveHook) leaveHook();
  leaveHook = null;
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (!S().profile && !['welcome', 'test', 'settings'].includes(name)) {
    location.hash = '#/welcome';
    return;
  }
  document.title = L().appTitle;
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (name || 'home')));
  document.body.classList.toggle('no-tabs', ['welcome', 'test', 'session'].includes(name));
  window.scrollTo(0, 0);
  (routes[name] || viewHome)(arg);
}
window.addEventListener('hashchange', router);

// ---------- 语言切换 ----------
function langSwitcher() {
  return `<div class="lang-switch">${LANG_IDS.map((id) => `<button class="${id === L().id ? 'active' : ''}" data-lang="${id}">${LANGS[id].flag} ${esc(LANGS[id].name)}</button>`).join('')}</div>`;
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
  const todayMin = st.log[today()] || 0;
  const scores = Object.entries(p.weekScores);
  main().innerHTML = `
    ${langSwitcher()}
    <header class="hero">
      <div class="level-badge">${L().flag} ${esc(L().name)} · 当前水平 · ${esc(L().levels[info ? info.level : 5].name)}</div>
      <h1>${finished ? '🎉 26 周课程完成！' : `第 ${info.week} 周 · 第 ${info.dow} 天`}</h1>
      ${info ? `<p class="unit-title">${esc(info.unit.title)}${info.weekly ? ' · 周复盘与口语测评' : ''}</p>` : '<p>建议重新做一次水平测试，看看半年的进步。</p>'}
    </header>
    <div class="stats">
      <div><b>${done}</b><span>/ ${TOTAL_DAYS} 天</span></div>
      <div><b>${streak()}</b><span>连续天数</span></div>
      <div><b>${todayMin}</b><span>今日分钟</span></div>
      <div><b>${due}</b><span>待复习</span></div>
    </div>
    <div class="progress"><div style="width:${Math.min(100, (done / TOTAL_DAYS) * 100)}%"></div></div>
    ${info ? `
    <section class="card">
      <h2>今天的 60 分钟</h2>
      <ol class="steps-preview">${steps.map((s) => `<li><span>${esc(s.name)}</span><span>${s.min} 分钟</span></li>`).join('')}</ol>
      <a class="btn primary block" href="#/session/${info.day}">开始今天的学习</a>
      ${!hasKey() ? '<p class="hint">⚠️ 还没有填写 Claude API Key，课程生成和 AI 对话无法使用。<a href="#/settings">去设置</a></p>' : ''}
    </section>` : `<section class="card"><a class="btn primary block" href="#/test">重新测试水平</a></section>`}
    <section class="card">
      <h2>目标</h2>
      <p>${esc(L().levels[st.profile.level].target)}</p>
      ${scores.length ? `<h3>每周口语测评</h3><div class="score-bars">${scores.map(([w, s]) => `<div title="第${w}周：${s}/5"><i style="height:${s * 20}%"></i><span>${w}</span></div>`).join('')}</div>` : ''}
    </section>
    <section class="quick">
      <a class="card link" href="#/review">🔁 复习卡片<small>${due} 张待复习</small></a>
      <a class="card link" href="#/chat">💬 自由对话<small>随时和 AI 聊天</small></a>
    </section>`;
  bindLangSwitcher();
}

// ---------- 欢迎页 ----------
function viewWelcome() {
  const { name } = L();
  main().innerHTML = `
    <section class="welcome">
      <div class="logo">${L().flag}</div>
      <h1>${esc(L().appTitle)}</h1>
      <p class="lead">每天 1 小时，26 周，用最高效的方法练到能开口说${esc(name)}。</p>
      <div class="card">
        <h2>想学哪种语言？</h2>
        ${langSwitcher()}
        <p class="hint">每种语言有自己的水平测试、课程和复习卡片，随时可以在首页切换。</p>
      </div>
      <div class="card">
        <h2>它怎么帮你</h2>
        <ul class="method">
          <li><b>先测水平</b>：笔试 + 口语测试，从适合你的单元开始，不浪费时间。</li>
          <li><b>整句学习</b>：每天 8 个高频句子，直接学能说出口的整句。</li>
          <li><b>影子跟读</b>：跟着朗读逐句模仿，语音识别给发音打分。</li>
          <li><b>AI 情景对话</b>：每天和 AI 角色扮演，实时纠错，这是提升口语最关键的一环。</li>
          <li><b>间隔复习</b>：看中文说${esc(name)}，按遗忘曲线安排复习，记住你说错过的句子。</li>
          <li><b>每周测评</b>：第 7 天做口语测评，跟踪进步并调整节奏。</li>
        </ul>
      </div>
      <div class="card">
        <h2>Claude API Key</h2>
        <p class="hint">课程内容和 AI 对话需要 API Key（在 console.anthropic.com 获取）。Key 只保存在这台设备的浏览器里。也可以先跳过，之后在设置里填。</p>
        <input type="password" id="key" placeholder="sk-ant-..." value="${esc(S().settings.apiKey)}" autocomplete="off">
      </div>
      <button class="btn primary block" id="go">开始水平测试</button>
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
        <h2>水平测试 · 1/3 基本情况</h2>
        <p>${esc(L().selfCheck.q)}</p>
        <div class="choices">
          ${L().selfCheck.options.map((o, i) => `<button class="btn" data-k="${i}">${esc(o.label)}</button>`).join('')}
        </div>
        <p class="hint">接下来的笔试会自动调整难度，遇到不会的题请选「不知道」，不要猜，这样结果更准。</p>
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
        <h2>水平测试 · 2/3 笔试与听力</h2>
        <div class="test-meta">难度 ${t.lv}/5 · 第 ${qNo} 题</div>
        ${it.type === 'listen' ? `<button class="btn big-say" data-say="${esc(it.audio)}">🔊 播放语音</button><button class="diag" data-diag>听不到声音？</button>` : ''}
        <p class="question" lang="${HL()}">${esc(it.q)}</p>
        <div class="choices">
          ${it.options.map((o, i) => `<button class="btn" data-i="${i}" lang="${HL()}">${esc(o)}</button>`).join('')}
          <button class="btn ghost" data-i="-1">不知道</button>
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
        <h2>水平测试 · 3/3 口语</h2>
        <div class="test-meta">第 ${i + 1} / ${L().speaking.length} 题 · 听问题，用${esc(L().name)}回答</div>
        <button class="btn big-say" data-say="${esc(q)}">🔊 再听一次</button><button class="diag" data-diag>听不到声音？</button>
        <p class="question zh" data-reveal lang="${HL()}">${esc(q)}<small>（点击显示文字）</small></p>
        ${sttSupported ? '<button class="mic big" id="rec">🎤 按下后开始说</button>' : ''}
        <textarea id="ans" rows="2" placeholder="识别结果会出现在这里，也可以直接打字输入" lang="${HL()}"></textarea>
        <div class="row">
          <button class="btn ghost" id="skip">听不懂 / 跳过</button>
          <button class="btn primary" id="next">下一题</button>
        </div>
      </section>`;
    setTimeout(() => speak(q), 300);
    if (sttSupported) {
      $('#rec').onclick = async () => {
        const btn = $('#rec');
        btn.classList.add('listening');
        btn.textContent = '🎤 正在听…';
        try {
          const heard = await listen();
          if (heard[0]) $('#ans').value = heard[0];
        } catch (e) {
          alert(e.message);
        }
        btn.classList.remove('listening');
        btn.textContent = '🎤 重新说';
      };
    }
    $('#skip').onclick = () => { t.qa.push({ q, a: '' }); showSpeak(i + 1); };
    $('#next').onclick = () => { t.qa.push({ q, a: $('#ans').value.trim() }); showSpeak(i + 1); };
  }

  async function evalSpeak() {
    main().innerHTML = spinner('AI 正在评估你的口语水平…');
    try {
      const r = await evalSpeaking(t.qa);
      const spk = Math.max(0, Math.min(5, r.speaking_level));
      // 课程以口语为目标：综合笔试与口语，取偏向口语的平均值
      finish(Math.floor((t.passed + spk) / 2), spk, r.comment_zh);
    } catch (e) {
      finish(t.passed, null, `口语评估失败（${e.message}），暂按笔试结果定级。`);
    }
  }

  function finish(level, spk, comment) {
    const written = t.passed;
    main().innerHTML = `
      <section class="card result">
        <h2>测试结果</h2>
        <div class="result-level">${esc(L().levels[level].name)}</div>
        <p>${esc(L().levels[level].desc)}</p>
        <div class="stats two">
          <div><b>${esc(L().levels[written].name)}</b><span>笔试/听力</span></div>
          <div><b>${spk == null ? '—' : esc(L().levels[spk].name)}</b><span>口语</span></div>
        </div>
        ${comment ? `<p class="comment">${esc(comment)}</p>` : ''}
        <h3>半年后的现实目标</h3>
        <p>${esc(L().levels[level].target)}</p>
        <label class="adjust">觉得不准？手动选择起点：
          <select id="lv">${L().levels.map((l) => `<option value="${l.id}" ${l.id === level ? 'selected' : ''}>${esc(l.name)}（${esc(l.desc)}）</option>`).join('')}</select>
        </label>
        <button class="btn primary block" id="start">生成我的 26 周课程</button>
      </section>`;
    $('#start').onclick = () => {
      const lv = +$('#lv').value;
      const st = S();
      const firstTime = !st.profile;
      st.profile = { level: lv, placement: { written, speaking: spk, comment, date: today() }, startedAt: st.profile?.startedAt || today() };
      if (firstTime || confirm('要按新的水平重新开始 26 周课程吗？（复习卡片会保留）')) {
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
      const label = d === DAYS_PER_WEEK ? '测' : d;
      days.push(day <= p.day ? `<a class="d ${cls}" href="#/session/${day}">${label}</a>` : `<span class="d">${label}</span>`);
    }
    const sc = p.weekScores[w];
    weeks.push(`
      <div class="week ${w === curWeek ? 'cur' : ''} ${w < curWeek ? 'past' : ''}">
        <div class="week-head"><span class="wk">第 ${w} 周</span><span class="lv">${esc(L().levels[lv].name)}</span>${sc ? `<span class="sc">测评 ${sc}/5</span>` : ''}</div>
        <div class="week-title">${esc(u.title)}</div>
        <div class="week-grammar">${u.grammar.map(esc).join(' · ')}</div>
        <div class="days">${days.join('')}</div>
      </div>`);
  }
  main().innerHTML = `
    <section class="card">
      <h2>你的 26 周课程</h2>
      <p class="hint">起点：${esc(L().levels[S().profile.level].name)}。每周 6 节课 + 1 次口语测评，每节 60 分钟。越往后，AI 对话的时间占比越高。错过一天不会跳课，进度按完成的天数推进。</p>
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
      <div class="session-title">第 ${info.week} 周 · 第 ${info.dow} 天 · ${esc(info.unit.title)}</div>
      <span id="timer" class="timer"></span>
    </div>
    <div class="stepper">${steps.map((s, i) => `<button data-step="${i}">${i + 1}. ${esc(s.name)}</button>`).join('')}</div>
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
    if (cached) return (ss.lesson = cached);
    const prev = [];
    for (let d = day - info.dow + 1; d < day; d++) if (S().lessons[d]) prev.push(S().lessons[d].goal_zh);
    ss.lesson = await generateLesson(info, prev);
    S().lessons[day] = ss.lesson;
    save();
    return ss.lesson;
  }

  async function go(i) {
    ss.step = i;
    ss.stepStarted = Date.now();
    speechSynthesis.cancel();
    $$('[data-step]').forEach((b, j) => b.classList.toggle('active', j === i));
    $('#nextStep').textContent = i < steps.length - 1 ? `下一步：${steps[i + 1].name} →` : '✅ 完成今天的学习';
    updateTimer();
    const box = $('#step');
    const id = steps[i].id;
    if (id === 'review') return renderReview(box, info.weekly ? weekCards() : null);
    if (id === 'kana') return renderKana(box, info);
    if (id === 'summary') return renderSummary(box);
    if (id === 'chat' && info.weekly) return renderChat(box, { system: chatSystem({ level: info.level, exam: info.unit }), opening: null, ss });
    box.innerHTML = spinner('正在为你生成今天的课程（约 20–60 秒，只需生成一次）…');
    let lesson;
    try {
      lesson = await ensureLesson();
    } catch (e) {
      box.innerHTML = errorBox(e.message) + '<button class="btn" id="retry">重试</button> <a class="btn ghost" href="#/settings">设置</a>';
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
        <h2>核心句子</h2>
        <p class="hint">先听 → 点 🎤 跟读，读错的字会标红，一直练到读对；点 🎙 录一遍听听，会先放你的录音再放标准发音，对比哪里不一样 → 再遮住原文看中文试着说出来。不认识的词，直接点它就能听读音、看解释。这些句子已自动加入复习卡片。</p>
        <div class="pass-count">已读对 <b id="pc">0</b> / ${L.phrases.length} 句</div>
        ${L.phrases.map((p) => `<div class="item">${jaBlock({ ...p, note: p.note_zh })}${micButton()}</div>`).join('')}
      </section>
      <section class="card"><h2>语法要点</h2>${gram}</section>`;
    bindShadowMics(box, (i) => [L.phrases[i].ja, L.phrases[i].reading], (n) => ($('#pc', box).textContent = n));
  }

  function renderShadow(box, L) {
    box.innerHTML = `
      <section class="card">
        <h2>影子跟读</h2>
        <p class="hint">方法：① 先听整段，不看文字；② 逐句跟读，读错的字会标红，每句练到 ✅ 读对；③ 合上中文，紧跟着声音同步说（影子跟读）。</p>
        <div class="row">
          <button class="btn" id="playAll">▶ 播放整段</button>
          <button class="btn ghost" id="slow">🐢 慢速</button>
        </div>
        <div class="pass-count">已读对 <b id="pc">0</b> / ${L.dialogue.length} 句</div>
        ${L.dialogue.map((l) => `<div class="item line"><span class="spk">${esc(l.speaker)}</span>${jaBlock(l)}${micButton()}</div>`).join('')}
      </section>`;
    let playing = false;
    let rate = S().settings.ttsRate;
    $('#slow').onclick = (e) => {
      rate = rate > 0.75 ? 0.65 : S().settings.ttsRate;
      e.target.textContent = rate < 0.75 ? '🐇 正常速度' : '🐢 慢速';
    };
    $('#playAll').onclick = async (e) => {
      if (playing) { playing = false; speechSynthesis.cancel(); return; }
      playing = true;
      e.target.textContent = '■ 停止';
      const lines = $$('.line', box);
      for (let i = 0; i < L.dialogue.length && playing; i++) {
        lines[i].classList.add('playing');
        await speak(L.dialogue[i].ja, rate);
        lines[i].classList.remove('playing');
        await new Promise((r) => setTimeout(r, 500));
      }
      playing = false;
      e.target.textContent = '▶ 播放整段';
    };
    bindShadowMics(box, (i) => [L.dialogue[i].ja, L.dialogue[i].reading], (n) => ($('#pc', box).textContent = n));
  }

  async function renderSummary(box) {
    const userTurns = ss.transcript.filter((t) => t.role === 'user').length;
    if (!userTurns) {
      box.innerHTML = `<section class="card"><h2>今日总结</h2>
        <p>今天学习了「${esc(info.unit.title)}」。${steps.some((s) => s.id === 'chat') ? '你还没有完成 AI 对话，建议回到对话步骤至少说 5 轮再来总结。' : '继续保持，明天见！'}</p></section>`;
      return;
    }
    if (ss.summary) return showSummary(box, ss.summary);
    box.innerHTML = spinner('AI 正在复盘你的对话…');
    try {
      ss.summary = await summarize({ level: info.level, transcript: transcriptText(ss.transcript), weekly: info.weekly, unit: info.unit });
      const s = ss.summary;
      const n = addCards([
        ...s.mistakes.map((m) => ({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh, note: `之前说成：${m.wrong}` })),
        ...s.new_cards,
      ], `d${day}`);
      s.addedCards = n;
      if (info.weekly) S().progress.weekScores[info.week] = s.score;
      save();
      showSummary(box, s);
    } catch (e) {
      box.innerHTML = errorBox(e.message) + '<button class="btn" id="retry">重试</button>';
      $('#retry').onclick = () => renderSummary(box);
    }
  }

  function showSummary(box, s) {
    const advice = info.weekly
      ? s.score <= 2 ? '本周内容还不够熟练。建议在课程表里重做本周的 1–2 节课的 AI 对话，再进入下一周。'
        : s.score >= 5 ? '本周掌握得非常好！可以保持节奏，下周的对话会更有挑战。' : '掌握得不错，继续前进。'
      : '';
    box.innerHTML = `
      <section class="card">
        <h2>${info.weekly ? '周测评报告' : '对话复盘'}</h2>
        <div class="result-level">${'★'.repeat(s.score)}${'☆'.repeat(5 - s.score)}</div>
        <p>${esc(s.summary_zh)}</p>
        ${advice ? `<p class="comment">${esc(advice)}</p>` : ''}
        <h3>做得好的</h3><ul>${s.strengths_zh.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3>需要改正的</h3>
        ${s.mistakes.length ? s.mistakes.map((m) => `<div class="mistake"><div class="wrong" lang="${HL()}">✗ ${esc(m.wrong)}</div>${jaBlock({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh }, { showZh: true })}</div>`).join('') : '<p>没有明显错误 👍</p>'}
        <h3>下次重点</h3><p>${esc(s.next_focus_zh)}</p>
        <p class="hint">已把 ${s.addedCards ?? 0} 个句子加入复习卡片。</p>
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
  generateLesson(info, prev).then((l) => { S().lessons[next] = l; save(); }).catch(() => {});
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
    box.innerHTML = `<section class="card"><h2>没有待复习的卡片 🎉</h2><p class="hint">每天学过的句子和对话里说错的句子会自动变成卡片，按遗忘曲线安排复习。</p></section>`;
    return;
  }
  function show() {
    if (i >= list.length) {
      box.innerHTML = `<section class="card"><h2>复习完成 ✅</h2><p>共复习 ${list.length} 张卡片。</p></section>`;
      return;
    }
    const c = list[i];
    box.innerHTML = `
      <section class="card srs">
        <div class="test-meta">${i + 1} / ${list.length} · ${L().id === 'zh' ? '看提示，把这句话说出来' : `看中文，用${esc(L().name)}说出来`}</div>
        <div class="srs-front">${esc(c.zh)}</div>
        ${c.note ? `<div class="note">💡 ${esc(c.note)}</div>` : ''}
        ${sttSupported ? micButton(`说出${L().name}`) : ''}
        <div id="back" hidden>${jaBlock(c, { big: true })}</div>
        <button class="btn block" id="show">显示答案</button>
        <div class="grades" hidden>
          <button class="btn g0" data-g="0">忘了<small>10 分钟</small></button>
          <button class="btn g1" data-g="1">困难</button>
          <button class="btn g2" data-g="2">记得</button>
          <button class="btn g3" data-g="3">简单</button>
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
      <p>AI：${esc(opening.ai_role_zh)}　你：${esc(opening.user_role_zh)}</p>
      <ul class="tasks">${opening.tasks_zh.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>` : ''}
    <div class="chat" id="chatlog"></div>
    <div class="chat-input">
      ${sttSupported ? '<button class="mic big" id="talk">🎤</button>' : ''}
      <textarea id="msg" rows="1" placeholder="${L().id === 'zh' ? '说中文或打字输入' : `说${esc(L().name)}或输入${esc(L().name)}（不会说可以打中文问）`}" lang="${HL()}"></textarea>
      <button class="btn primary" id="send">发送</button>
    </div>
    <div class="row"><button class="btn ghost" id="hint">💡 提示</button><button class="btn ghost" id="restart">↺ 重新开始</button></div>`;
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
          ${t.better_ja ? `<div>✨ 更地道：<span lang="${HL()}">${esc(t.better_ja)}</span> <button class="say sm" data-say="${esc(t.better_ja)}">🔊</button></div>` : ''}
        </div>`);
      }
    }
    if (t.finished) log.insertAdjacentHTML('beforeend', '<div class="done-note">✅ 对话任务完成！可以进入下一步，或继续聊。</div>');
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
      await send('よろしくお願いします。');
    }
  }

  $('#send', box).onclick = () => send($('#msg', box).value);
  $('#msg', box).onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send($('#msg', box).value);
    }
  };
  $('#hint', box).onclick = () => alert(lastHint || '先试着回答 AI 的问题吧。可以用今天学的句子！');
  $('#restart', box).onclick = () => {
    if (!confirm('清空这段对话重新开始？')) return;
    history.length = 0; tr.length = 0; ss.rendered.length = 0; ss.summary = null;
    log.innerHTML = '';
    start();
  };
  if (sttSupported) {
    $('#talk', box).onclick = async () => {
      const b = $('#talk', box);
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
      <h2>💬 自由对话</h2>
      <p class="hint">想聊什么都行。AI 会按你当前水平（${esc(L().levels[level].name)}）说话，并纠正你的错误。</p>
      <input id="topic" placeholder="话题（可选），如：我喜欢的动漫、明天的面试…">
      <button class="btn primary block" id="go">开始聊天</button>
    </section>
    <div id="chatbox"></div>`;
  $('#go').onclick = () => {
    const topic = $('#topic').value.trim();
    if (!hasKey()) {
      $('#chatbox').innerHTML = errorBox('请先在「设置」里填写 Claude API Key');
      return;
    }
    const system = chatSystem({ level }) + (topic ? `\n这次的话题：${topic}。` : '\n请你先找一个轻松的日常话题开始。');
    $('#go').closest('.card').innerHTML = `<h2>💬 ${esc(topic || '自由对话')}</h2><button class="btn ghost" id="sum">结束并复盘</button><div id="sumbox"></div>`;
    renderChat($('#chatbox'), { system, opening: null, ss });
    $('#sum').onclick = async () => {
      if (!ss.transcript.some((t) => t.role === 'user')) return;
      $('#sumbox').innerHTML = spinner('正在复盘…');
      try {
        const s = await summarize({ level, transcript: transcriptText(ss.transcript), weekly: false, unit: { title: topic || '自由对话' } });
        const n = addCards([...s.mistakes.map((m) => ({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh, note: `之前说成：${m.wrong}` })), ...s.new_cards], 'chat');
        $('#sumbox').innerHTML = `<p>${'★'.repeat(s.score)}${'☆'.repeat(5 - s.score)} ${esc(s.summary_zh)}</p>
          ${s.mistakes.map((m) => `<div class="mistake"><div class="wrong" lang="${HL()}">✗ ${esc(m.wrong)}</div>${jaBlock({ ja: m.correct_ja, reading: m.reading, zh: m.explanation_zh }, { showZh: true })}</div>`).join('')}
          <p class="hint">已加入 ${n} 张复习卡片。</p>`;
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
  const routes = Object.keys(ROUTE_NAMES).filter((r) => monthU[r]);
  if (!routes.length) return '<p class="hint">还没有记录。用量从这个版本开始统计。</p>';
  return `<div class="stats two"><div><b>${usd(total(todayU))}</b><span>今天</span></div><div><b>${usd(total(monthU))}</b><span>本月</span></div></div>
    <table class="usage"><tr><th>功能</th><th>今天</th><th>本月</th></tr>
    ${routes.map((r) => `<tr><td>${esc(ROUTE_NAMES[r])}</td><td>${usd(todayU[r]?.cost || 0)}<small>${todayU[r]?.calls || 0} 次</small></td><td>${usd(monthU[r].cost)}<small>${monthU[r].calls} 次</small></td></tr>`).join('')}
    </table>`;
}

function viewSettings() {
  const st = S().settings;
  main().innerHTML = `
    <section class="card">
      <h2>Claude API</h2>
      <label>API Key<input type="password" id="key" value="${esc(st.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
      <label>模型方案
        <select id="plan">
          <option value="tiered" ${st.modelPlan !== 'opus' ? 'selected' : ''}>分级使用（推荐，省钱）</option>
          <option value="opus" ${st.modelPlan === 'opus' ? 'selected' : ''}>全部用 Opus 5.5（效果最好，最贵）</option>
        </select>
      </label>
      <p class="hint">分级使用：课程生成和水平评估用 Opus 5.5，AI 对话和复盘用 Sonnet 5.5，发音检查和查词用 Haiku 5.5。<br>
      Key 只保存在本设备浏览器中，由浏览器直接请求 Anthropic API。</p>
    </section>
    <section class="card">
      <h2>API 用量（估算）</h2>
      ${usageReport()}
      <p class="hint">按官方价格估算，所有语言合计，只统计这台设备。实际费用以 platform.claude.com 的账单为准。</p>
    </section>
    <section class="card">
      <h2>语音</h2>
      <label>朗读速度 <span id="rv">${st.ttsRate}</span><input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${st.ttsRate}"></label>
      <div class="row"><button class="btn" id="test">🔊 试听</button><button class="btn ghost" data-diag>听不到声音？</button></div>
      <label class="check"><input type="checkbox" id="reading" ${st.showReading ? 'checked' : ''}> 显示${esc(L().readingLabel)}</label>
      <p class="hint">朗读：${ttsSupported ? (hasVoice() ? `✅ 已找到${esc(L().name)}语音` : `⚠️ 没找到${esc(L().name)}语音，点「听不到声音？」查看解决办法`) : '❌ 不支持'}<br>
      语音识别：${sttSupported ? '✅ 支持' : '❌ 当前浏览器不支持（可打字代替）。推荐 Android 用 Chrome，iPhone 用 Safari'}<br>
      跟读录音：<span id="recmode">${esc(recordModeInfo())}</span> <button class="selfpass inline" id="recreset">重新检测</button></p>
    </section>
    <section class="card">
      <h2>学习语言</h2>
      ${langSwitcher()}
      <p class="hint">每种语言的水平测试、课程进度和复习卡片分开保存，切换不会丢失进度。</p>
    </section>
    <section class="card">
      <h2>数据</h2>
      <div class="row wrap">
        <a class="btn" href="#/test">重新测试水平</a>
        <button class="btn" id="exp">导出数据</button>
        <button class="btn" id="imp">导入数据</button>
        <button class="btn danger" id="reset">清空全部数据</button>
      </div>
      <input type="file" id="file" accept=".json" hidden>
    </section>
    <button class="btn primary block" id="save">保存设置</button>`;
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
      alert('导入成功');
      location.hash = '#/';
    } catch {
      alert('文件格式不正确');
    }
  };
  $('#reset').onclick = () => {
    if (confirm('确定清空所有学习记录和卡片吗？此操作不可恢复。')) {
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
