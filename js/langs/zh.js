// 中文（普通话）课程：面向在海外长大的华裔孩子。会听一些、说得不流利，需要练标准普通话、拼音和声调
// 测试以听力为主，选项带 emoji，不太认字的孩子也能做

const LEVELS = [
  { id: 0, name: '只能听懂一点', desc: '能听懂几个词，几乎不会说', target: '能用简单完整的句子和家人日常交流（约 HSK2 口语）' },
  { id: 1, name: '入门', desc: '会说简单的词和短句', target: '能用完整的句子聊学校、爱好和家里的事（约 HSK3 口语）' },
  { id: 2, name: 'HSK2', desc: '能用简单句说日常的事', target: '能比较流利地聊日常话题、讲自己的经历（HSK3–4 口语）' },
  { id: 3, name: 'HSK3', desc: '能进行日常对话', target: '能流利聊大多数日常话题，声调基本准确（约 HSK4 口语）' },
  { id: 4, name: 'HSK4', desc: '能比较流利地聊熟悉话题', target: '能讲故事、表达观点，用上成语和地道说法（约 HSK5 口语）' },
  { id: 5, name: 'HSK5+', desc: '能流利表达', target: '说话自然地道，和国内同龄人交流没有障碍（HSK5–6 口语）' },
];

// 英文界面用的等级名称、说明和目标（与 LEVELS 一一对应）
const LEVELS_EN = [
  [
    "Listening only",
    "Understands a few words, can hardly speak",
    "Talk with family in simple, complete sentences (about HSK 2 speaking)"
  ],
  [
    "Starter",
    "Can say simple words and short phrases",
    "Talk about school, hobbies and home in full sentences (about HSK 3 speaking)"
  ],
  [
    "HSK 2",
    "Can describe everyday things in simple sentences",
    "Chat fairly fluently about daily topics and tell your own stories (HSK 3–4 speaking)"
  ],
  [
    "HSK 3",
    "Can hold everyday conversations",
    "Talk fluently about most daily topics with mostly correct tones (about HSK 4 speaking)"
  ],
  [
    "HSK 4",
    "Talks fairly fluently about familiar topics",
    "Tell stories and give opinions using idioms and natural expressions (about HSK 5 speaking)"
  ],
  [
    "HSK 5+",
    "Speaks fluently",
    "Speak naturally, just like kids of the same age in China (HSK 5–6 speaking)"
  ]
];
LEVELS.forEach((l, i) => Object.assign(l, { name_en: LEVELS_EN[i][0], desc_en: LEVELS_EN[i][1], target_en: LEVELS_EN[i][2] }));

// 分级测试题库：lv 1–5，每级随机抽 4 题，答对 3 题以上进入下一级
const PLACEMENT_ITEMS = [
  // lv1 只能听懂一点：全部是听力 + emoji 选项
  { lv: 1, type: 'listen', audio: '苹果', q: '听到的是哪个？', options: ['🍎', '🍌', '🍇', '🍊'], answer: 0 },
  { lv: 1, type: 'listen', audio: '我饿了。', q: '听到的是什么意思？', options: ['😴 想睡觉', '😋 想吃东西', '😢 很难过', '🥶 很冷'], answer: 1 },
  { lv: 1, type: 'listen', audio: '奶奶', q: '听到的是谁？', options: ['👩 妈妈', '👨 爸爸', '👵 奶奶', '👦 哥哥'], answer: 2 },
  { lv: 1, type: 'listen', audio: '三', q: '听到的是几？', options: ['1', '2', '3', '4'], answer: 2 },
  { lv: 1, type: 'listen', audio: '谢谢你！', q: '听到的是什么意思？', options: ['👋 打招呼', '🙏 谢谢', '😔 对不起', '🚪 再见'], answer: 1 },
  { lv: 1, type: 'listen', audio: '我们去游泳吧。', q: '要去做什么？', options: ['⚽ 踢足球', '🏊 游泳', '🚲 骑车', '📚 看书'], answer: 1 },

  // lv2 HSK2：能说简单句
  { lv: 2, type: 'listen', audio: '你今年几岁了？', q: '他在问什么？', options: ['问名字', '问年龄', '问时间', '问天气'], answer: 1 },
  { lv: 2, type: 'listen', audio: '明天我们一起去公园玩吧。', q: '听到的是什么意思？', options: ['昨天去公园了', '今天去学校', '明天一起去公园玩', '明天去奶奶家'], answer: 2 },
  { lv: 2, type: 'read', q: '我（　）学生。', options: ['是', '有', '在', '叫'], answer: 0 },
  { lv: 2, type: 'read', q: '我家有两（　）狗。', options: ['个', '只', '本', '张'], answer: 1 },
  { lv: 2, type: 'read', q: '拼音「mǎ」是哪个字？', options: ['妈', '麻', '马', '骂'], answer: 2 },
  { lv: 2, type: 'listen', audio: '你喜欢吃米饭还是面条？', q: '他在问什么？', options: ['喜欢吃哪一个', '饭做好了没有', '吃了多少', '在哪里吃饭'], answer: 0 },

  // lv3 HSK3：能进行日常对话
  { lv: 3, type: 'read', q: '我把作业写（　）了。', options: ['完', '见', '着', '过'], answer: 0 },
  { lv: 3, type: 'read', q: '哥哥比我（　）。', options: ['很高', '高', '非常高', '太高'], answer: 1 },
  { lv: 3, type: 'read', q: '你去（　）北京吗？', options: ['着', '的', '过', '在'], answer: 2 },
  { lv: 3, type: 'read', q: '门开（　）呢，快进来吧。', options: ['着', '了', '过', '完'], answer: 0 },
  { lv: 3, type: 'listen', audio: '因为下雨了，所以我们没去踢足球。', q: '听到的是什么意思？', options: ['下雨了，但还是去踢球了', '因为下雨，没去踢球', '踢完球就下雨了', '明天要下雨'], answer: 1 },
  { lv: 3, type: 'listen', audio: '你帮我把门关上，好吗？', q: '他想让你做什么？', options: ['开门', '关门', '敲门', '锁窗户'], answer: 1 },

  // lv4 HSK4：能比较流利地聊熟悉话题
  { lv: 4, type: 'read', q: '（　）他很忙，（　）每天都给妈妈打电话。', options: ['因为…所以', '如果…就', '虽然…但是', '不但…而且'], answer: 2 },
  { lv: 4, type: 'read', q: '这个问题连老师（　）不知道。', options: ['都', '还', '就', '才'], answer: 0 },
  { lv: 4, type: 'read', q: '我（　）吃了一个包子，现在还饿。', options: ['都', '只', '又', '再'], answer: 1 },
  { lv: 4, type: 'read', q: '「马马虎虎」是什么意思？', options: ['跑得很快', '很认真', '不太认真，一般般', '很生气'], answer: 2 },
  { lv: 4, type: 'listen', audio: '你别着急，慢慢说，到底发生什么事了？', q: '听到的是什么意思？', options: ['快点说吧', '别急，慢慢说发生了什么', '什么事都没发生', '我很着急'], answer: 1 },
  { lv: 4, type: 'listen', audio: '我差点儿迟到了，幸亏赶上了最后一班车。', q: '结果怎么样？', options: ['迟到了', '没赶上车', '差点迟到，但赶上了车', '车晚点了'], answer: 2 },

  // lv5 HSK5+
  { lv: 5, type: 'read', q: '「画蛇添足」是什么意思？', options: ['画画很好', '做多余的事反而坏事', '动作很快', '想得很周到'], answer: 1 },
  { lv: 5, type: 'read', q: '与其在家玩手机，（　）出去走走。', options: ['不如', '还是', '宁可', '何况'], answer: 0 },
  { lv: 5, type: 'read', q: '（　）你同意不同意，我都要去。', options: ['尽管', '虽然', '不管', '即使'], answer: 2 },
  { lv: 5, type: 'read', q: '「他说话总是拐弯抹角的」是什么意思？', options: ['说话很快', '说话不直接', '说话很大声', '说话很有意思'], answer: 1 },
  { lv: 5, type: 'listen', audio: '这次比赛虽然输了，但我们从中学到了很多宝贵的经验。', q: '听到的是什么意思？', options: ['比赛赢了，很开心', '输了，什么也没学到', '虽然输了，但学到了很多', '比赛取消了'], answer: 2 },
  { lv: 5, type: 'listen', audio: '既然你已经决定了，那就坚持下去吧。', q: '听到的是什么意思？', options: ['你再考虑一下吧', '已经决定了就坚持下去', '你决定得太快了', '我不同意你的决定'], answer: 1 },
];

// 英文界面用的题目和选项（与 PLACEMENT_ITEMS 一一对应）。听力题给出英文选项（测的是听懂没有）；
// 填空题的选项本身就是要考的中文，不翻译
const ITEMS_EN = [
  [
    "Which one did you hear?",
    null
  ],
  [
    "What does it mean?",
    [
      "😴 Sleepy",
      "😋 Hungry",
      "😢 Sad",
      "🥶 Cold"
    ]
  ],
  [
    "Who is it?",
    [
      "👩 Mom",
      "👨 Dad",
      "👵 Grandma",
      "👦 Big brother"
    ]
  ],
  [
    "Which number did you hear?",
    null
  ],
  [
    "What does it mean?",
    [
      "👋 Hello",
      "🙏 Thank you",
      "😔 Sorry",
      "🚪 Goodbye"
    ]
  ],
  [
    "What are they going to do?",
    [
      "⚽ Play soccer",
      "🏊 Go swimming",
      "🚲 Ride a bike",
      "📚 Read a book"
    ]
  ],
  [
    "What is being asked?",
    [
      "Your name",
      "Your age",
      "The time",
      "The weather"
    ]
  ],
  [
    "What does it mean?",
    [
      "We went to the park yesterday",
      "Going to school today",
      "Let's go play in the park tomorrow",
      "Going to grandma's tomorrow"
    ]
  ],
  [
    "Fill in the blank: 我（　）学生。 (I am a student.)",
    null
  ],
  [
    "Fill in the blank: 我家有两（　）狗。 (We have two dogs.)",
    null
  ],
  [
    "Which character is pinyin “mǎ” (horse)?",
    null
  ],
  [
    "What is being asked?",
    [
      "Which one you like more",
      "Whether the food is ready",
      "How much you ate",
      "Where to eat"
    ]
  ],
  [
    "Fill in the blank: 我把作业写（　）了。 (I finished my homework.)",
    null
  ],
  [
    "Fill in the blank: 哥哥比我（　）。 (My big brother is taller than me.)",
    null
  ],
  [
    "Fill in the blank: 你去（　）北京吗？ (Have you ever been to Beijing?)",
    null
  ],
  [
    "Fill in the blank: 门开（　）呢，快进来吧。 (The door is open, come in.)",
    null
  ],
  [
    "What does it mean?",
    [
      "It rained, but we still played soccer",
      "Because it rained, we didn't play soccer",
      "It rained after we played soccer",
      "It will rain tomorrow"
    ]
  ],
  [
    "What do they want you to do?",
    [
      "Open the door",
      "Close the door",
      "Knock on the door",
      "Lock the window"
    ]
  ],
  [
    "Fill in the blanks: （　）他很忙，（　）每天都给妈妈打电话。 (Although he is busy, he still calls mom every day.)",
    null
  ],
  [
    "Fill in the blank: 这个问题连老师（　）不知道。 (Even the teacher doesn't know this.)",
    null
  ],
  [
    "Fill in the blank: 我（　）吃了一个包子，现在还饿。 (I only ate one bun, I'm still hungry.)",
    null
  ],
  [
    "What does 「马马虎虎」 mean?",
    [
      "Running fast",
      "Very careful",
      "Careless / so-so",
      "Very angry"
    ]
  ],
  [
    "What does it mean?",
    [
      "Hurry up and talk",
      "Don't worry, tell me slowly what happened",
      "Nothing happened",
      "I'm very worried"
    ]
  ],
  [
    "What happened in the end?",
    [
      "They were late",
      "They missed the bus",
      "Almost late, but caught the last bus",
      "The bus was late"
    ]
  ],
  [
    "What does 「画蛇添足」 mean?",
    [
      "Being good at drawing",
      "Doing something unnecessary that spoils it",
      "Moving very fast",
      "Thinking very carefully"
    ]
  ],
  [
    "Fill in the blank: 与其在家玩手机，（　）出去走走。 (Rather than playing on your phone, you'd better go out.)",
    null
  ],
  [
    "Fill in the blank: （　）你同意不同意，我都要去。 (Whether you agree or not, I'm going.)",
    null
  ],
  [
    "What does 「他说话总是拐弯抹角的」 mean?",
    [
      "He talks fast",
      "He never says things directly",
      "He talks loudly",
      "He is funny"
    ]
  ],
  [
    "What does it mean?",
    [
      "They won and are happy",
      "They lost and learned nothing",
      "They lost, but learned a lot",
      "The game was cancelled"
    ]
  ],
  [
    "What does it mean?",
    [
      "Think about it again",
      "You've decided, so stick with it",
      "You decided too quickly",
      "I don't agree with your decision"
    ]
  ]
];
PLACEMENT_ITEMS.forEach((it, i) => {
  it.q_en = ITEMS_EN[i][0];
  if (ITEMS_EN[i][1]) it.options_en = ITEMS_EN[i][1];
});

// 口语测试：难度递增的 5 个问题
const SPEAKING_QUESTIONS = [
  '你叫什么名字？今年几岁了？',
  '你最喜欢吃什么？为什么？',
  '上个周末你做了什么？',
  '说说你最好的朋友吧，他是什么样的人？',
  '你觉得在国外上学和在中国上学有什么不一样？',
];

// 课程大纲：每个单元 = 一周。话题贴近孩子的生活
const UNITS = [
  { title: '拼音与声调', grammar: ['四个声调', '声母和韵母', '轻声'], scene: '和爷爷奶奶视频打招呼' },
  { title: '自我介绍', grammar: ['我叫…', '我今年…岁', '我是…人'], scene: '第一次见到国内的亲戚' },
  { title: '我的家人', grammar: ['量词 个／只／口', '有／没有', '的'], scene: '介绍家里的人和宠物' },
  { title: '数字、时间与日期', grammar: ['几点了', '星期几', '几月几号'], scene: '和奶奶约好视频的时间' },
  { title: '我的一天', grammar: ['常用动作动词', '先…再…', '时间词的位置'], scene: '告诉妈妈今天在学校做了什么' },
  { title: '吃东西', grammar: ['想／要', '好吃／不好吃', '量词 碗／杯／块'], scene: '在中餐馆点菜' },
  { title: '买东西', grammar: ['多少钱', '太…了', '能不能便宜一点'], scene: '在超市买零食和文具' },
  { title: '学校生活', grammar: ['在…上课', '喜欢／不喜欢', '最'], scene: '和国内的小朋友聊学校' },
  { title: '爱好与运动', grammar: ['会／能', '…得很好', '一起…吧'], scene: '聊喜欢的运动和游戏' },
  { title: '周末做了什么', grammar: ['了', '过', '…的时候'], scene: '周末去公园玩了什么' },
  { title: '邀请和约定', grammar: ['…吗？／…吧', '要不要', '有空吗'], scene: '约小伙伴一起玩' },
  { title: '描述人和东西', grammar: ['形容词', '有点儿／非常', '长得…'], scene: '描述好朋友的样子' },
  { title: '请求与礼貌', grammar: ['请／可以…吗', '谢谢／不客气', '别…'], scene: '去别人家做客' },
  { title: '比较', grammar: ['比', '跟…一样', '没有…那么'], scene: '比较中国和意大利的东西' },
  { title: '身体与生病', grammar: ['…疼', '感冒／发烧', '应该'], scene: '不舒服的时候告诉家长' },
  { title: '天气与季节', grammar: ['了（表示变化）', '越来越', '要…了'], scene: '和奶奶聊两地的天气' },
  { title: '理由与解释', grammar: ['因为…所以', '为什么', '怎么'], scene: '迟到了向老师解释' },
  { title: '方向与位置', grammar: ['在…旁边／前面', '往…走', '离…远'], scene: '回国时在街上问路' },
  { title: '把字句', grammar: ['把…放在', '把…吃完', '把…关上'], scene: '帮妈妈收拾房间' },
  { title: '结果补语', grammar: ['完／好／到／懂', '听懂了吗', '找到了'], scene: '和朋友一起做手工' },
  { title: '正在做什么', grammar: ['正在', '着', '呢'], scene: '打电话告诉家人正在做什么' },
  { title: '节日与传统', grammar: ['春节／中秋节', '节日习俗词汇', '…的时候…'], scene: '和家人一起过春节' },
  { title: '讲故事', grammar: ['先…然后…最后', '突然', '后来'], scene: '讲一个有趣的小故事' },
  { title: '表达感受', grammar: ['觉得', '又…又…', '让我很…'], scene: '说说开心和难过的事' },
  { title: '条件与假设', grammar: ['如果…就', '只要…就', '要是'], scene: '计划暑假回中国' },
  { title: '被字句', grammar: ['被', '叫／让', '给'], scene: '讲讲一件倒霉的事' },
  { title: '成语与俗语', grammar: ['常用成语', '成语故事', '俗语'], scene: '用成语讲故事' },
  { title: '新闻与社会', grammar: ['据说', '对…来说', '一方面…另一方面'], scene: '聊最近的新闻' },
  { title: '表达观点', grammar: ['我认为', '虽然…但是', '不但…而且'], scene: '讨论小学生该不该用手机' },
  { title: '辩论与说服', grammar: ['既然…就', '与其…不如', '何况'], scene: '说服家人同意养宠物' },
  { title: '文化与身份', grammar: ['中外文化对比', '我既是…也是…', '习惯不同'], scene: '聊在两种文化里长大' },
  { title: '自然流利：口语与语气', grammar: ['嗯／那个／就是', '语气词 啊／呀／嘛／呗', '儿化'], scene: '像在国内一样自然地聊天' },
];

// 英文界面用的单元标题和场景（与 UNITS 一一对应）
const UNITS_EN = [
  [
    "Pinyin and tones",
    "Say hi to grandma and grandpa on a video call"
  ],
  [
    "Introducing yourself",
    "Meeting relatives from China for the first time"
  ],
  [
    "My family",
    "Introducing your family and pets"
  ],
  [
    "Numbers, time and dates",
    "Setting a time for a video call with grandma"
  ],
  [
    "My day",
    "Telling mom what you did at school today"
  ],
  [
    "Food",
    "Ordering at a Chinese restaurant"
  ],
  [
    "Shopping",
    "Buying snacks and stationery at the supermarket"
  ],
  [
    "School life",
    "Chatting about school with kids in China"
  ],
  [
    "Hobbies and sports",
    "Talking about your favorite sports and games"
  ],
  [
    "My weekend",
    "What you did at the park last weekend"
  ],
  [
    "Invitations and plans",
    "Inviting friends to play"
  ],
  [
    "Describing people and things",
    "Describing what your best friend looks like"
  ],
  [
    "Being polite",
    "Visiting someone's home"
  ],
  [
    "Comparing things",
    "Comparing things in China and Italy"
  ],
  [
    "Feeling sick",
    "Telling your parents you don't feel well"
  ],
  [
    "Weather and seasons",
    "Chatting with grandma about the weather"
  ],
  [
    "Giving reasons",
    "Explaining to the teacher why you were late"
  ],
  [
    "Directions",
    "Asking for directions in China"
  ],
  [
    "The 把 sentence",
    "Helping mom tidy your room"
  ],
  [
    "Result complements",
    "Doing a craft with friends"
  ],
  [
    "What are you doing now?",
    "Telling family on the phone what you're doing"
  ],
  [
    "Festivals and traditions",
    "Celebrating Chinese New Year with family"
  ],
  [
    "Telling stories",
    "Telling a fun little story"
  ],
  [
    "Feelings",
    "Talking about happy and sad things"
  ],
  [
    "If…",
    "Planning a summer trip to China"
  ],
  [
    "The 被 sentence",
    "Telling about an unlucky day"
  ],
  [
    "Idioms and sayings",
    "Telling a story with idioms"
  ],
  [
    "News and society",
    "Talking about recent news"
  ],
  [
    "Giving opinions",
    "Should kids have phones?"
  ],
  [
    "Debating and persuading",
    "Persuading your family to get a pet"
  ],
  [
    "Culture and identity",
    "Growing up between two cultures"
  ],
  [
    "Sounding natural",
    "Chatting naturally like kids in China"
  ]
];
UNITS.forEach((u, i) => Object.assign(u, { title_en: UNITS_EN[i][0], scene_en: UNITS_EN[i][1] }));

const START_UNIT = [0, 2, 6, 12, 18, 24];

// 英文界面用的实战主题（与下面的列表一一对应）
const PRACTICE_EN = [
  "Visiting family in China",
  "New Year's Eve dinner with relatives",
  "A day at a school in China",
  "Watching Chinese cartoons",
  "Idiom story time",
  "Making mooncakes for Mid-Autumn",
  "Playing games with kids in China",
  "A trip to the zoo",
  "Traveling by high-speed train",
  "Night market",
  "Chinese calligraphy",
  "My city",
  "Birthday party",
  "Being a little tour guide",
  "My dream",
  "Talking about favorite books",
  "Protecting the environment",
  "Looking back and ahead"
];
const PRACTICE_UNITS = [
  '回国探亲', '和亲戚吃年夜饭', '在国内学校插班一天', '看中文动画片', '成语故事会', '中秋节做月饼',
  '和国内小朋友打游戏', '去动物园', '坐高铁旅行', '逛夜市', '学写毛笔字', '介绍我住的城市',
  '过生日', '当小导游', '我的梦想', '讨论喜欢的书', '保护环境', '回顾与展望',
].map((t, i) => ({
  title: `实战：${t}`, grammar: ['综合运用'], scene: t, practice: true,
  title_en: `Practice: ${PRACTICE_EN[i]}`, scene_en: PRACTICE_EN[i],
}));

export default {
  id: 'zh',
  name: '中文',
  name_en: 'Chinese',
  // 学中文的是海外长大的孩子，默认用英文界面（设置里可以改）
  defaultUi: 'en',
  flag: '🇨🇳',
  bcp47: 'zh-CN',
  htmlLang: 'zh-CN',
  appTitle: '中文口语教练',
  appTitle_en: 'Chinese Speaking Coach',
  readingLabel: '拼音',
  readingLabel_en: 'pinyin',
  sample: '你好！我们一起来练习说中文吧。',
  // 周测评和自由对话里学生说的第一句（API 要求对话由学生先开口）
  greeting: '你好！',
  voiceRe: /natural|google|tingting|xiaoxiao|yaoyao|huihui|yunxi/i,
  voicePrefer: /zh[-_]cn|cmn/i,
  voiceInstall: { android: '中文（中国）/ 普通话', ios: '中文（普通话 - 中国大陆）' },
  voiceInstall_en: { android: 'Chinese (China) / Mandarin', ios: 'Chinese (Mandarin - China mainland)' },
  levels: LEVELS,
  selfCheck: {
    q: '孩子现在的中文怎么样？',
    q_en: 'How is your Chinese right now?',
    options: [
      { label: '只能听懂一点，几乎不会说', label_en: 'I understand a little, but can hardly speak' },
      { label: '能听懂日常的话，会说简单的句子', label_en: 'I understand everyday talk and can say simple sentences' },
      { label: '日常交流基本没问题', label_en: 'I can handle everyday conversations' },
    ],
  },
  placement: PLACEMENT_ITEMS,
  speaking: SPEAKING_QUESTIONS,
  kana: null,
  units: UNITS,
  startUnit: START_UNIT,
  practiceUnits: PRACTICE_UNITS,
  ai: {
    levelGuide: [
      '只能听懂一点：只用最常用的口语词，每句不超过 8 个字，说话慢，全部配拼音。',
      '入门：HSK1 词汇，短句，配拼音。',
      'HSK2：HSK2 词汇，简单完整的句子。',
      'HSK3：HSK3 词汇和语法，自然但不太快。',
      'HSK4：HSK4 水平，自然口语，可以用常见的成语和俗语。',
      'HSK5+：和国内同龄人一样自然的口语，包括成语、俗语和较抽象的话题。',
    ],
    learner: '在海外长大的华裔孩子，能听懂一些中文，但说得不流利、拼音和声调不熟，平时主要说当地语言',
    goal: '半年内能用中文和家人、朋友自然流利地交流',
    teachTips: '说明要简单、亲切，孩子能看懂；指出受外语影响容易犯的错误（如语序、量词、“了”的用法、声调）。',
    readingRule: 'reading 字段写整句带声调符号的拼音，按词分开，例如 "nǐ hǎo, wǒ jiào xiǎomíng"。',
    glossRule: 'zh 字段不要原样重复中文，而是用更简单的话解释这句话的意思，帮孩子理解。',
    chatPersona: '像亲切的大哥哥、大姐姐一样的中文陪练，话题贴近孩子的生活，多鼓励',
    correctionScope: '语序、量词、虚词（了／过／着／的）、用词或声调',
    pronIssues: '声调错误（读错声调时，语音识别常会识别成另一个字）、前后鼻音 an／ang、en／eng、in／ing、平翘舌 z／zh、c／ch、s／sh、n／l、轻声等受外语影响的常见问题',
    sameSound: '只是同音同调的字写法不同或标点不同',
    strictSounds: '每个字的声调、声母和韵母',
    pitchNote: '识别成了声调不同的字，说明声调读错了，要明确指出应该是第几声。',
    lookupReading: '带声调符号的拼音',
    lookupConfusion: '用孩子能看懂的简单的话说明',
    lookupExtra: '逐个汉字写“字（拼音）：意思，再组一个常用词”，用顿号分隔',
  },
};
