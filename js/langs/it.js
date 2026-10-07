// 意大利语课程：水平等级、分级测试题库、26 周课程大纲、给 AI 的教学要点

const LEVELS = [
  { id: 0, name: '零基础', desc: '完全没学过', target: '能用简单句完成自我介绍、点餐、购物、问路等生存级对话（约 A2 口语）' },
  { id: 1, name: '入门', desc: '会打招呼和少量单词', target: '能就日常话题进行简单但连贯的对话（A2–B1 口语）' },
  { id: 2, name: 'A1', desc: '能说简单的句子', target: '能自然聊日常生活、讲述经历和计划（约 B1 口语）' },
  { id: 3, name: 'A2', desc: '能应付简单的日常交流', target: '能流畅聊大多数日常话题（B1+ 口语）' },
  { id: 4, name: 'B1', desc: '能聊熟悉的话题', target: '能表达观点、讨论工作和社会话题（约 B2 口语）' },
  { id: 5, name: 'B2+', desc: '能流利讨论多数话题', target: '在抽象和专业话题上自然流利地表达（B2–C1 口语）' },
];

// 分级测试题库：lv 1–5，每级随机抽 4 题，答对 3 题以上进入下一级
const PLACEMENT_ITEMS = [
  // lv1 入门
  { lv: 1, type: 'read', q: '「Grazie」是什么意思？', options: ['对不起', '谢谢', '你好', '再见'], answer: 1 },
  { lv: 1, type: 'read', q: '「acqua」是什么意思？', options: ['水', '面包', '咖啡', '书'], answer: 0 },
  { lv: 1, type: 'read', q: 'uno, due, （　）', options: ['quattro', 'tre', 'sei', 'dieci'], answer: 1 },
  { lv: 1, type: 'read', q: '「Ciao」是什么意思？', options: ['谢谢', '请', '你好', '对不起'], answer: 2 },
  { lv: 1, type: 'listen', audio: 'Buongiorno!', q: '听到的是什么意思？', options: ['晚安', '早上好／你好', '谢谢', '再见'], answer: 1 },
  { lv: 1, type: 'listen', audio: 'Come ti chiami?', q: '听到的是什么意思？', options: ['你几岁？', '你住在哪里？', '你叫什么名字？', '你好吗？'], answer: 2 },

  // lv2 A1
  { lv: 2, type: 'read', q: 'Io （　） cinese.', options: ['sei', 'sono', 'è', 'siamo'], answer: 1 },
  { lv: 2, type: 'read', q: '（　） ragazza è italiana.', options: ['Il', 'Lo', 'La', 'Gli'], answer: 2 },
  { lv: 2, type: 'read', q: 'Noi （　） a Milano.（abitare）', options: ['abitiamo', 'abitate', 'abitano', 'abito'], answer: 0 },
  { lv: 2, type: 'read', q: '「Ho fame」是什么意思？', options: ['我渴了', '我饿了', '我累了', '我冷了'], answer: 1 },
  { lv: 2, type: 'listen', audio: 'Quanto costa?', q: '听到的是什么意思？', options: ['几点了？', '在哪里？', '多少钱？', '多少个？'], answer: 2 },
  { lv: 2, type: 'listen', audio: "Scusi, dov'è la stazione?", q: '听到的是什么意思？', options: ['请问车站在哪里？', '请问几点开车？', '请问这是什么？', '请问有座位吗？'], answer: 0 },

  // lv3 A2
  { lv: 3, type: 'read', q: 'Ieri Maria （　） andata al cinema.', options: ['ha', 'è', 'era', 'sono'], answer: 1 },
  { lv: 3, type: 'read', q: 'Ieri ho （　） una pizza.', options: ['mangiare', 'mangiata', 'mangiato', 'mangiavo'], answer: 2 },
  { lv: 3, type: 'read', q: 'Compri il pane? Sì, （　） compro.', options: ['lo', 'la', 'gli', 'ne'], answer: 0 },
  { lv: 3, type: 'read', q: 'Quando ero bambino, （　） sempre al mare.', options: ['sono andato', 'andrò', 'andavo', 'andassi'], answer: 2 },
  { lv: 3, type: 'listen', audio: 'Mi piacerebbe venire, ma domani devo lavorare.', q: '听到的是什么意思？', options: ['我很想来，但明天要上班', '我明天不用上班，可以来', '我不喜欢工作', '我昨天来过了'], answer: 0 },
  { lv: 3, type: 'listen', audio: 'Ci vediamo stasera alle otto davanti al bar.', q: '听到的是什么意思？', options: ['明天早上八点在车站见', '今晚八点在咖啡馆门口见', '今晚在酒吧喝八杯', '八点以后再联系'], answer: 1 },

  // lv4 B1
  { lv: 4, type: 'read', q: 'Se avessi tempo, （　） in Italia.', options: ['andrò', 'vado', 'andrei', 'sarei andato'], answer: 2 },
  { lv: 4, type: 'read', q: 'Penso che lui （　） ragione.', options: ['abbia', 'ha', 'avrà', 'aveva'], answer: 0 },
  { lv: 4, type: 'read', q: 'Quanti libri hai? （　） ho tre.', options: ['Li', 'Ne', 'Ci', 'Gli'], answer: 1 },
  { lv: 4, type: 'read', q: 'Il libro （　） ti ho parlato è questo.', options: ['che', 'a cui', 'di cui', 'dove'], answer: 2 },
  { lv: 4, type: 'read', q: '「In bocca al lupo!」是什么意思？', options: ['小心狼！', '祝你好运！', '我饿极了！', '快跑！'], answer: 1 },
  { lv: 4, type: 'listen', audio: "Non vedo l'ora di rivederti!", q: '听到的是什么意思？', options: ['我看不清时间', '我不想再见到你', '我等不及要再见到你了', '我没时间见你'], answer: 2 },

  // lv5 B2+
  { lv: 5, type: 'read', q: "Se l'avessi saputo, （　） prima.", options: ['verrei', 'sarei venuto', 'venissi', 'vengo'], answer: 1 },
  { lv: 5, type: 'read', q: 'Benché （　） stanco, ha continuato a lavorare.', options: ['era', 'sarà', 'fosse', 'è'], answer: 2 },
  { lv: 5, type: 'read', q: 'Bisogna che tutti （　） in orario.', options: ['arrivino', 'arrivano', 'arriveranno', 'arrivati'], answer: 0 },
  { lv: 5, type: 'read', q: '「Non tutti i mali vengono per nuocere」的意思最接近？', options: ['祸不单行', '塞翁失马，焉知非福', '病从口入', '良药苦口'], answer: 1 },
  { lv: 5, type: 'listen', audio: 'Avrei preferito che tu mi avessi avvisato prima di prendere quella decisione.', q: '听到的是什么意思？', options: ['我希望你做那个决定之前先告诉我', '你应该马上做决定', '我已经提醒过你了', '我更喜欢你的决定'], answer: 0 },
  { lv: 5, type: 'listen', audio: 'Per quanto riguarda il progetto, ne parleremo alla prossima riunione.', q: '听到的是什么意思？', options: ['项目已经结束了', '我们现在就讨论项目', '关于项目，我们下次会议再讨论', '项目会议取消了'], answer: 2 },
];

// 口语测试：难度递增的 5 个问题
const SPEAKING_QUESTIONS = [
  'Come ti chiami?',
  'Di dove sei e dove abiti?',
  'Che cosa hai fatto lo scorso fine settimana?',
  "Perché studi l'italiano?",
  "Secondo te, quali sono le differenze più grandi tra la Cina e l'Italia?",
];

// 课程大纲：每个单元 = 一周
const UNITS = [
  { title: '发音与打招呼', grammar: ['字母与发音规则', 'Ciao／Buongiorno', 'grazie／prego'], scene: '在咖啡馆和意大利人第一次打招呼' },
  { title: '自我介绍', grammar: ['essere', 'chiamarsi', '国籍形容词的阴阳性'], scene: '在语言交换活动上做自我介绍' },
  { title: '名词与冠词', grammar: ['阴阳性与单复数', '定冠词 il／la／lo／i／le／gli', '不定冠词'], scene: '介绍你的房间和家里的东西' },
  { title: '数字、时间与价格', grammar: ['数字 1–100', 'Che ore sono?', 'Quanto costa?'], scene: '在菜市场买水果' },
  { title: '日常作息', grammar: ['-are／-ere／-ire 现在时', '自反动词 alzarsi', '频率副词'], scene: '和朋友聊彼此的一天' },
  { title: '购物', grammar: ['Vorrei…', 'questo／quello', '颜色与尺码'], scene: '在服装店挑选衣服、问尺码' },
  { title: '餐厅点餐', grammar: ['Per me…', 'Posso avere…?', '冠词性介词 del／della'], scene: '在餐厅点餐、结账' },
  { title: '问路与交通', grammar: ["Dov'è…?", '命令式指路', '介词 a／in／da'], scene: '在车站问路、买火车票' },
  { title: '喜好与爱好', grammar: ['mi piace／mi piacciono', 'avere voglia di', '形容词的位置'], scene: '和新朋友聊兴趣爱好' },
  { title: '周末与经历', grammar: ['passato prossimo（avere）', 'passato prossimo（essere）', '过去分词的配合'], scene: '周一和同事聊周末做了什么' },
  { title: '邀约与计划', grammar: ['Ti va di…?', 'futuro semplice', 'stare per'], scene: '约朋友周末一起出去玩' },
  { title: '描述人和事物', grammar: ['形容词配合', 'stare + gerundio', '物主形容词'], scene: '向朋友介绍你的家人和家乡' },
  { title: '请求与许可', grammar: ['potere／volere／dovere', 'Posso…?', '敬称 Lei'], scene: '在房东家询问规则、提出请求' },
  { title: '经验与比较', grammar: ['più／meno … di', '最高级', 'già／ancora／mai'], scene: '和朋友比较各地旅行经历' },
  { title: '过去的习惯', grammar: ['imperfetto', 'imperfetto 和 passato prossimo', 'quando／mentre'], scene: '讲讲你小时候的事' },
  { title: '朋友间的口语', grammar: ['tu 和 Lei 的区别', '口语常用词 dai／boh／magari', '感叹句'], scene: '和意大利朋友随意地闲聊' },
  { title: '理由与解释', grammar: ['perché／siccome', 'quindi／allora', '直接宾语代词 lo／la／li／le'], scene: '迟到了向朋友解释原因' },
  { title: '健康与看病', grammar: ['Mi fa male…', 'dovresti（建议）', '间接宾语代词 mi／ti／gli'], scene: '在诊所向医生描述症状' },
  { title: '打电话与预约', grammar: ['礼貌请求 vorrei／potrebbe', '电话用语', '代词 ci／ne'], scene: '打电话预约餐厅和理发店' },
  { title: '请人帮忙', grammar: ['组合代词 glielo', 'fare + 不定式', '命令式 + 代词'], scene: '请朋友帮忙搬家' },
  { title: '条件与建议', grammar: ['se + 现在时', 'condizionale', 'Al posto tuo…'], scene: '给来意大利旅游的朋友提建议' },
  { title: '推测与传闻', grammar: ['用 futuro 表示推测', 'sembra che', 'dicono che'], scene: '和同事聊听说的消息和天气' },
  { title: '职场意大利语', grammar: ['Lei 的正式用法', '邮件与会议常用语', 'congiuntivo 入门'], scene: '第一天上班向上司和同事问好' },
  { title: '被动与无人称', grammar: ['si 无人称／被动', 'essere + 过去分词', 'venire 被动'], scene: '和朋友吐槽生活中的烦心事' },
  { title: '表达意见', grammar: ['penso che + congiuntivo', 'secondo me', 'dovrebbe'], scene: '讨论远程办公的利与弊' },
  { title: '讲述故事', grammar: ['trapassato prossimo', '连接词 poi／allora／invece', 'gerundio'], scene: '讲一次难忘的旅行经历' },
  { title: '应对麻烦', grammar: ['投诉用语', 'Mi scusi, ma…', '委婉请求'], scene: '酒店房间出问题，和前台交涉' },
  { title: '社会话题', grammar: ['secondo + 名词', 'mentre／invece', '数据的表达'], scene: '聊最近的新闻和社会现象' },
  { title: '辩论与说服', grammar: ['congiuntivo imperfetto', '第二类假设句', '让步 benché／nonostante'], scene: '说服朋友一起参加一个计划' },
  { title: '商务会议', grammar: ['正式请求', '汇报用语', '第三类假设句'], scene: '在会议上汇报项目进展' },
  { title: '文化与价值观', grammar: ['意大利的生活习惯', '常用习语', 'congiuntivo 综合运用'], scene: '和意大利人聊两国文化差异' },
  { title: '自然流利：语气与附和', grammar: ['填充词 allora／cioè／insomma', '附和 davvero?／ma dai!', '语调'], scene: '像意大利人一样自然地闲聊' },
];

const START_UNIT = [0, 2, 6, 12, 18, 24];

const PRACTICE_UNITS = [
  '找房子与签约', '银行与手机办理', '看医生与买药', '求职面试', '午餐时和同事闲聊', '旅行计划与预订',
  '投诉与退换货', '婚礼与庆祝', '兴趣社团活动', '讨论电影与书', '足球与体育', '意大利美食与做饭',
  '在酒吧喝开胃酒', '政府办事与居留', '意大利的节日', '育儿与学校', '环保话题', '回顾与展望',
].map((t) => ({ title: `实战：${t}`, grammar: ['综合运用'], scene: t, practice: true }));

export default {
  id: 'it',
  name: '意大利语',
  flag: '🇮🇹',
  bcp47: 'it-IT',
  htmlLang: 'it',
  appTitle: '意大利语口语教练',
  readingLabel: '音节与重音',
  sample: 'Ciao! Facciamo pratica di italiano insieme.',
  voiceRe: /natural|google|alice|federica|elsa|isabella|luca/i,
  voiceInstall: { android: 'Italiano', ios: '意大利语' },
  levels: LEVELS,
  selfCheck: {
    q: '你学过意大利语吗？',
    options: [
      { label: '完全没学过', skip: true },
      { label: '学过一点（会打招呼、数字）' },
      { label: '学过一段时间' },
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
      '零基础：只用最基础的问候和 essere／chiamarsi 句型，每句不超过 6 个词，说话慢而清楚。',
      '入门：只用 A1 常用词和现在时，短句。',
      'A1：A1 词汇，现在时的规则和常见不规则动词，简单问句。',
      'A2：A2 水平，可以用 passato prossimo 和常见代词，自然但不太快。',
      'B1：B1 水平，自然口语，可以用 imperfetto、futuro、condizionale 和常见习语。',
      'B2+：接近母语者的自然口语，包括 congiuntivo 和较抽象的话题。',
    ],
    learner: '以中文为母语的成年人',
    goal: '半年内能用意大利语基本流利地对话',
    teachTips: '指出中国人容易犯的错误（如名词阴阳性与冠词、动词变位、介词搭配、tu／Lei 的选择）。',
    readingRule: 'reading 字段写成按音节划分、并把重音音节大写的形式，例如 "CIA-o"、"per-CHÉ"、"stu-DEN-te"。',
    glossRule: 'zh 字段写中文翻译。',
    chatPersona: '热情、友好的意大利语会话陪练',
    correctionScope: '动词变位、阴阳性配合、冠词、介词或语域（tu／Lei）',
    pronIssues: '双辅音读成单辅音（如 nonno／nono）、r 没有打舌、gli／gn、c／g 在 e、i 前的读法、元音不够饱满、重音位置错误等中国学生常见问题',
    sameSound: '只是大小写、撇号或标点不同',
    strictSounds: '双辅音、词尾元音、冠词和介词',
    pitchNote: '不要评价语调（识别结果反映不出语调）。',
    lookupReading: '按音节划分并把重音音节大写，如 "CA-sa"',
    lookupConfusion: '说明阴阳性、单复数，或动词原形与这里的变位',
    lookupExtra: '如果是动词，写“原形 + 本句里的人称和时态”；如果是名词或形容词，写阴阳性和单复数；其他词为空字符串',
  },
};
