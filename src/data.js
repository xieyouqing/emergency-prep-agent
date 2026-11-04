// 条目池：安徽省《家庭应急物资储备建议清单》（基础版）4 大类 14 项。
// 条目出处：皖应急函〔2024〕218号，2024-07-26，省应急厅等四部门
//   https://yjt.ah.gov.cn/public/9377745/149722691.html
// 交叉验证：广东省疾控中心《家庭应急指南》2025-05-12
//   https://cdcp.gd.gov.cn/ywdt/zdzt/fzjz/hlzhjkfhzs/content/mpost_4710162.html
// 抓取与核查日 2026-11-04；时效与待验证清单见 docs/04-数据来源.md
//
// 字段：id / name / check / source（条目出处）/ checkSource（判据出处，带原文摘录）/ scope / checkLevel
// checkLevel：official 官方原文写明 / consensus ≥2 权威一致 / cross-checked ≥2 独立官方来源一致 / inferred 我方推断

var ITEMS = [
  {
    id: 'torch',
    name: '具备收音功能的手摇充电电筒',
    // 三功能（收音 / 充电 / 报警）有原文；「拔掉充电摇 30 秒仍能亮」是推断 → 整条降为 inferred
    check: '开机亮；按键能发出报警声；拔掉充电只摇 30 秒仍能亮',
    source: '安徽基础版 第1项（皖应急函〔2024〕218号）',
    checkSource: '安徽原文「可对手机充电、FM自动搜台、按键可发报警声音」；广东 2025-05-12「多功能手电筒（带收音+充电+报警功能）」——仅覆盖三功能；「摇 30 秒仍能亮」为我方推断（待验证）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'mask',
    name: '呼吸面罩（消防过滤式自救呼吸器）',
    check: '包装有效期未过；按说明展开能罩住口鼻，滤毒罐无破损',
    source: '安徽基础版 第2项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: ['fire'],
    checkLevel: 'inferred'
  },
  {
    id: 'lifejacket',
    name: '救生衣（救生圈）',
    check: '穿上扣好能系紧；浮力材料没发硬、没开裂',
    source: '安徽基础版 第3项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: ['flood'],
    checkLevel: 'inferred'
  },
  {
    id: 'whistle',
    name: '救生哨',
    check: '吹一下有高频响声；无核设计（里面没有滚珠）',
    source: '安徽基础版 第4项（皖应急函〔2024〕218号）',
    checkSource: '安徽原文「建议选择无核设计，可吹出高频求救信号」；广东 2025-05-12「高频救生哨」',
    scope: [],
    checkLevel: 'cross-checked'
  },
  {
    id: 'towel',
    name: '毛巾、纸巾 / 湿纸巾',
    check: '洗手间和玄关各有一份；干燥未受潮',
    source: '安徽基础版 第5项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'light',
    name: '防水火柴（打火机）、蜡烛 / 充电式应急灯',
    check: '断电试一次：应急灯能亮；火柴干燥能划着',
    source: '安徽基础版 第6项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'food',
    name: '饼干或压缩饼干、干脆面、罐头、饮用水等',
    check: '每人每天 1 升水、备足 3 天；食品耐储存；看保质期（每半年检查一次）',
    source: '安徽基础版 第7项（皖应急函〔2024〕218号）',
    checkSource: '广东 2025-05-12 原文「每人每天1升饮用水，备足3天量（至少3升/人）」「每半年检查更换一次」',
    scope: [],
    checkLevel: 'cross-checked'
  },
  {
    id: 'tent',
    name: '家庭小帐篷、防潮垫等',
    check: '取出能完整展开、无破洞；折叠后一个人能搬动',
    source: '安徽基础版 第8项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'scissors',
    name: '多功能组合剪刀',
    check: '刀、锯、钳至少两样能正常开合',
    source: '安徽基础版 第9项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'rope',
    name: '应急逃生绳',
    check: '看承重标识（通常 ≥100 kg）；绳体无断裂，套钩完好',
    source: '安徽基础版 第10项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  },
  {
    id: 'extinguisher',
    name: '灭火器 / 防火毯',
    check: '灭火器压力表指针在绿区；防火毯无破损、能完全展开',
    source: '安徽基础版 第11项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: ['fire'],
    checkLevel: 'inferred'
  },
  {
    id: 'medicine',
    name: '常用医药品',
    check: '都在有效期内；够 3 天量；说明书还在盒内',
    source: '安徽基础版 第12项（皖应急函〔2024〕218号）',
    checkSource: '广东 2025-05-12 原文「（注意药品有效期）」——仅覆盖有效期部分',
    scope: [],
    checkLevel: 'cross-checked'
  },
  {
    id: 'firstaid',
    name: '医用材料（口罩、创可贴、纱布绷带、碘伏棉棒）',
    check: '四样齐全且未过期；碘伏棉棒包装没被挤破',
    source: '安徽基础版 第13项（皖应急函〔2024〕218号）',
    checkSource: '广东 2025-05-12 原文「创口贴、消毒棉球、止血绷带等清创包扎材料」——仅覆盖品类',
    scope: [],
    checkLevel: 'cross-checked'
  },
  {
    id: 'docs',
    name: '应急避灾自救资料',
    check: '有一份纸质或可离线查看的材料；家里人都知道放在哪',
    source: '安徽基础版 第14项（皖应急函〔2024〕218号）',
    checkSource: '我方推断，无外部依据（见 docs/04-数据来源.md 判据待验证清单）',
    scope: [],
    checkLevel: 'inferred'
  }
];
