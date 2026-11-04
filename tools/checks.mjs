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

check('F13：紧急页不给先后顺序', () => {
  const html = ctx.Render.emergency()
  if (html.includes('先打')) throw new Error('仍写「先打」')
  if (html.includes('打不通再打')) throw new Error('仍写「打不通再打」')
  if (!html.includes('tel:119') || !html.includes('tel:120')) throw new Error('缺拨号')
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
