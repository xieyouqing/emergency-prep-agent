// 问答链路检查：打真后端 + 前端接线（node 桩）
// 用法：先 python server/api.py 8001，再 node tools/checks-api.mjs
// 原则：只验「跑通 + 不崩 + 结构对」，不验答案质量
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const BASE = 'http://127.0.0.1:8001'
let failed = 0
const results = []

async function check(name, fn) {
  try { await fn(); results.push('PASS ' + name); }
  catch (e) { results.push('FAIL ' + name + ' -> ' + e.message); failed++; }
}
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`) }

async function get(path, timeoutMs = 5000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(BASE + path, { signal: ctl.signal })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch (e) { /* 非 JSON */ }
    return { status: r.status, json, headers: r.headers }
  } finally {
    clearTimeout(t)
  }
}

// 预检：后端没起就别跑后面
const pre = await get('/health').catch(() => null)
if (!pre || pre.status !== 200) {
  console.log('后端没起（%s）。先运行：python server/api.py 8001', BASE)
  process.exit(2)
}

/* ---------- 基础通达 ---------- */
await check('health 200 且 snippets > 0', async () => {
  const r = await get('/health')
  eq(r.status, 200)
  if (!r.json.ok || r.json.snippets < 1) throw new Error('health 内容不对')
})

await check('命中：哨子 -> answer + sources', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('哨子'))
  if (r.status !== 200) throw new Error('status ' + r.status)
  if (!r.json.answer) throw new Error('没有 answer')
  if (!r.json.sources || !r.json.sources.length) throw new Error('没有 sources')
  for (const s of r.json.sources) {
    if (!s.name || !s.url || !s.fetch_date || !s.level) throw new Error('来源字段不全')
  }
})

await check('兜底：明天天气 -> answer=null + channels', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('明天天气'))
  eq([r.json.answer, r.json.fallback], [null, 'channel'])
  if (!Array.isArray(r.json.channels) || !r.json.channels.length) throw new Error('缺 channels')
})

await check('拒答：用药类给 reason', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('发烧吃什么药'))
  eq(r.json.answer, null)
  if (!(r.json.reason || '').includes('用药')) throw new Error('缺拒答理由: ' + r.json.reason)
})

/* ---------- 边界 ---------- */
await check('空查询与纯空格：200 + 兜底', async () => {
  for (const q of ['', '   ']) {
    const r = await get('/ask?q=' + encodeURIComponent(q))
    if (r.status !== 200) throw new Error('status ' + r.status)
    eq(r.json.answer, null)
  }
})

await check('超长查询（1000 字）：不 5xx', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('水'.repeat(1000)))
  if (r.status >= 500) throw new Error('status ' + r.status)
})

await check('畸形编码：不 5xx', async () => {
  const r = await get('/ask?q=%E0%A4%A')
  if (r.status >= 500) throw new Error('status ' + r.status)
})

await check('单字「水」：不崩', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('水'))
  if (r.status !== 200) throw new Error('status ' + r.status)
})

await check('英文/数字「119」「ABC」：不崩', async () => {
  for (const q of ['119', 'ABC']) {
    const r = await get('/ask?q=' + encodeURIComponent(q))
    if (r.status >= 500) throw new Error(q + ' status ' + r.status)
  }
})

await check('未知路径 404', async () => {
  const r = await get('/nope')
  eq(r.status, 404)
})

await check('CORS 头存在', async () => {
  const r = await get('/ask?q=' + encodeURIComponent('手电'))
  eq(r.headers.get('access-control-allow-origin'), '*')
})

await check('并发 5 个请求全部 200 且 3s 内', async () => {
  const t0 = Date.now()
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => get('/ask?q=' + encodeURIComponent('手电'))))
  const cost = Date.now() - t0
  if (rs.some((r) => r.status !== 200)) throw new Error('有非 200')
  if (cost > 3000) throw new Error('耗时 ' + cost + 'ms')
})

/* ---------- 前端接线（node 桩 + 真 fetch） ---------- */
const stub = { innerHTML: '', addEventListener: () => {} }
const ctx = vm.createContext({
  fetch, encodeURIComponent, Date, JSON, Math, Object, Array, String, Number,
  setTimeout, clearTimeout, console,
  document: { getElementById: () => stub, addEventListener: () => {} },
  location: { href: '' },
  alert: () => {},
})
for (const f of ['src/core/store.js', 'src/core/chips.js', 'src/check/data.js', 'src/check/logic.js',
  'src/check/render.js', 'src/emergency/render.js', 'src/daily/render.js', 'src/app.js']) {
  vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f })
}
vm.runInContext("state = emptyState(); screen = 'home';", ctx)
// 浏览器里 DAILY_API = ''（同源）；node 没有 origin，测试里给绝对地址
vm.runInContext("DAILY_API = 'http://127.0.0.1:8001'", ctx)

const askAndWait = async (q) => {
  vm.runInContext("dailyRes = null", ctx)
  vm.runInContext(`askDaily(${JSON.stringify(q)})`, ctx)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100))
    if (ctx.dailyRes) return ctx.dailyRes
  }
  return null
}

await check('前端接线：命中路径把结果写进 dailyRes', async () => {
  const res = await askAndWait('手电怎么挑')
  if (!res || !res.answer) throw new Error('没拿到答案')
})

await check('前端接线：兜底路径带 channels', async () => {
  const res = await askAndWait('明天天气')
  if (!res) throw new Error('没返回')
  eq(res.answer, null)
  if (!res.channels || !res.channels.length) throw new Error('缺 channels')
})

await check('前端接线：同源代理 /ask（走 dev-server 8000）', async () => {
  // 浏览器里 DAILY_API = ''，请求发到当前源；这里模拟「同源代理」路径
  const r = await fetch('http://127.0.0.1:8000/ask?q=' + encodeURIComponent('哨子')).then((x) => x.json()).catch(() => null)
  if (!r) throw new Error('dev-server 代理不通')
  if (!r.answer) throw new Error('代理后没拿到答案')
})

await check('前端接线：后端不可达 -> 明确提示「连不上」', async () => {
  vm.runInContext("DAILY_API = 'http://127.0.0.1:9'", ctx)
  const res = await askAndWait('手电')
  if (!res) throw new Error('没返回')
  if (!(res.reason || '').includes('连不上')) throw new Error('提示不对: ' + res.reason)
  vm.runInContext("DAILY_API = 'http://127.0.0.1:8001'", ctx)
})

console.log(results.join('\n'))
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
