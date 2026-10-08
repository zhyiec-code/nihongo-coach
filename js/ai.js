// Claude API：生成课程、情景对话陪练、纠错总结、口语评估
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm';
import { S, L, save } from './store.js';

export const hasKey = () => !!S().settings.apiKey;

let client = null;
let clientKey = '';
function getClient() {
  const key = S().settings.apiKey;
  if (!key) throw new Error('请先在「设置」里填写 Claude API Key');
  if (!client || clientKey !== key) {
    // API Key 只保存在本机浏览器里，由浏览器直接请求 Anthropic API
    client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    clientKey = key;
  }
  return client;
}

// 每个功能用哪个模型、什么思考深度。"tiered"（默认）按任务难度分配模型来省钱：
// 每天一次、决定教学质量的课程生成和水平评估用 Opus 5.5；对话和复盘用 Sonnet 5.5；
// 次数多、任务简单的发音检查和查词用 Haiku 5.5。"opus" 全部用 Opus 5.5。
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';
const ROUTES = {
  lesson: { name: '课程生成', model: OPUS, effort: 'medium' },
  speaking: { name: '水平评估', model: OPUS, effort: 'medium' },
  chat: { name: 'AI 对话', model: SONNET, effort: 'low' },
  summary: { name: '对话复盘', model: SONNET, effort: 'medium' },
  pron: { name: '发音检查', model: HAIKU, effort: 'low' },
  lookup: { name: '点词查询', model: HAIKU, effort: 'low' },
};
export const ROUTE_NAMES = Object.fromEntries(Object.entries(ROUTES).map(([k, v]) => [k, v.name]));
function routeModel(route) {
  return S().settings.modelPlan === 'opus' ? OPUS : ROUTES[route].model;
}

// 每百万 token 的美元价格（2026-10-07 取自官方价格页 platform.claude.com/docs/en/about-claude/pricing）。
// Haiku 5.5 为 10 万 token 以内的价格，本应用的请求都远小于这个长度
const PRICES = {
  [OPUS]: { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  [SONNET]: { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  [HAIKU]: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
};
// 记录每次调用的用量和估算费用（按天、按功能），在设置页显示
function recordUsage(route, res) {
  const u = res.usage || {};
  // 被安全分类器转交给其他模型时 res.model 会不同；不在价格表里的模型按 Opus 5.5 估算（偏高）
  const p = PRICES[res.model] || PRICES[OPUS];
  const cost = ((u.input_tokens || 0) * p.input + (u.cache_creation_input_tokens || 0) * p.cacheWrite
    + (u.cache_read_input_tokens || 0) * p.cacheRead + (u.output_tokens || 0) * p.output) / 1e6;
  const st = S();
  const day = new Date().toISOString().slice(0, 10);
  const d = ((st.usage ||= {})[day] ||= {});
  const r = (d[route] ||= { calls: 0, cost: 0, input: 0, cacheRead: 0, output: 0 });
  r.calls++;
  r.cost += cost;
  r.input += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  r.cacheRead += u.cache_read_input_tokens || 0;
  r.output += u.output_tokens || 0;
  save();
}

// 发送一次请求并按 JSON Schema 返回结构化结果。cache=true 时开启自动提示缓存（多轮对话用）
async function askJSON({ route, system, messages, schema, cache = false }) {
  const model = routeModel(route);
  const params = {
    model,
    max_tokens: 16000,
    output_config: { effort: ROUTES[route].effort, format: { type: 'json_schema', schema } },
    system,
    messages,
  };
  // 模型拒绝时由服务器自动换模型重试；Haiku 5.5 没有这个功能
  if (model !== HAIKU) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  // 自动缓存：每一轮都会重发整段对话，缓存后重复部分只按输入价格的 5% 计费
  if (cache) params.cache_control = { type: 'ephemeral' };
  let res;
  try {
    res = await getClient().beta.messages.create(params);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API Key 无效，请在「设置」里检查');
    if (e instanceof Anthropic.RateLimitError) throw new Error('请求太频繁或额度不足，请稍后再试');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('网络连接失败，请检查网络');
    if (e instanceof Anthropic.APIError) throw new Error(`API 错误（${e.status}）：${e.message}`);
    throw e;
  }
  recordUsage(route, res);
  if (res.stop_reason === 'refusal') throw new Error('模型拒绝了这次请求，请换个说法再试');
  if (res.stop_reason === 'max_tokens') throw new Error('回复过长被截断，请重试');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// 结构化输出要求每个对象都声明 required 与 additionalProperties:false
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });

export const levelGuide = (lv) => `学习者当前水平：${L().levels[lv].name}。${L().ai.levelGuide[lv]}`;

// 各个 JSON 字段沿用了最初只有日语时的命名（ja、reply_ja 等），学其他语言时要告诉模型这些字段装的是什么
function fieldNote() {
  const { id, name, ai } = L();
  const note = id === 'ja' ? '' : `注意：字段名里的 “ja”（如 ja、reply_ja、corrected_ja）只是历史命名，内容一律写${name}，不是日语。
`;
  return `${note}${ai.readingRule}
${ai.glossRule}`;
}

// ---------- 每日课程 ----------
const LESSON_SCHEMA = obj({
  goal_zh: str,
  phrases: arr(obj({ ja: str, reading: str, zh: str, note_zh: str })),
  grammar: arr(obj({ point: str, explanation_zh: str, examples: arr(obj({ ja: str, reading: str, zh: str })) })),
  dialogue: arr(obj({ speaker: str, ja: str, reading: str, zh: str })),
  roleplay: obj({ scenario_zh: str, ai_role_zh: str, user_role_zh: str, opening_ja: str, tasks_zh: arr(str) }),
});

export async function generateLesson(info, previousTitles = []) {
  const { unit, dow, level } = info;
  const { name, ai } = L();
  const system = `你是一位经验丰富的${name}口语教练，学生是${ai.learner}，目标是${ai.goal}。
你的教学原则：
- 只教在真实对话中高频使用的表达，优先教“整句”而不是孤立单词，方便学生直接开口。
- 内容略高于学生当前水平（i+1），新语法控制在 1–2 个。
- 所有说明用中文，简洁、具体，${ai.teachTips}
${fieldNote()}
${levelGuide(level)}`;
  const user = `请为第 ${dow} 天（每周 6 节课，这是本周第 ${dow} 节）编写一节 60 分钟口语课的材料。
本周单元：「${unit.title}」
本周语法重点：${unit.grammar.join('、')}
本周核心场景：${unit.scene}
${previousTitles.length ? `本周前几天已经练过的子场景（请换一个相关但不同的子场景，并自然复用前几天的表达）：${previousTitles.join('；')}` : '这是本周第一天，从最核心、最常用的表达开始。'}

要求：
- phrases：8 个今天的核心句子，note_zh 写用法要点或文化提示。
- grammar：1–2 个语法点，每个 2–3 个例句。
- dialogue：一段 6–10 句的自然对话（speaker 用 A / B），用来做听力跟读，要用到今天的句子。
- roleplay：给 AI 陪练的角色扮演设定。opening_ja 是 AI 的第一句话；tasks_zh 是学生在对话中要完成的 3 个任务（如“问价格”“表达偏好”）。
- goal_zh：一句话说明今天学完能做到什么。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: LESSON_SCHEMA, route: 'lesson' });
}

// ---------- 情景对话陪练 ----------
const TURN_SCHEMA = obj({
  reply_ja: str,
  reply_reading: str,
  reply_zh: str,
  correction: obj({ has_error: { type: 'boolean' }, corrected_ja: str, explanation_zh: str }),
  better_ja: str,
  hint_zh: str,
  finished: { type: 'boolean' },
});

export function chatSystem({ level, roleplay, exam }) {
  const { name, ai } = L();
  const base = `你是一位${ai.chatPersona}，学生是${ai.learner}。${levelGuide(level)}
${fieldNote()}
每一轮你要：
1. reply_ja：用${name}自然地回应学生并推进对话（1–3 句，结尾通常抛出一个问题让学生继续说）。严格控制难度在学生水平附近。
2. reply_reading：reply_ja 的读音（按上面 reading 的规则）；reply_zh：按上面 zh 的规则。
3. correction：检查学生上一句${name}。有${ai.correctionScope}错误时 has_error=true，给出改正后的整句 corrected_ja 和简短中文解释；没有错误时 has_error=false，其余字段留空字符串。学生用别的语言说，或说不会的时候，不算错误，而是在 explanation_zh 里教他这句该怎么用${name}说。
4. better_ja：如果学生的句子虽然没错但不够自然，给出更地道的说法；否则留空。
5. hint_zh：用中文提示学生下一句可以怎么回答（给出关键词，不要给完整答案）。
6. finished：对话目标全部完成且自然结束时为 true。
学生的输入可能来自语音识别，可能有同音字识别错误，请按最合理的意思理解，不要因识别错误扣分。`;
  if (exam) {
    return `${base}
这是每周的口语测评。你扮演考官，围绕本周主题「${exam.title}」（场景：${exam.scene}）进行约 10 轮对话，逐步提高难度，考察学生能否用上本周语法：${exam.grammar.join('、')}。第 10 轮左右自然结束并把 finished 设为 true。`;
  }
  if (roleplay) {
    return `${base}
角色扮演设定：${roleplay.scenario_zh}
你扮演：${roleplay.ai_role_zh}；学生扮演：${roleplay.user_role_zh}。
学生需要完成的任务：${roleplay.tasks_zh.join('；')}。
始终保持角色，在学生完成所有任务后自然结束对话。`;
  }
  return base;
}

// history: [{role:'user'|'assistant', content: string}]
export function chatTurn(system, history) {
  return askJSON({ system, messages: history, schema: TURN_SCHEMA, route: 'chat', cache: true });
}

// ---------- 纠错总结 ----------
const SUMMARY_SCHEMA = obj({
  score: { type: 'integer' },
  summary_zh: str,
  strengths_zh: arr(str),
  mistakes: arr(obj({ wrong: str, correct_ja: str, reading: str, explanation_zh: str })),
  new_cards: arr(obj({ ja: str, reading: str, zh: str })),
  next_focus_zh: str,
});

export function summarize({ level, transcript, weekly, unit }) {
  const { name, ai } = L();
  const system = `你是${name}口语教练，负责在对话练习后给学生做复盘，说明用中文。学生是${ai.learner}。${levelGuide(level)}
${fieldNote()}`;
  const user = `下面是学生刚才的${weekly ? '周口语测评' : '情景对话练习'}记录（单元：「${unit.title}」）。

${transcript}

请输出：
- score：1–5 分的口语表现（1=几乎无法交流，3=能完成任务但错误较多，5=该水平下自然流利）。${weekly ? '这是周测评，请严格打分，它会决定是否需要放慢进度。' : ''}
- summary_zh：两三句话的总体评价。
- strengths_zh：做得好的地方（1–3 条）。
- mistakes：最值得改正的错误（最多 6 条），correct_ja 写正确的整句。
- new_cards：从这次对话中挑 3–6 个学生应该记住、能直接用于对话的句子（包括改正后的句子和学生没能说出来的表达）。
- next_focus_zh：下次练习最该注意的一点。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: SUMMARY_SCHEMA, route: 'summary' });
}

// ---------- 跟读发音分析 ----------
const PRON_SCHEMA = obj({
  correct: { type: 'boolean' },
  problems: arr(obj({ part: str, issue_zh: str, how_zh: str })),
  tip_zh: str,
});

// 同一句、同样的识别结果，不重复请求 AI。结果存在手机上，关掉 App 也有效；最多保留最近 1000 条
const PRON_CACHE_MAX = 1000;
const pending = new Map(); // 正在请求中的，避免同时重复发送
function cachedPron(key) {
  return (S().pronCache || {})[key];
}
function storePron(key, value) {
  const cache = (S().pronCache ||= {});
  cache[key] = value;
  const keys = Object.keys(cache);
  for (let i = 0; i < keys.length - PRON_CACHE_MAX; i++) delete cache[keys[i]];
  save();
}

export function pronunciationFeedback({ ja, reading, heard }) {
  const { name, ai } = L();
  const system = `你是${name}发音教练，学生是${ai.learner}。你用中文说明，说话简短、具体、鼓励人。`;
  const user = `目标句：${ja}
读音：${reading || ja}
语音识别把学生的跟读识别成（按可信度排序）：
${heard.map((h, i) => `${i + 1}. ${h}`).join('\n')}

语音识别会把发音“纠正”成最接近的词，所以识别结果和目标句的差异，反映了学生读错、漏读或读得不清楚的地方。请分析：
- correct：任一识别结果在读音上和目标句完全一致时为 true。${ai.sameSound}，算一致；少读、多读或读错任何一个音（包括${ai.strictSounds}），都算不一致。
- problems：最多 3 条。part 写目标句里出问题的那几个字或词（照抄目标句里的写法）；issue_zh 说明听起来像读成了什么、最可能的原因（例如${ai.pronIssues}）；how_zh 给一个具体的练习方法。识别结果和目标句基本一致时返回空数组。
- tip_zh：一句话，下一次跟读最该注意什么。
${ai.pitchNote}不要编造识别结果里看不出来的问题。`;
  const key = `${L().id}|${ja}|${heard.join('|')}`;
  const hit = cachedPron(key);
  if (hit) return Promise.resolve(hit);
  if (pending.has(key)) return pending.get(key);
  const p = askJSON({ system, messages: [{ role: 'user', content: user }], schema: PRON_SCHEMA, route: 'pron' })
    .then((r) => { storePron(key, r); return r; })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

// ---------- 点词查询 ----------
const WORD_SCHEMA = obj({
  word: str,
  dictionary_form: str,
  reading: str,
  meaning_zh: str,
  pos_zh: str,
  usage_zh: str,
  kanji_zh: str,
});

export function lookupWord({ word, sentence }) {
  const { name, ai } = L();
  const system = `你是${name}词典，给${ai.learner}用，用中文解释，简洁准确。`;
  const user = `学生在这句${name}里点了一个词，请解释它在这句话里的意思。
句子：${sentence}
点的词：${word}

- word：学生点的这个词（照抄）。如果它只是一个词的一部分（如动词词尾、助动词被切开了），仍然只解释它，但在 usage_zh 里说明它和前后连起来的意思。
- dictionary_form：词典形（原形），没有变化时和 word 相同。
- reading：${ai.lookupReading}。
- meaning_zh：在这句话里的中文意思，简短。
- pos_zh：词性（如 名词、动词、助词、形容词，有变化时注明形式）。
- usage_zh：一两句话说明在这句里的用法或语法作用；${ai.lookupConfusion}。
- kanji_zh：${ai.lookupExtra}。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: WORD_SCHEMA, route: 'lookup' });
}

// ---------- 分级测试中的口语评估 ----------
const SPEAKING_SCHEMA = obj({ speaking_level: { type: 'integer' }, comment_zh: str });

export function evalSpeaking(qa) {
  const { name, ai, levels: lvList } = L();
  const levels = lvList.map((l) => `${l.id}=${l.name}（${l.desc}）`).join('；');
  const system = `你是${name}口语水平评估专家，学生是${ai.learner}。回答可能来自语音识别，忽略同音字识别错误。`;
  const user = `学生回答了 5 个难度递增的${name}问题（“（跳过）”表示没听懂或答不出）：
${qa.map((x, i) => `Q${i + 1}：${x.q}\nA${i + 1}：${x.a || '（跳过）'}`).join('\n')}

请判断他的口语水平等级 speaking_level（整数 0–5）：${levels}。
comment_zh：用两三句中文说明判断依据和最大的口语短板。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: SPEAKING_SCHEMA, route: 'speaking' });
}
