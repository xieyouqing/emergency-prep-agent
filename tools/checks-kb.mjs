// 知识库结构检查：不依赖后端，纯读 server/seed.json
// 用法：node tools/checks-kb.mjs
// 原则：只验「结构对不对、门槛守没守」，不验「答得好不好」
import { readFileSync } from 'node:fs'

const LEVELS = new Set(['official', 'consensus', 'cross-checked'])
const SCOPES = new Set(['', 'fire', 'flood'])
const ITEMS = ['torch', 'mask', 'lifejacket', 'whistle', 'towel', 'light',
  'food', 'tent', 'scissors', 'rope', 'extinguisher', 'medicine', 'firstaid', 'docs']

let failed = 0
const check = (name, fn) => {
  try { fn(); console.log('PASS ' + name) }
  catch (e) { console.log('FAIL ' + name + ' -> ' + e.message); failed++ }
}

const seed = JSON.parse(readFileSync('server/seed.json', 'utf8'))
const list = seed.snippets

check('片段数量 > 0', () => {
  if (!Array.isArray(list) || list.length === 0) throw new Error('snippets 为空')
})

check('每条字段齐全', () => {
  const need = ['id', 'item_id', 'text', 'source_name', 'source_url', 'fetch_date', 'level', 'scope']
  for (const s of list) {
    for (const k of need) if (!(k in s)) throw new Error(s.id + ' 缺 ' + k)
  }
})

check('id 唯一', () => {
  const ids = list.map((s) => s.id)
  if (new Set(ids).size !== ids.length) throw new Error('id 有重复')
})

check('level 只能是三级，inferred 不许入库', () => {
  for (const s of list) {
    if (!LEVELS.has(s.level)) throw new Error(s.id + ' 的 level=' + s.level)
    if (s.level === 'inferred') throw new Error(s.id + ' 是 inferred，按 docs/05 §3 不能入库')
  }
})

check('来源可追：url 是 http(s)，fetch_date 合法', () => {
  for (const s of list) {
    if (!/^https?:\/\//.test(s.source_url || '')) throw new Error(s.id + ' url 不合法')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.fetch_date || '')) throw new Error(s.id + ' 日期格式不对')
    if (!s.source_name) throw new Error(s.id + ' 缺来源名')
  }
})

check('scope 只能是 fire / flood / 空', () => {
  for (const s of list) {
    if (!Array.isArray(s.scope)) throw new Error(s.id + ' scope 不是数组')
    for (const x of s.scope) if (!SCOPES.has(x) || x === '') throw new Error(s.id + ' scope=' + x)
  }
})

check('14 个条目全部至少 1 段', () => {
  const got = new Set(list.map((s) => s.item_id))
  const miss = ITEMS.filter((i) => !got.has(i))
  if (miss.length) throw new Error('缺条目: ' + miss.join(','))
})

check('文本长度合理（10–200 字）', () => {
  for (const s of list) {
    if (s.text.length < 10 || s.text.length > 200) throw new Error(s.id + ' 长度 ' + s.text.length)
  }
})

console.log(failed === 0 ? '\nALL PASS (' + list.length + ' 段)' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
