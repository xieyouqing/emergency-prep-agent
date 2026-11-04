// 条目池：安徽省《家庭应急物资储备建议清单》（基础版）4 大类 14 项。
// 条目出处：皖应急函〔2024〕218号，2024-07-26，省应急厅等四部门
//   https://yjt.ah.gov.cn/public/9377745/149722691.html
// 交叉验证：广东省疾控中心《家庭应急指南》2025-05-12
//   https://cdcp.gd.gov.cn/ywdt/zdzt/fzjz/hlzhjkfhzs/content/mpost_4710162.html
// 抓取与核查日 2026-11-04；检索记录、时效与待验证清单见 docs/04-数据来源.md
//
// 字段：id / name / check / checkSource / checkLevel / howto / source / scope
// checkLevel 只评「check」的来源；howto 一律是操作常识（官方无条文），不另给级别。
// checkLevel：official 官方原文写明 / consensus ≥2 权威一致 / cross-checked ≥2 独立官方来源一致 / inferred 我方推断

var ITEMS = [
  {
    id: 'torch',
    name: '具备收音功能的手摇充电电筒',
    check: '开机亮；按键能发出报警声；拔掉充电只摇 30 秒仍能亮',
    checkSource: '原文：安徽「可对手机充电、FM自动搜台、按键可发报警声音」；广东 2025-05-12「带收音+充电+报警功能」——仅覆盖三功能；「摇 30 秒仍能亮」为我方推断（待验证）',
    checkLevel: 'inferred',
    howto: '拔掉充电线，转摇把 30 秒，再按开关看亮不亮；顺手按一下报警键听有没有声。',
    source: '安徽基础版 第1项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'mask',
    name: '呼吸面罩（消防过滤式自救呼吸器）',
    check: '包装有效期未过；按说明展开能罩住口鼻，滤毒罐无破损',
    checkSource: '产品标准：GB 21976.7-2012《建筑火灾逃生避难器材 第7部分：过滤式消防自救呼吸器》，现行，国家消防救援局主管；官方未给家庭检查方法，本条为推断',
    checkLevel: 'inferred',
    howto: '先看包装袋上的有效期；再打开套到头上，看能不能罩住口鼻、带子能不能收紧。',
    source: '安徽基础版 第2项（皖应急函〔2024〕218号）',
    scope: ['fire']
  },
  {
    id: 'lifejacket',
    name: '救生衣（救生圈）',
    check: '穿上扣好能系紧；浮力材料没发硬、没开裂',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '穿上把扣子和带子都系紧，用手压一压里面的浮力材料，看有没有发硬、开裂。',
    source: '安徽基础版 第3项（皖应急函〔2024〕218号）',
    scope: ['flood']
  },
  {
    id: 'whistle',
    name: '救生哨',
    check: '吹一下有高频响声；无核设计（里面没有滚珠）',
    checkSource: '安徽原文「建议选择无核设计，可吹出高频求救信号」；广东 2025-05-12「高频救生哨」',
    checkLevel: 'cross-checked',
    howto: '放嘴里吹一下，听声音是不是又尖又远；摇一摇，里面没有滚珠的才是无核款。',
    source: '安徽基础版 第4项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'towel',
    name: '毛巾、纸巾 / 湿纸巾',
    check: '洗手间和玄关各有一份；干燥未受潮',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '去洗手间和玄关各看一眼，有没有、是不是干的。',
    source: '安徽基础版 第5项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'light',
    name: '防水火柴（打火机）、蜡烛 / 充电式应急灯',
    check: '断电试一次：应急灯能亮；火柴干燥能划着',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '拉一下家里总闸（或拔掉插头），看应急灯亮不亮；拿一根火柴划一下，看是不是还能着。',
    source: '安徽基础版 第6项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'food',
    name: '饼干或压缩饼干、干脆面、罐头、饮用水等',
    check: '每人每天 1 升水、备足 3 天；食品耐储存；看保质期（每半年检查一次）',
    checkSource: '广东 2025-05-12 原文「每人每天1升饮用水，备足3天量（至少3升/人）」「每半年检查更换一次」',
    checkLevel: 'cross-checked',
    howto: '数一数水够不够全家人三天、每人每天 1 升；看包装有没有鼓包、日期过没过。',
    source: '安徽基础版 第7项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'tent',
    name: '家庭小帐篷、防潮垫等',
    check: '取出能完整展开、无破洞；折叠后一个人能搬动',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '拿出来撑开，看看有没有破洞；再试一次能不能一个人折回去。',
    source: '安徽基础版 第8项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'scissors',
    name: '多功能组合剪刀',
    check: '刀、锯、钳至少两样能正常开合',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '把刀、锯、钳各打开再收拢一次，看卡不卡。',
    source: '安徽基础版 第9项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'rope',
    name: '应急逃生绳',
    check: '看承重标识（通常 ≥100 kg）；绳体无断裂，套钩完好',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '找绳子上的标签看写了多少公斤；从头到尾摸一遍，看有没有断丝，钩子好不好用。',
    source: '安徽基础版 第10项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'extinguisher',
    name: '灭火器 / 防火毯',
    check: '灭火器压力表指针在绿区；防火毯无破损、能完全展开',
    checkSource: '我方推断，无外部依据（江苏消防科普为长图无正文，无法摘录；见 docs/04-数据来源.md）',
    checkLevel: 'inferred',
    howto: '看灭火器上的小表盘，指针在绿区才对；防火毯拿出来完全展开看有没有破洞。',
    source: '安徽基础版 第11项（皖应急函〔2024〕218号）',
    scope: ['fire']
  },
  {
    id: 'medicine',
    name: '常用医药品',
    check: '都在有效期内；够 3 天量；说明书还在盒内',
    checkSource: '广东 2025-05-12 原文「（注意药品有效期）」——仅覆盖有效期部分',
    checkLevel: 'cross-checked',
    howto: '把药盒翻过来看日期，过期的挑出来；数一数常用药够不够三天。',
    source: '安徽基础版 第12项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'firstaid',
    name: '医用材料（口罩、创可贴、纱布绷带、碘伏棉棒）',
    check: '四样齐全且未过期；碘伏棉棒包装没被挤破',
    checkSource: '广东 2025-05-12 原文「创口贴、消毒棉球、止血绷带等清创包扎材料」——仅覆盖品类',
    checkLevel: 'cross-checked',
    howto: '打开药箱，四样一样样点过去；捏一下碘伏棉棒的包装，看有没有挤破。',
    source: '安徽基础版 第13项（皖应急函〔2024〕218号）',
    scope: []
  },
  {
    id: 'docs',
    name: '应急避灾自救资料',
    check: '有一份纸质或可离线查看的材料；家里人都知道放在哪',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    checkLevel: 'inferred',
    howto: '找一下那份材料放在哪，再问问家里人知不知道位置。',
    source: '安徽基础版 第14项（皖应急函〔2024〕218号）',
    scope: []
  }
];
