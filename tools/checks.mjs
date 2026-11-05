// 断言脚本：node tools/checks.mjs
// 零依赖，纯 node 跑；覆盖数据契约、状态机关键路径、以及今天修的回归项。
// 约定：一条断言一个 PASS/FAIL；任何 FAIL 退出码非 0。
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const ctx = vm.createContext({})
const load = (p) => vm.runInContext(readFileSync(p, 'utf8'), ctx, { filename: p })
// 加载顺序必须与 src/index.html 一致
load('src/core/store.js')
load('src/core/chips.js')
load('src/check/data.js')
load('src/check/logic.js')
load('src/check/render.js')
load('src/emergency/render.js')
load('src/daily/render.js')
load('src/app.js')

let failed = 0
const eq = (a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`)
}
const check = (name, fn) => {
  try { fn(); console.log('PASS ' + name) }
  catch (e) { console.log('FAIL ' + name + ' -> ' + e.message); failed++ }
}
const reset = () => vm.runInContext("state = emptyState(); idx = 0; screen = 'check'; prevScreen = 'check'; lastAction = null; undoVisible = false;", ctx)
const all = (mk, help) => {
  const answers = {}, h = []
  ctx.ITEMS.forEach((i) => { if (mk) answers[i.id] = mk; if (help) h.push(i.id) })
  return { answers, h }
}

/* ---------- 数据 ---------- */
check('数据：14 项，字段齐全，id 唯一', () => {
  eq(ctx.ITEMS.length, 14)
  eq(new Set(ctx.ITEMS.map((i) => i.id)).size, 14)
  for (const i of ctx.ITEMS) {
    for (const k of ['id', 'name', 'check', 'checkSource', 'checkLevel', 'howto', 'source', 'scope']) {
      if (!(k in i)) throw new Error(i.id + ' 缺 ' + k)
    }
    if (!i.howto.trim()) throw new Error(i.id + ' howto 空')
  }
})

/* ---------- 契约 §6 用例 ---------- */
check('用例A：全「有」-> 都配齐了', () => {
  const { answers } = all('yes', false)
  const g = ctx.groupAnswers(ctx.ITEMS, answers, [])
  eq([g.has.length, g.buy.length, g.help.length, g.verify.length], [14, 0, 0, 0])
  eq(ctx.nextText(ctx.nextOf(g)), '都配齐了，半年后再看一遍')
})

check('用例B：全「不确定」+ 全找人帮 -> 发消息（不是"先确认"）', () => {
  const { answers, h } = all('unsure', true)
  const g = ctx.groupAnswers(ctx.ITEMS, answers, h)
  eq([g.help.length, g.verify.length, g.buy.length], [14, 0, 0])
  if (!ctx.nextText(ctx.nextOf(g)).startsWith('发消息')) throw new Error('下一步不是发消息')
})

check('全「不确定」但没选找人帮 -> 先确认', () => {
  const { answers } = all('unsure', false)
  const g = ctx.groupAnswers(ctx.ITEMS, answers, [])
  eq([g.help.length, g.verify.length], [0, 14])
  if (!ctx.nextText(ctx.nextOf(g)).startsWith('先确认')) throw new Error('下一步不是先确认')
})

check('待采购优先级最高', () => {
  const g = ctx.groupAnswers(ctx.ITEMS, { torch: 'no', whistle: 'unsure' }, ['whistle'])
  if (ctx.nextText(ctx.nextOf(g)).indexOf('今天把') !== 0) throw new Error('待采购没优先')
})

/* ---------- 回归：F1 撤销 ---------- */
check('F1：答「有」后撤销 -> 答案回到未答、进度回原项', () => {
  reset()
  vm.runInContext("answer('yes')", ctx)
  eq(ctx.state.answers.torch, 'yes')
  eq(ctx.idx, 1)
  vm.runInContext('undoLast()', ctx)
  eq(Object.keys(ctx.state.answers).length, 0)
  eq(ctx.idx, 0)
  eq(ctx.undoVisible, false)
})

check('F1：找人帮后撤销 -> needsHelp 被清掉', () => {
  reset()
  vm.runInContext("answer('unsure'); pick('help')", ctx)
  eq(ctx.state.needsHelp, ['torch'])
  vm.runInContext('undoLast()', ctx)
  eq(ctx.state.needsHelp, [])
  eq(Object.keys(ctx.state.answers).length, 0)
})

check('F1：撤销只回一项，不动机后面的答案', () => {
  reset()
  vm.runInContext("answer('yes'); answer('no')", ctx)
  vm.runInContext('undoLast()', ctx)
  eq([ctx.state.answers.torch, ctx.state.answers.whistle, ctx.idx], ['yes', undefined, 1])
})

/* ---------- 回归：F2 存储与数据结构 ---------- */
check('F2：坏 JSON 回空状态', () => {
  eq(ctx.loadState('{oops'), ctx.emptyState())
})

check('F2：needsHelp 非数组 -> 归一为空数组，不抛错', () => {
  const s = ctx.loadState('{"answers":{"torch":"yes"},"needsHelp":5}')
  eq(s.needsHelp, [])
  eq(s.answers, { torch: 'yes' })
})

check('F2：answers 非法值被丢弃', () => {
  const s = ctx.loadState('{"answers":{"torch":"YES","whistle":"no"}}')
  eq(s.answers, { whistle: 'no' })
})

/* ---------- 回归：F3 转发入口条件 ---------- */
check('F3：纯待采购也有转发入口', () => {
  const g = ctx.groupAnswers(ctx.ITEMS, { torch: 'no' }, [])
  const html = ctx.Render.result(g, ctx.nextOf(g))
  if (!html.includes('data-forward')) throw new Error('没有转发按钮')
})

check('F3：都配齐时不显示转发入口', () => {
  const { answers } = all('yes', false)
  const g = ctx.groupAnswers(ctx.ITEMS, answers, [])
  if (ctx.Render.result(g, ctx.nextOf(g)).includes('data-forward')) throw new Error('不该有转发按钮')
})

check('F3：消息包含三类内容', () => {
  const g = { buy: [ctx.ITEMS[0]], help: [ctx.ITEMS[1]], verify: [ctx.ITEMS[2]] }
  const msg = ctx.buildMessage(g)
  if (!msg.includes('要买：')) throw new Error('缺待采购')
  if (!msg.includes('请帮忙看看：')) throw new Error('缺找人帮')
  if (!msg.includes('还没确认：')) throw new Error('缺待确认')
})

/* ---------- 交互约束 ---------- */
check('每屏主操作按钮 ≤ 3', () => {
  const checkHtml = ctx.Render.check(ctx.ITEMS[0], 0, 14)
  const unsureHtml = ctx.Render.unsure(ctx.ITEMS[0], 0, 14)
  eq((checkHtml.match(/class="btn(?![-\w])/g) || []).length, 3)
  eq((unsureHtml.match(/class="btn(?![-\w])/g) || []).length, 3)
})

check('紧急页：tel:120 / tel:119 都在，且无顶部 chip', () => {
  const html = ctx.Render.emergency()
  if (!html.includes('href="tel:120"') || !html.includes('href="tel:119"')) throw new Error('缺拨号')
  if (html.includes('data-emergency')) throw new Error('紧急页不该有急事 chip')
})

/* ---------- 回归：F4 / F9 / F13 ---------- */
check('F4：inferred 判据在检查页有「仅供参考」提示', () => {
  const inferred = ctx.ITEMS.find((i) => i.checkLevel === 'inferred')
  const trusted = ctx.ITEMS.find((i) => i.checkLevel !== 'inferred')
  if (!ctx.Render.check(inferred, 0, 14).includes('仅供参考')) throw new Error('inferred 无提示')
  if (ctx.Render.check(trusted, 0, 14).includes('仅供参考')) throw new Error('cross-checked 不该有提示')
})

check('F4：结果页给 inferred 条目加「推断」标签', () => {
  const g = { has: ctx.ITEMS.filter((i) => i.checkLevel === 'inferred'), buy: [], help: [], verify: [] }
  const html = ctx.Render.result(g, null)
  if (!html.includes('li-tag')) throw new Error('缺推断标签')
})

check('F9：下一步在滚动区之外（先出现，再是清单）', () => {
  const g = { has: ctx.ITEMS, buy: [], help: [], verify: [] }
  const html = ctx.Render.result(g, null)
  const posNext = html.indexOf('next-box')
  const posScroll = html.indexOf('class="scroll"')
  if (posNext < 0) throw new Error('缺 next-box')
  if (!(posNext < posScroll)) throw new Error('下一步仍在滚动区里')
})

check('F13：紧急页是二值判断 + 保底规则，不排先后', () => {
  const html = ctx.Render.emergency()
  if (/先打\s*120/.test(html)) throw new Error('把 120 排在了前面')
  if (html.includes('打不通再打')) throw new Error('仍写「打不通再打」')
  if (!html.includes('着火了、有人被困')) throw new Error('缺 119 的判定')
  if (!html.includes('受伤、晕倒')) throw new Error('缺 120 的判定')
  if (!html.includes('拿不准：先打 119')) throw new Error('缺保底规则')
  if (!html.includes('tel:119') || !html.includes('tel:120')) throw new Error('缺拨号')
  if (!html.includes('不用开这个')) throw new Error('没承认 App 不是最快路径')
})

/* ---------- 链路 #2 不确定三分支 ---------- */
check('#2 不确定进分支页：不写答案、进度不动', () => {
  reset()
  vm.runInContext("answer('unsure')", ctx)
  eq(ctx.screen, 'unsure')
  eq(Object.keys(ctx.state.answers).length, 0)
  eq(ctx.idx, 0)
})

check('#2 「看到有」-> yes，进下一项', () => {
  reset()
  vm.runInContext("answer('unsure'); pick('yes')", ctx)
  eq([ctx.state.answers.torch, ctx.idx, ctx.screen], ['yes', 1, 'check'])
})

check('#2 「确认没有」-> no，进待采购', () => {
  reset()
  vm.runInContext("answer('unsure'); pick('no')", ctx)
  const g = ctx.groupAnswers(ctx.ITEMS, ctx.state.answers, ctx.state.needsHelp)
  eq([ctx.state.answers.torch, g.buy.length, g.verify.length], ['no', 1, 0])
})

check('#2 「看不了找人帮」-> unsure + needsHelp，进找人帮', () => {
  reset()
  vm.runInContext("answer('unsure'); pick('help')", ctx)
  const g = ctx.groupAnswers(ctx.ITEMS, ctx.state.answers, ctx.state.needsHelp)
  eq([ctx.state.answers.torch, ctx.state.needsHelp, g.help.length], ['unsure', ['torch'], 1])
})

check('#2 分支页「返回」不写答案、进度不动', () => {
  reset()
  vm.runInContext("answer('unsure'); back()", ctx)
  eq([ctx.screen, ctx.idx, Object.keys(ctx.state.answers).length], ['check', 0, 0])
})

/* ---------- 链路 #4 结果页四组 ---------- */
check('测试用到的 id 都必须真实存在', () => {
  const ids = new Set(ctx.ITEMS.map((i) => i.id))
  for (const id of ['torch', 'mask', 'lifejacket', 'whistle', 'towel', 'food']) {
    if (!ids.has(id)) throw new Error('数据里没有 id: ' + id)
  }
})

check('#4 混合答案四组数量正确', () => {
  const answers = { torch: 'yes', whistle: 'no', food: 'unsure', towel: 'unsure' }
  const g = ctx.groupAnswers(ctx.ITEMS, answers, ['towel'])
  eq([g.has.length, g.buy.length, g.help.length, g.verify.length], [1, 1, 1, 1])
})

/* ---------- 链路 #5 紧急入口 ---------- */
check('#5 进紧急页、返回原屏、进度不变', () => {
  reset()
  vm.runInContext("idx = 5; openEmergency()", ctx)
  eq([ctx.screen, ctx.prevScreen], ['emergency', 'check'])
  vm.runInContext('back()', ctx)
  eq([ctx.screen, ctx.idx], ['check', 5])
})

/* ---------- 链路 #6 转发 ---------- */
check('#6 消息三类齐全且不自动发送（只拼串）', () => {
  const g = { buy: [ctx.ITEMS[0]], help: [ctx.ITEMS[1]], verify: [ctx.ITEMS[2]] }
  const msg = ctx.buildMessage(g)
  eq(['要买：', '请帮忙看看：', '还没确认：'].every((k) => msg.includes(k)), true)
})

/* ---------- 链路 #7 中断继续 ---------- */
check('#7 有 3 项答案时从第 4 项继续', () => {
  // 按数据真实顺序取前 3 项，别按记忆写 id
  const answers = {}
  ctx.ITEMS.slice(0, 3).forEach((i) => { answers[i.id] = 'yes' })
  eq(ctx.firstUnansweredIndex(ctx.ITEMS, answers), 3)
})

check('#7 全部答完时不继续（返回 -1）', () => {
  const answers = {}
  ctx.ITEMS.forEach((i) => { answers[i.id] = 'yes' })
  eq(ctx.firstUnansweredIndex(ctx.ITEMS, answers), -1)
})

/* ---------- 主页与入口分流 ---------- */
check('入口：没答过 -> 自查第 1 项', () => {
  const e = ctx.entryOf(ctx.ITEMS, {})
  eq([e.screen, e.idx], ['check', 0])
})

check('入口：答了一部分 -> 从第一个未答项继续（不回主页）', () => {
  const answers = {}
  ctx.ITEMS.slice(0, 3).forEach((i) => { answers[i.id] = 'yes' })
  const e = ctx.entryOf(ctx.ITEMS, answers)
  eq([e.screen, e.idx], ['check', 3])
})

check('入口：全部答完 -> 主页', () => {
  const answers = {}
  ctx.ITEMS.forEach((i) => { answers[i.id] = 'yes' })
  const e = ctx.entryOf(ctx.ITEMS, answers)
  eq([e.screen, e.idx], ['home', ctx.ITEMS.length])
})

check('主页：3 个按钮（开始/清单/家人号码）+ 状态行', () => {
  const html = ctx.Render.home({ lastText: '还没查过', startText: '开始自查' })
  eq((html.match(/<button/g) || []).length, 3)
  if (!html.includes('data-start') || !html.includes('data-show-list')) throw new Error('缺按钮')
  if (!html.includes('上次检查') || !html.includes('还没查过')) throw new Error('缺状态行')
})

check('日常：问句屏 3 个预设 + 输入框', () => {
  const html = ctx.Render.dailyAsk()
  eq((html.match(/<button/g) || []).length, 3)
  if (!html.includes('data-preset')) throw new Error('缺预设')
  if (!html.includes('id="q"')) throw new Error('缺输入框')
})

check('日常：答案屏带来源与等级', () => {
  const html = ctx.Render.dailyAnswer({
    answer: '饮用水：每人每天 1 升，备 3 天。',
    sources: [{ name: '广东疾控 家庭应急指南', level: 'cross-checked', fetch_date: '2026-11-04' }],
  })
  if (!html.includes('饮用水')) throw new Error('缺答案')
  if (!html.includes('来源')) throw new Error('缺来源标题')
  if (!html.includes('cross-checked')) throw new Error('缺等级')
})

check('日常：查不到 -> 转渠道拨号', () => {
  const html = ctx.Render.dailyFallback({ channels: [{ name: '12345 政务热线', tel: '12345' }] })
  if (!html.includes('tel:12345')) throw new Error('缺渠道电话')
  if (!html.includes('data-daily-again')) throw new Error('缺再问入口')
})

check('chips 优先级：撤销/返回时不出「问个事」，常驻时不出第三个', () => {
  const withUndo = ctx.Render.chips({ emergency: true, daily: true, undo: true })
  const withBack = ctx.Render.chips({ emergency: true, daily: true, back: true })
  const plain = ctx.Render.chips({ emergency: true, daily: true })
  eq((withUndo.match(/class="chip"/g) || []).length, 2)
  eq((withBack.match(/class="chip"/g) || []).length, 2)
  eq((plain.match(/class="chip"/g) || []).length, 2)
  if (withUndo.includes('data-daily')) throw new Error('撤销时不该有问个事')
  if (withBack.includes('data-daily')) throw new Error('返回时不该有问个事')
  if (!plain.includes('data-daily')) throw new Error('常驻时应有问个事')
})

/* ---------- T6 触发时机与三态 ---------- */
const DAY = 86400000
const NOW = Date.parse('2026-11-05T12:00:00Z')
const st = (lastDaysAgo, remind) => ({
  answers: {}, needsHelp: [],
  lastCompletedAt: lastDaysAgo === null ? null : new Date(NOW - lastDaysAgo * DAY).toISOString(),
  remind: remind || { snoozedUntil: null, muted: false },
})

check('T6：没查过 -> 不提醒（直接进自查）', () => {
  eq(ctx.remindInfo(st(null), NOW).show, false)
})

check('T6：刚查完 -> 不提醒', () => {
  eq(ctx.remindInfo(st(3), NOW).show, false)
})

check('T6：91 天 -> 提醒，且天数正确', () => {
  const r = ctx.remindInfo(st(91), NOW)
  eq([r.show, r.days], [true, 91])
})

check('T6：稍后 24 小时内 -> 不再提醒', () => {
  const r = ctx.remindInfo(st(91, { snoozedUntil: new Date(NOW + 3600000).toISOString(), muted: false }), NOW)
  eq([r.show, r.snoozed], [false, true])
})

check('T6：稍后过期 -> 重新提醒', () => {
  const r = ctx.remindInfo(st(91, { snoozedUntil: new Date(NOW - 3600000).toISOString(), muted: false }), NOW)
  eq(r.show, true)
})

check('T6：别再问 -> 永不再提醒', () => {
  const r = ctx.remindInfo(st(400, { snoozedUntil: null, muted: true }), NOW)
  eq([r.show, r.muted], [false, true])
})

check('T6：提醒屏主操作恰好 3 个', () => {
  const html = ctx.Render.remind(91)
  eq((html.match(/<button/g) || []).length, 3)
})

check('T6：主页静音时出现「恢复提醒」', () => {
  const on = ctx.Render.home({ lastText: '今天', startText: '开始新一轮自查', muted: true })
  const off = ctx.Render.home({ lastText: '今天', startText: '开始新一轮自查', muted: false })
  if (!on.includes('data-remind-resume')) throw new Error('静音时缺恢复入口')
  if (off.includes('data-remind-resume')) throw new Error('未静音不该有恢复入口')
})

check('T6：坏 remind 结构被归一', () => {
  const s = ctx.loadState('{"remind":{"snoozedUntil":123,"muted":"yes"}}')
  eq(s.remind, { snoozedUntil: null, muted: false })
})

/* ---------- 联系人（短信收件人） ---------- */
check('号码归一：去非数字、长度 5–20', () => {
  eq(ctx.normalizeTel('138-0013-8000'), '13800138000')
  eq(ctx.normalizeTel('138 0013 8000'), '13800138000')
  eq(ctx.normalizeTel('12'), '')
  eq(ctx.normalizeTel('abc'), '')
})

check('短信链接：号码 + 正文都拼进去', () => {
  const href = ctx.buildSmsHref('13800138000', '要买：手电')
  if (!href.startsWith('sms:13800138000?body=')) throw new Error(href)
  if (!href.includes(encodeURIComponent('要买：手电'))) throw new Error('正文没编码')
})

check('首次转发无号码 -> 进存号码屏', () => {
  reset()
  vm.runInContext("state.contacts = []; screen = 'result'; forward()", ctx)
  eq(ctx.screen, 'contact')
})

check('有号码 -> 不进存号码屏（走 sms 链接）', () => {
  reset()
  vm.runInContext("state.contacts = [{name:'女儿', tel:'13800138000'}]; screen = 'result'; forward()", ctx)
  eq(ctx.screen, 'result')
})

check('坏联系人数据被归一（丢弃非法、最多 3 个）', () => {
  const s = ctx.loadState(JSON.stringify({ contacts: [
    { name: 'a', tel: '13800138000' }, { name: 'b', tel: '12' }, { name: 'c', tel: '13900139000' },
    { name: 'd', tel: '13700137000' }, { name: 'e', tel: '13600136000' },
  ] }))
  eq(s.contacts.length, 3)
  eq(s.contacts.map((c) => c.tel), ['13800138000', '13900139000', '13700137000'])
})

check('存号码屏：2 个输入；无联系人时 2 个按钮、有联系人时 3 个', () => {
  const empty = ctx.Render.contact({ contacts: [], mode: 'send' })
  eq((empty.match(/<input/g) || []).length, 2)
  eq((empty.match(/<button/g) || []).length, 2)
  const has = ctx.Render.contact({ contacts: [{ name: '女儿', tel: '13800138000' }], mode: 'manage' })
  eq((has.match(/<button/g) || []).length, 3) // 保存 / 删除 / 返回
  if (!has.includes('data-del-contact')) throw new Error('缺删除')
})

// 模拟输入框（document 桩，按 id 返回不同值）
const setInputs = (tel, name) => {
  ctx.document = { getElementById: (id) => ({ value: id === 'tel' ? (tel || '') : (id === 'cname' ? (name || '') : '') }) }
}

check('联系人上限 3：第 4 个被拦并提示', () => {
  reset()
  vm.runInContext("state.contacts = []; contactMode = 'manage'", ctx)
  for (const t of ['13800138000', '13900139000', '13700137000']) {
    setInputs(t, '家人')
    vm.runInContext('saveContact()', ctx)
  }
  eq(ctx.state.contacts.length, 3)
  setInputs('13600136000', '第四个')
  vm.runInContext('saveContact()', ctx)
  eq(ctx.state.contacts.length, 3)
  if (!ctx.contactHint.includes('最多存')) throw new Error('没有上限提示: ' + ctx.contactHint)
})

check('同号＝更新，不新增', () => {
  reset()
  vm.runInContext("state.contacts = [{name:'旧', tel:'13800138000'}]", ctx)
  setInputs('13800138000', '新称呼')
  vm.runInContext('saveContact()', ctx)
  eq(ctx.state.contacts.length, 1)
  eq(ctx.state.contacts[0].name, '新称呼')
})

check('删除：按号码删指定那个', () => {
  reset()
  vm.runInContext("state.contacts = [{name:'a', tel:'13800138000'}, {name:'b', tel:'13900139000'}]", ctx)
  setInputs('13900139000', '')
  vm.runInContext('delContact()', ctx)
  eq(ctx.state.contacts.map((c) => c.tel), ['13800138000'])
})

check('手机号格式校验：11 位必须是 1[3-9] 开头', () => {
  eq(ctx.isMobileTel('13800138000'), true)
  eq(ctx.isMobileTel('12800138000'), false)   // 第二位 2 不合法
  eq(ctx.isMobileTel('1380013800'), false)    // 10 位
  eq(ctx.telHint('12800138000'), '手机号要以 1 开头、第二位 3–9')
  eq(ctx.telHint(''), '先填一个号码')
  eq(ctx.telHint('123'), '号码太短，再核一下')
})

check('固话也能存（5–20 位数字）', () => {
  eq(ctx.normalizeTel('0551-12345678'), '055112345678')
})

check('主页：未静音时 3 个主操作（含家人号码），静音时换成恢复提醒', () => {
  const normal = ctx.Render.home({ lastText: '今天', startText: '开始自查', muted: false })
  const muted = ctx.Render.home({ lastText: '今天', startText: '开始自查', muted: true })
  eq((normal.match(/<button/g) || []).length, 3)
  eq((muted.match(/<button/g) || []).length, 3)
  if (!normal.includes('data-contacts')) throw new Error('缺家人号码入口')
  if (normal.includes('data-remind-resume')) throw new Error('未静音不该有恢复')
  if (!muted.includes('data-remind-resume')) throw new Error('静音应有恢复')
})

/* ---------- T8 顺手看一眼 ---------- */
check('T8：维护项 3–5 个，且都在数据里', () => {
  const list = ctx.maintItems(ctx.ITEMS)
  if (list.length < 3 || list.length > 5) throw new Error('维护项 ' + list.length + ' 个')
  eq(list.map((i) => i.id), ['medicine', 'food', 'firstaid', 'extinguisher'])
})

check('T8：答完最后一项 -> 进维护屏，不是直接结果页', () => {
  reset()
  vm.runInContext("idx = ITEMS.length - 1; answer('yes')", ctx)
  eq(ctx.screen, 'maint')
  eq(ctx.maintIdx, 0)
})

check('T8：维护屏两个按钮、不滚动', () => {
  const html = ctx.Render.maint(ctx.ITEMS[0], 0, 4)
  eq((html.match(/<button/g) || []).length, 2)
  if (!html.includes('顺手看一眼')) throw new Error('缺进度')
})

check('T8：选「该换新的」-> 该项进待采购', () => {
  reset()
  vm.runInContext("idx = ITEMS.length - 1; answer('yes')", ctx)
  const first = ctx.maintList[0]
  vm.runInContext("maintPick('bad')", ctx)
  eq(ctx.state.answers[first.id], 'no')
})

check('T8：选「还好」-> 不动答案', () => {
  reset()
  vm.runInContext("idx = ITEMS.length - 1; answer('yes')", ctx)
  const first = ctx.maintList[0]
  const before = ctx.state.answers[first.id]
  vm.runInContext("maintPick('ok')", ctx)
  eq(ctx.state.answers[first.id], before)
})

check('T8：走完维护才写 lastCompletedAt 并进结果页', () => {
  reset()
  vm.runInContext("idx = ITEMS.length - 1; answer('yes')", ctx)
  eq(ctx.state.lastCompletedAt, null)
  for (let i = 0; i < 4; i++) vm.runInContext("maintPick('ok')", ctx)
  eq(ctx.screen, 'result')
  if (!ctx.state.lastCompletedAt) throw new Error('没写完成时间')
})

/* ---------- T11 主动退出 ---------- */
check('T11：退出把当前项记待确认，其余未答不动', () => {
  reset()
  vm.runInContext("idx = 2; exitCheck()", ctx)
  eq(ctx.screen, 'home')
  const id = ctx.ITEMS[2].id
  eq(ctx.state.answers[id], 'unsure')
  eq(Object.keys(ctx.state.answers).length, 1)
})

check('T11：已答的项退出不改答案', () => {
  reset()
  vm.runInContext("state.answers[ITEMS[2].id] = 'yes'; idx = 2; exitCheck()", ctx)
  eq(ctx.state.answers[ctx.ITEMS[2].id], 'yes')
})

check('T11：退出后下次从下一个未答项继续', () => {
  reset()
  // 前两项已答，第三项点了退出
  vm.runInContext("state.answers[ITEMS[0].id]='yes'; state.answers[ITEMS[1].id]='no'; idx = 2; exitCheck()", ctx)
  const e = ctx.entryOf(ctx.ITEMS, ctx.state.answers)
  eq([e.screen, e.idx], ['check', 3])
})

check('T11：退出口只在自查主屏（chips 优先级）', () => {
  const checkChips = ctx.Render.chips({ emergency: true, exit: true })
  const undoFirst = ctx.Render.chips({ emergency: true, exit: true, undo: true })
  const unsureChips = ctx.Render.chips({ emergency: true, back: true })
  if (!checkChips.includes('data-exit')) throw new Error('主屏缺退出口')
  if (undoFirst.includes('data-exit')) throw new Error('撤销时不该有退出')
  if (unsureChips.includes('data-exit')) throw new Error('分支页不该有退出')
  eq((checkChips.match(/class="chip"/g) || []).length, 2)
})

/* ---------- 小屏适配（样式回归，不测布局） ---------- */
check('样式：存在 360px/680h 的压缩规则，且整屏可滚动兜底', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  if (!/@media \(max-width: 360px\), \(max-height: 680px\)/.test(css)) throw new Error('缺小屏 media query')
  if (!/\.screen \{[^}]*overflow-y: auto/.test(css)) throw new Error('缺整屏滚动兜底')
})

/* ---------- 出口表（结构性约束，治 F1/F2 那类死路） ---------- */
const ALL_SCREENS = ['emergency', 'remind', 'home', 'maint', 'contact', 'daily', 'dailyAnswer', 'result', 'unsure', 'check']

check('出口表覆盖全部屏（新增屏不登记就红）', () => {
  eq(Object.keys(ctx.SCREEN_CHIPS).sort(), ALL_SCREENS.slice().sort())
})

check('除紧急页外，每屏都有可执行的出口', () => {
  for (const s of ALL_SCREENS) {
    if (s === 'emergency') continue
    const html = ctx.chipsFor(s)
    if (!/data-(home|back|exit|daily|undo)/.test(html)) throw new Error(s + ' 没有出口')
  }
})

check('F1：维护屏有「先不查了」，退出不写完成时间', () => {
  if (!ctx.chipsFor('maint').includes('data-exit')) throw new Error('maint 无出口')
  reset()
  vm.runInContext("state.lastCompletedAt = null; screen = 'maint'; maintList = []; exitFlow()", ctx)
  eq([ctx.screen, ctx.state.lastCompletedAt], ['home', null])
})

check('F2：问句屏能一步回主页', () => {
  if (!ctx.chipsFor('daily').includes('data-back')) throw new Error('daily 无返回 chip')
  reset()
  vm.runInContext("screen = 'daily'; back()", ctx)
  eq(ctx.screen, 'home')
})

check('F2：答案屏与兜底屏也能一步回主页', () => {
  for (const s of ['dailyAnswer', 'contact', 'remind']) {
    reset()
    vm.runInContext(`screen = '${s}'; back()`, ctx)
    eq(ctx.screen, 'home')
  }
})

/* ---------- 形态约束 ---------- */
check('所有屏都没有输入框（不打字）', () => {
  const htmls = [
    ctx.Render.check(ctx.ITEMS[0], 0, 14),
    ctx.Render.unsure(ctx.ITEMS[0], 0, 14),
    ctx.Render.emergency(),
  ]
  for (const h of htmls) if (/<input|<textarea|<select/.test(h)) throw new Error('出现输入控件')
})

check('辅助入口 ≤ 2（急事 + 撤销/返回）', () => {
  const a = ctx.Render.chips({ emergency: true, undo: true })
  const b = ctx.Render.chips({ emergency: true, back: true })
  eq((a.match(/class="chip"/g) || []).length, 2)
  eq((b.match(/class="chip"/g) || []).length, 2)
})

check('兜底页也带急事入口', () => {
  const html = ctx.Render.chips({ emergency: true }) + ctx.Render.error('清单暂时打不开')
  if (!html.includes('data-emergency')) throw new Error('兜底页没有急事入口')
})

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
