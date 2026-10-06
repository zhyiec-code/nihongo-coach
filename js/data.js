// 静态数据：水平等级、分级测试题库、假名表、26 周课程大纲

export const LEVELS = [
  { id: 0, name: '零基础', desc: '还不会假名', target: '能用简单句完成自我介绍、点餐、购物、问路等生存级对话（约 N4 口语）' },
  { id: 1, name: '入门', desc: '会假名，认识少量单词', target: '能就日常话题进行简单但连贯的对话（约 N4–N3 口语）' },
  { id: 2, name: 'N5', desc: '掌握基础句型', target: '能用普通体和敬体自然聊日常生活、表达理由与计划（约 N3 口语）' },
  { id: 3, name: 'N4', desc: '能读懂基础会话', target: '能流畅聊大多数日常话题，开始使用敬语（N3+ 口语）' },
  { id: 4, name: 'N3', desc: '能理解日常对话', target: '能表达观点、讲述经历、应对工作场景（约 N2 口语）' },
  { id: 5, name: 'N2+', desc: '能理解大部分内容', target: '在商务和抽象话题上自然流利地表达（N2–N1 口语）' },
];

// 分级测试题库：lv 1–5，每级随机抽 4 题，答对 3 题以上进入下一级
// type: read=看题选答案，listen=听语音选意思（audio 为朗读内容）
export const PLACEMENT_ITEMS = [
  // lv1 假名与入门词汇
  { lv: 1, type: 'read', q: '「あ」怎么读？', options: ['a', 'o', 'i', 'u'], answer: 0 },
  { lv: 1, type: 'read', q: '「ね」怎么读？', options: ['re', 'ne', 'wa', 'nu'], answer: 1 },
  { lv: 1, type: 'read', q: '片假名「カ」怎么读？', options: ['ga', 'chi', 'ka', 'ri'], answer: 2 },
  { lv: 1, type: 'read', q: '「ありがとう」是什么意思？', options: ['对不起', '谢谢', '你好', '再见'], answer: 1 },
  { lv: 1, type: 'read', q: '「みず」是什么意思？', options: ['水', '米饭', '书', '猫'], answer: 0 },
  { lv: 1, type: 'listen', audio: 'コーヒー', q: '听到的是哪个词？', options: ['蛋糕', '可乐', '咖啡', '复印'], answer: 2 },
  { lv: 1, type: 'listen', audio: 'おはようございます', q: '听到的是什么意思？', options: ['晚上好', '早上好', '谢谢', '晚安'], answer: 1 },

  // lv2 N5
  { lv: 2, type: 'read', q: 'わたし（　）がくせいです。', options: ['を', 'に', 'は', 'で'], answer: 2 },
  { lv: 2, type: 'read', q: 'きのう、なにを（　）か。', options: ['たべます', 'たべました', 'たべる', 'たべて'], answer: 1 },
  { lv: 2, type: 'read', q: 'あした ともだち（　）えいがを みます。', options: ['と', 'を', 'が', 'へ'], answer: 0 },
  { lv: 2, type: 'read', q: '「まいあさ 7時に おきます」的意思是？', options: ['每天晚上7点睡觉', '明天早上7点出门', '每天早上7点起床', '早上7点吃饭'], answer: 2 },
  { lv: 2, type: 'listen', audio: 'トイレはどこですか。', q: '听到的是什么意思？', options: ['厕所在哪里？', '车站在哪里？', '这是什么？', '多少钱？'], answer: 0 },
  { lv: 2, type: 'listen', audio: 'すみません、もう一度お願いします。', q: '听到的是什么意思？', options: ['不好意思，我先走了', '不好意思，请再说一遍', '请给我一个', '谢谢您的照顾'], answer: 1 },
  { lv: 2, type: 'listen', audio: 'これはいくらですか。', q: '听到的是什么意思？', options: ['这是谁的？', '这个好吃吗？', '这个多少钱？', '这是什么时候？'], answer: 2 },

  // lv3 N4
  { lv: 3, type: 'read', q: '日本へ行った（　）があります。', options: ['もの', 'こと', 'ところ', 'の'], answer: 1 },
  { lv: 3, type: 'read', q: '空が暗いですね。雨が降り（　）です。', options: ['そう', 'よう', 'らしい', 'みたい'], answer: 0 },
  { lv: 3, type: 'read', q: 'この本を読ん（　）もいいですか。', options: ['て', 'に', 'だ', 'で'], answer: 3 },
  { lv: 3, type: 'read', q: '先生に褒め（　）。', options: ['させました', 'られました', 'ました', 'せられた'], answer: 1 },
  { lv: 3, type: 'read', q: '窓が開け（　）あります。', options: ['て', 'で', 'た', 'に'], answer: 0 },
  { lv: 3, type: 'listen', audio: '駅に着いたら、電話してください。', q: '听到的是什么意思？', options: ['到车站前请发短信', '在车站等我电话', '到车站后请打电话', '请打电话问车站'], answer: 2 },
  { lv: 3, type: 'listen', audio: '明日は忙しいので、行けないかもしれません。', q: '听到的是什么意思？', options: ['明天不忙，一定去', '明天忙，可能去不了', '明天很忙，所以早点去', '明天有空的话就去'], answer: 1 },

  // lv4 N3
  { lv: 4, type: 'read', q: '彼は医者の（　）、病気のことはよく知っている。', options: ['くせに', 'わりに', 'だけあって', 'ばかりに'], answer: 2 },
  { lv: 4, type: 'read', q: '忙しい（　）、毎日運動しています。', options: ['にもかかわらず', 'おかげで', 'せいで', 'ために'], answer: 0 },
  { lv: 4, type: 'read', q: '宿題を（　）うちに、寝てしまった。', options: ['した', 'しない', 'している', 'する'], answer: 2 },
  { lv: 4, type: 'read', q: '部長に資料を見て（　）。', options: ['さしあげました', 'いただきました', 'くださいました', 'あげました'], answer: 1 },
  { lv: 4, type: 'read', q: '「電気をつけっぱなしにする」的意思是？', options: ['把灯打开', '开着灯不关', '马上关灯', '灯坏了'], answer: 1 },
  { lv: 4, type: 'listen', audio: 'せっかく来たんだから、もう少しゆっくりしていけば？', q: '听到的是什么意思？', options: ['难得来一趟，再多待一会儿吧', '你来得太晚了，下次早点', '来了就快点走吧', '好不容易才到，累坏了吧'], answer: 0 },

  // lv5 N2+
  { lv: 5, type: 'read', q: '彼の発言は誤解を招き（　）。', options: ['かねる', 'がたい', 'かねない', 'っこない'], answer: 2 },
  { lv: 5, type: 'read', q: '努力した（　）、合格できなかった。', options: ['ものの', 'ものだから', 'ものなら', 'もので'], answer: 0 },
  { lv: 5, type: 'read', q: '子供（　）、こんな問題も解けないの？', options: ['ならでは', 'ともなると', 'にしては', 'じゃあるまいし'], answer: 3 },
  { lv: 5, type: 'read', q: '散歩（　）、パンを買いに行った。', options: ['がてら', 'あげく', 'ながらも', 'たびに'], answer: 0 },
  { lv: 5, type: 'listen', audio: 'その件につきましては、改めてご連絡させていただきます。', q: '听到的是什么意思？', options: ['那件事请您再联系我们', '关于那件事，我们会另行联系您', '那件事已经联系过了', '请您重新确认那件事'], answer: 1 },
  { lv: 5, type: 'listen', audio: 'こちらの不手際でご迷惑をおかけし、誠に申し訳ございません。', q: '听到的是什么意思？', options: ['感谢您一直以来的关照', '这不是我们的责任，请谅解', '由于我方失误给您添麻烦，深表歉意', '我们会尽快处理您的投诉'], answer: 2 },
];

// 口语测试：难度递增的 5 个问题
export const SPEAKING_QUESTIONS = [
  'お名前は何ですか。',
  '趣味は何ですか。',
  '先週の週末は何をしましたか。',
  'どうして日本語を勉強していますか。',
  'あなたの国と日本の違いについて、どう思いますか。',
];

// 假名表：每组一天
const HIRA = [
  'あa いi うu えe おo かka きki くku けke こko',
  'さsa しshi すsu せse そso たta ちchi つtsu てte とto',
  'なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho',
  'まma みmi むmu めme もmo やya ゆyu よyo',
  'らra りri るru れre ろro わwa をwo んn',
  'がga ぎgi ぐgu げge ごgo ざza じji ずzu ぜze ぞzo だda でde どdo ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo',
];
const KATA = [
  'アa イi ウu エe オo カka キki クku ケke コko',
  'サsa シshi スsu セse ソso タta チchi ツtsu テte トto',
  'ナna ニni ヌnu ネne ノno ハha ヒhi フfu ヘhe ホho',
  'マma ミmi ムmu メme モmo ヤya ユyu ヨyo',
  'ラra リri ルru レre ロro ワwa ヲwo ンn',
  'ガga ギgi グgu ゲge ゴgo ザza ジji ズzu ゼze ゾzo ダda デde ドdo バba ビbi ブbu ベbe ボbo パpa ピpi プpu ペpe ポpo',
];
const parseKana = (s) => s.split(' ').map((t) => ({ k: t[0], r: t.slice(1) }));
export const KANA_GROUPS = {
  hiragana: HIRA.map(parseKana),
  katakana: KATA.map(parseKana),
};

// 课程大纲：每个单元 = 一周。kana 字段表示该周的假名专项
export const UNITS = [
  { title: '平假名 + 打招呼', kana: 'hiragana', grammar: ['问候语', 'はい／いいえ'], scene: '和日本邻居第一次见面打招呼' },
  { title: '片假名 + 自我介绍', kana: 'katakana', grammar: ['〜です', '〜は〜です', '外来语'], scene: '在语言交换活动上做自我介绍' },
  { title: '自我介绍与寒暄', grammar: ['〜は〜です／じゃないです', '〜の〜', '〜も'], scene: '在聚会上认识新朋友' },
  { title: '数字、时间与价格', grammar: ['数字', '〜時〜分', 'いくらですか'], scene: '在便利店买东西并询问营业时间' },
  { title: '日常作息', grammar: ['ます形', '〜ました', '助词 に／で／を'], scene: '和朋友聊彼此的一天' },
  { title: '购物', grammar: ['これ／それ／あれ', '〜をください', '〜はありますか'], scene: '在服装店挑选衣服、问尺码' },
  { title: '餐厅点餐', grammar: ['〜にします', '〜をお願いします', '〜はいかがですか'], scene: '在居酒屋点餐、结账' },
  { title: '问路与交通', grammar: ['〜はどこですか', 'て形 指路', '〜まで どのくらい'], scene: '在车站问路、买车票' },
  { title: '喜好与爱好', grammar: ['好き／嫌い', '〜のが好き', 'い／な形容词'], scene: '和新朋友聊兴趣爱好' },
  { title: '周末与经历', grammar: ['た形', '〜たり〜たりする', '〜てから'], scene: '周一和同事聊周末做了什么' },
  { title: '邀约与计划', grammar: ['〜ませんか', '〜ましょう', '〜つもりです'], scene: '约朋友周末一起出去玩' },
  { title: '描述人和事物', grammar: ['〜ている（状态）', '形容词て形', '〜という'], scene: '向朋友介绍你的家人和家乡' },
  { title: '请求与许可', grammar: ['〜てください', '〜てもいいですか', '〜てはいけません'], scene: '在房东家询问规则、提出请求' },
  { title: '经验与比较', grammar: ['〜たことがある', '〜より〜', '〜の中で一番'], scene: '和朋友比较各地旅行经历' },
  { title: '能力与愿望', grammar: ['可能形', '〜たい', '〜ほしい'], scene: '面试兼职时介绍自己会做什么' },
  { title: '普通体（朋友间说话）', grammar: ['普通体', '〜んだ／〜の？', '〜じゃん'], scene: '和日本朋友用随意的语气闲聊' },
  { title: '理由与解释', grammar: ['〜から／〜ので', '〜んです', '〜し、〜し'], scene: '迟到了向朋友解释原因' },
  { title: '健康与看病', grammar: ['〜たほうがいい', '〜ないでください', '身体部位'], scene: '在诊所向医生描述症状' },
  { title: '打电话与预约', grammar: ['〜たいんですが', '〜でしょうか', '谦让语入门'], scene: '打电话预约餐厅和美容院' },
  { title: '授受关系', grammar: ['あげる／もらう／くれる', '〜てもらう', '〜てくれる'], scene: '和朋友聊收到的礼物和帮助' },
  { title: '条件与建议', grammar: ['〜たら', '〜ば', '〜と'], scene: '给来日本旅游的朋友提建议' },
  { title: '推测与传闻', grammar: ['〜そうだ', '〜らしい', '〜かもしれない'], scene: '和同事聊听说的消息和天气' },
  { title: '职场敬语', grammar: ['尊敬语', '谦让语', 'お〜になる／お〜する'], scene: '第一天上班向上司和同事问好' },
  { title: '被动与使役', grammar: ['受身形', '使役形', '使役受身'], scene: '和朋友吐槽工作和生活中的烦心事' },
  { title: '表达意见', grammar: ['〜と思う', '〜について', '〜べきだ'], scene: '讨论远程办公的利与弊' },
  { title: '讲述故事', grammar: ['〜てしまう', '〜うちに', '接续词（それで、ところが）'], scene: '讲一次难忘的旅行经历' },
  { title: '应对麻烦', grammar: ['〜てしまった', '〜ていただけませんか', '委婉抱怨'], scene: '酒店房间出问题，和前台交涉' },
  { title: '社会话题', grammar: ['〜によると', '〜に対して', '〜一方で'], scene: '聊最近的新闻和社会现象' },
  { title: '辩论与说服', grammar: ['〜わけではない', '〜にもかかわらず', '〜からこそ'], scene: '说服朋友一起参加一个计划' },
  { title: '商务会议', grammar: ['商务敬语', '〜させていただく', '会议用语'], scene: '在会议上汇报项目进展' },
  { title: '文化与价值观', grammar: ['〜ものだ', '〜ことになっている', '〜とされる'], scene: '和日本人聊两国文化差异' },
  { title: '自然流利：附和与语气', grammar: ['相槌（そうなんだ、なるほど）', '填充词（えーと、なんか）', '句末语气'], scene: '像日本人一样自然地闲聊一小时' },
];

// 等级对应的起始单元
export const START_UNIT = [0, 2, 6, 12, 18, 24];

// 大纲用完后的实战周
export const PRACTICE_UNITS = [
  '找房子与签约', '银行与手机办理', '看医生与买药', '求职面试', '职场午餐闲聊', '旅行计划与预订',
  '投诉与退换货', '婚礼与庆祝', '兴趣社团活动', '讨论电影与书', '科技与生活', '人生规划与梦想',
  '在居酒屋和同事喝酒', '地震与紧急情况', '日本的节日', '育儿与教育', '环保话题', '回顾与展望',
].map((t) => ({ title: `实战：${t}`, grammar: ['综合运用'], scene: t, practice: true }));

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
