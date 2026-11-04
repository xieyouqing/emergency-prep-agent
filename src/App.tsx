import { useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS, type Answer, type Item } from './data/items'

type Screen = 'check' | 'unsure' | 'result' | 'emergency'
type Answers = Record<string, Answer>

type UndoSnapshot = {
  itemId: string
  prevAnswer: Answer | undefined
  prevIndex: number
  prevScreen: Screen
}

const STORAGE_KEY = 'emergency-prep-v0'
const UNDO_MS = 5000

function loadAnswers(): Answers {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Answers) : {}
  } catch {
    return {}
  }
}

function CheckScreen(props: {
  item: Item
  index: number
  total: number
  onAnswer: (a: Answer) => void
}) {
  const { item, index, total, onAnswer } = props
  return (
    <section className="screen">
      <p className="progress">第 {index + 1} / {total} 项</p>
      <h1 className="item-name">{item.name}</h1>
      <div className="actions">
        <button className="btn" onClick={() => onAnswer('yes')}>有</button>
        <button className="btn" onClick={() => onAnswer('no')}>没有</button>
        <button className="btn btn-ghost" onClick={() => onAnswer('unsure')}>不确定</button>
      </div>
    </section>
  )
}

function UnsureScreen(props: {
  item: Item
  onPick: (a: 'yes' | 'no' | 'help') => void
}) {
  const { item, onPick } = props
  return (
    <section className="screen">
      <p className="progress">不确定 · 三选一</p>
      <h1 className="item-name">{item.name}</h1>
      <p className="hint">照着做一遍，10 秒：{item.check}</p>
      <div className="actions">
        <button className="btn" onClick={() => onPick('yes')}>看到了，有</button>
        <button className="btn" onClick={() => onPick('no')}>确认没有</button>
        <button className="btn btn-ghost" onClick={() => onPick('help')}>看不了，找人帮</button>
      </div>
    </section>
  )
}

type NextOne =
  | { kind: 'buy'; item: Item }
  | { kind: 'verify'; item: Item }
  | null

function EmergencyScreen(props: { onBack: () => void }) {
  return (
    <section className="screen">
      <p className="progress">现在有急事</p>
      <h1 className="item-name">先打 120，说不清就报小区和楼号</h1>
      <p className="hint">打不通再打 119。不用等自查做完。</p>
      <div className="actions">
        {/* tel: 只调起系统拨号盘并预填号码，由用户按下拨号键（任务说明 §2 防误触） */}
        <a className="btn" href="tel:120">打 120</a>
        <a className="btn" href="tel:119">打 119</a>
        <button className="btn btn-ghost" onClick={props.onBack}>回到自查</button>
      </div>
    </section>
  )
}

function ResultScreen(props: {
  items: Item[]
  answers: Answers
  onRestart: () => void
  onForward: () => void
}) {
  const { items, answers, onRestart, onForward } = props
  const groups = useMemo(() => {
    const has: Item[] = []
    const verify: Item[] = []
    const buy: Item[] = []
    for (const it of items) {
      const a = answers[it.id]
      if (a === 'yes') has.push(it)
      else if (a === 'no') buy.push(it)
      else if (a === 'unsure') verify.push(it)
    }
    return { has, verify, buy }
  }, [items, answers])

  // 「不确定」不等于「确认没有」：不能直接进待采购（任务说明 §2）。
  const nextOne: NextOne = groups.buy[0]
    ? { kind: 'buy', item: groups.buy[0] }
    : groups.verify[0]
      ? { kind: 'verify', item: groups.verify[0] }
      : null

  const nextText = nextOne
    ? nextOne.kind === 'buy'
      ? `今天把「${nextOne.item.name}」配上`
      : `先确认「${nextOne.item.name}」有没有：${nextOne.item.check}`
    : '都配齐了，半年后再看一遍'

  return (
    <section className="screen">
      <p className="progress">本家庭适用清单</p>
      <div className="scroll">
        <h2 className="group-title">已有 · {groups.has.length} 项</h2>
        <ul className="list">{groups.has.map((it) => <li key={it.id}>{it.name}</li>)}</ul>
        <h2 className="group-title">待采购 · {groups.buy.length} 项</h2>
        <ul className="list">{groups.buy.map((it) => <li key={it.id}>{it.name}</li>)}</ul>
        <h2 className="group-title">待确认 / 找人帮 · {groups.verify.length} 项</h2>
        <ul className="list">{groups.verify.map((it) => <li key={it.id}>{it.name}</li>)}</ul>

        <h2 className="group-title">下一步只做一件</h2>
        <p className="next-one">{nextText}</p>
      </div>
      <div className="actions">
        <button className="btn" onClick={onForward}>发给家人代办</button>
        <button className="btn btn-ghost" onClick={onRestart}>再查一遍</button>
      </div>
    </section>
  )
}

export default function App() {
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers())
  const [index, setIndex] = useState(0)
  const [screen, setScreen] = useState<Screen>('check')
  const [undo, setUndo] = useState<UndoSnapshot | null>(null)
  const undoTimer = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const item = ITEMS[index]

  function armUndo(snapshot: UndoSnapshot) {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current)
    setUndo(snapshot)
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS)
  }

  function applyUndo() {
    if (!undo) return
    if (undoTimer.current !== null) {
      window.clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    setAnswers((prev) => {
      const next = { ...prev }
      if (undo.prevAnswer === undefined) delete next[undo.itemId]
      else next[undo.itemId] = undo.prevAnswer
      return next
    })
    setIndex(undo.prevIndex)
    setScreen(undo.prevScreen)
    setUndo(null)
  }

  function advance() {
    const next = index + 1
    if (next >= ITEMS.length) setScreen('result')
    else {
      setIndex(next)
      setScreen('check')
    }
  }

  function onAnswer(a: Answer) {
    armUndo({ itemId: item.id, prevAnswer: answers[item.id], prevIndex: index, prevScreen: screen })
    setAnswers((prev) => ({ ...prev, [item.id]: a }))
    if (a === 'unsure') setScreen('unsure')
    else advance()
  }

  function onUnsurePick(p: 'yes' | 'no' | 'help') {
    setAnswers((prev) => ({
      ...prev,
      [item.id]: p === 'yes' ? 'yes' : p === 'no' ? 'no' : 'unsure',
    }))
    advance()
  }

  // TODO(11/5): 调起系统短信预填内容，由用户按发送（任务说明 §2 转发边界）
  function onForward() {
    alert('待接入：系统短信预填。骨架阶段先不做。')
  }

  function restart() {
    setAnswers({})
    setIndex(0)
    setScreen('check')
    setUndo(null)
  }

  const body =
    screen === 'emergency'
      ? <EmergencyScreen onBack={() => setScreen(index >= ITEMS.length ? 'result' : 'check')} />
      : screen === 'result'
        ? <ResultScreen items={ITEMS} answers={answers} onRestart={restart} onForward={onForward} />
        : screen === 'unsure'
          ? <UnsureScreen item={item} onPick={onUnsurePick} />
          : <CheckScreen item={item} index={index} total={ITEMS.length} onAnswer={onAnswer} />

  return (
    <>
      {screen !== 'emergency' && (
        <div className="top-chips">
          <button className="chip" onClick={() => setScreen('emergency')}>我现在有急事</button>
          {undo && <button className="chip" onClick={applyUndo}>撤销</button>}
        </div>
      )}
      {body}
    </>
  )
}
