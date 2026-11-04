// 状态层：纯逻辑（不碰 DOM）＋ 页面装配。
// 依据 docs/02-数据契约.md：§2 答案结构、§3 三分支、§4 分组与下一步、§5 持久化、§7 四条补充规则。
// T2 范围：最小链路（首屏 → 答一项 → 下一项 → 结果页）。分支页见 T3，紧急页见 T4。

var STORAGE_KEY = 'ep-v1';

/* ---------- 纯逻辑（可在没有浏览器的环境里直接测） ---------- */

function emptyState() {
  return { answers: {}, needsHelp: [], lastCompletedAt: null };
}

function loadState(raw) {
  if (!raw) return emptyState();
  try {
    var s = JSON.parse(raw);
    return {
      answers: s.answers || {},
      needsHelp: s.needsHelp || [],
      lastCompletedAt: s.lastCompletedAt || null
    };
  } catch (e) {
    return emptyState();
  }
}

function groupAnswers(items, answers, needsHelp) {
  var has = [];
  var buy = [];
  var verify = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var a = answers[it.id];
    // 关键：unsure 不等于 no；只有 no 进待采购（contract §2）
    if (a === 'yes') has.push(it);
    else if (a === 'no') buy.push(it);
    else if (a === 'unsure' || needsHelp.indexOf(it.id) >= 0) verify.push(it);
  }
  return { has: has, buy: buy, verify: verify };
}

function nextOf(groups) {
  if (groups.buy.length) return { kind: 'buy', item: groups.buy[0] };
  if (groups.verify.length) return { kind: 'verify', item: groups.verify[0] };
  return null;
}

function nextText(next) {
  if (!next) return '都配齐了，半年后再看一遍';
  if (next.kind === 'buy') return '今天把「' + next.item.name + '」配上';
  return '先确认「' + next.item.name + '」有没有：' + next.item.check;
}

function firstUnansweredIndex(items, answers) {
  for (var i = 0; i < items.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(answers, items[i].id)) return i;
  }
  return -1;
}

/* ---------- 页面装配 ---------- */

var state = emptyState();
var idx = 0;
var screen = 'check';

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // file:// 或隐私模式写不进去，不影响本次使用
  }
}

function complete() {
  state.lastCompletedAt = new Date().toISOString();
}

function render() {
  if (typeof document === 'undefined') return; // 无浏览器环境（测试）直接跳过
  var root = document.getElementById('root');
  if (!root) return;

  // 补充规则 3：零条目兜底，不进入结果判定
  if (!ITEMS || !ITEMS.length) {
    root.innerHTML = Render.error('清单暂时打不开，请稍后再试');
    return;
  }

  if (screen === 'result') {
    var g = groupAnswers(ITEMS, state.answers, state.needsHelp);
    root.innerHTML = Render.result(g, nextOf(g));
    return;
  }

  if (screen === 'unsure') {
    root.innerHTML = Render.chips({ back: true }) + Render.unsure(ITEMS[idx], idx, ITEMS.length);
    return;
  }

  if (idx >= ITEMS.length) {
    screen = 'result';
    render();
    return;
  }

  root.innerHTML = Render.check(ITEMS[idx], idx, ITEMS.length);
}

function answer(a) {
  // 「不确定」先进分支页，三种去向都由用户自己选（contract §3）
  if (a === 'unsure') {
    screen = 'unsure';
    render();
    return;
  }
  state.answers[ITEMS[idx].id] = a;
  save();
  advance();
}

function advance() {
  idx = idx + 1;
  if (idx >= ITEMS.length) {
    complete();
    save();
    screen = 'result';
  } else {
    // 必须切回主屏：否则从分支页出来后，下一项还停在「不确定」那一页
    screen = 'check';
  }
  render();
}

// 分支页的三条去向：看到有 / 确认没有 / 找人帮
function pick(kind) {
  var id = ITEMS[idx].id;
  if (kind === 'help') {
    state.answers[id] = 'unsure';
    if (state.needsHelp.indexOf(id) < 0) state.needsHelp.push(id); // needsHelp 去重
  } else {
    state.answers[id] = kind;
  }
  save();
  advance();
}

// 返回＝辅助出口，不写答案、不动进度（§6 验收 4：每条分支都能退回）
function back() {
  screen = 'check';
  render();
}

function restart() {
  state = emptyState();
  save();
  idx = 0;
  screen = 'check';
  render();
}

function onClick(e) {
  var t = e.target;
  if (!t || t.tagName !== 'BUTTON') return;
  if (t.getAttribute('data-answer')) {
    answer(t.getAttribute('data-answer'));
    return;
  }
  if (t.getAttribute('data-pick')) {
    pick(t.getAttribute('data-pick'));
    return;
  }
  if (t.getAttribute('data-back')) {
    back();
    return;
  }
  if (t.getAttribute('data-restart')) restart();
}

function init() {
  state = loadState(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);

  // 补充规则 1：有部分答案就从中断项继续
  var pending = firstUnansweredIndex(ITEMS, state.answers);
  idx = pending === -1 ? ITEMS.length : pending;
  screen = pending === -1 ? 'result' : 'check';

  document.getElementById('root').addEventListener('click', onClick);
  render();
}

if (typeof document !== 'undefined' && document.getElementById) init();
