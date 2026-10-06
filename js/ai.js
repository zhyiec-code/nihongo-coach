// Claude API：生成课程、情景对话陪练、纠错总结、口语评估
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm';
import { S } from './store.js';
import { LEVELS } from './data.js';

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

// 发送一次请求并按 JSON Schema 返回结构化结果
async function askJSON({ system, messages, schema, effort = 'low' }) {
  let res;
  try {
    res = await getClient().beta.messages.create({
      model: S().settings.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      system,
      messages,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API Key 无效，请在「设置」里检查');
    if (e instanceof Anthropic.RateLimitError) throw new Error('请求太频繁或额度不足，请稍后再试');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('网络连接失败，请检查网络');
    if (e instanceof Anthropic.APIError) throw new Error(`API 错误（${e.status}）：${e.message}`);
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('模型拒绝了这次请求，请换个说法再试');
  if (res.stop_reason === 'max_tokens') throw new Error('回复过长被截断，请重试');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// 结构化输出要求每个对象都声明 required 与 additionalProperties:false
const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });

const LEVEL_GUIDE = [
  '零基础：只用最基础的问候语和「〜です」「〜は〜です」句型，每句不超过 12 个假名，全部配平假名读音。',
  '入门：只用 N5 词汇和 です／ます 体，短句，避免复杂汉字。',
  'N5：N5 词汇 + 少量 N4 语法，です／ます 体为主，句子简短清楚。',
  'N4：N4 词汇和语法，可以混用普通体，自然但不过快。',
  'N3：N3 水平，自然口语，可以用常见惯用说法和适量敬语。',
  'N2+：接近母语者的自然口语，包含敬语、惯用语和更抽象的话题。',
];
export const levelGuide = (lv) => `学习者当前水平：${LEVELS[lv].name}。${LEVEL_GUIDE[lv]}`;

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
  const system = `你是一位经验丰富的日语口语教练，学生是以中文为母语的成年人，目标是半年内能用日语基本流利地对话。
你的教学原则：
- 只教在真实对话中高频使用的表达，优先教“整句”而不是孤立单词，方便学生直接开口。
- 内容略高于学生当前水平（i+1），新语法控制在 1–2 个。
- 所有中文说明简洁、具体，指出中国人容易犯的错误（如汉字词的意思差异、助词误用）。
- reading 字段用平假名写出整句读音（不要罗马字）。
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
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: LESSON_SCHEMA, effort: 'medium' });
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
  const base = `你是一位耐心、友好的日语会话陪练，学生母语是中文。${levelGuide(level)}
每一轮你要：
1. reply_ja：用日语自然地回应学生并推进对话（1–3 句，结尾通常抛出一个问题让学生继续说）。严格控制难度在学生水平附近。
2. reply_reading：reply_ja 的平假名读音；reply_zh：中文翻译。
3. correction：检查学生上一句日语。有语法、助词、用词或礼貌程度错误时 has_error=true，给出改正后的整句 corrected_ja 和简短中文解释；没有错误时 has_error=false，其余字段留空字符串。学生用中文或说“わかりません”时，不算错误，而是在 explanation_zh 里教他这句该怎么用日语说。
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
  return askJSON({ system, messages: history, schema: TURN_SCHEMA, effort: 'low' });
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
  const system = `你是日语口语教练，负责在对话练习后给学生做复盘。学生母语为中文。${levelGuide(level)}`;
  const user = `下面是学生刚才的${weekly ? '周口语测评' : '情景对话练习'}记录（单元：「${unit.title}」）。

${transcript}

请输出：
- score：1–5 分的口语表现（1=几乎无法交流，3=能完成任务但错误较多，5=该水平下自然流利）。${weekly ? '这是周测评，请严格打分，它会决定是否需要放慢进度。' : ''}
- summary_zh：两三句话的总体评价。
- strengths_zh：做得好的地方（1–3 条）。
- mistakes：最值得改正的错误（最多 6 条），correct_ja 写正确的整句。
- new_cards：从这次对话中挑 3–6 个学生应该记住、能直接用于对话的句子（包括改正后的句子和学生没能说出来的表达）。
- next_focus_zh：下次练习最该注意的一点。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: SUMMARY_SCHEMA, effort: 'medium' });
}

// ---------- 分级测试中的口语评估 ----------
const SPEAKING_SCHEMA = obj({ speaking_level: { type: 'integer' }, comment_zh: str });

export function evalSpeaking(qa) {
  const levels = LEVELS.map((l) => `${l.id}=${l.name}（${l.desc}）`).join('；');
  const system = '你是日语口语水平评估专家，学生母语为中文。回答可能来自语音识别，忽略同音字识别错误。';
  const user = `学生回答了 5 个难度递增的日语问题（“（跳过）”表示没听懂或答不出）：
${qa.map((x, i) => `Q${i + 1}：${x.q}\nA${i + 1}：${x.a || '（跳过）'}`).join('\n')}

请判断他的口语水平等级 speaking_level（整数 0–5）：${levels}。
comment_zh：用两三句中文说明判断依据和最大的口语短板。`;
  return askJSON({ system, messages: [{ role: 'user', content: user }], schema: SPEAKING_SCHEMA, effort: 'medium' });
}
