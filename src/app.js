// 状态层：纯逻辑（不碰 DOM）＋ 页面装配。
// 依据 docs/02-数据契约.md：§2 答案结构、§3 三分支、§4 分组与下一步、§5 持久化、§7 四条补充规则。
// T2 范围：最小链路（首屏 → 答一项 → 下一项 → 结果页）。分支页见 T3，紧急页见 T4。

// 纯逻辑已拆出：core/store.js（存储与状态形状）、check/logic.js（分组与下一步）
// 渲染已拆出：core/chips.js（顶部常驻区）、check/render.js、emergency/render.js
// 加载顺序见 src/index.html；本文件只做状态机与事件编排。

/* ---------- 页面装配 ---------- */

var state = emptyState();
var idx = 0;
var screen = 'check';
var prevScreen = 'check'; // 从哪一屏进的紧急页，返回时回到那里
var lastAction = null;    // 撤销快照：{id, prevIdx, hadAnswer, prevAnswer, hadHelp}
var undoVisible = false;
var undoTimer = null;

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

  // 紧急页不显示顶部常驻区（它本身就是紧急出口）
  if (screen === 'emergency') {
    root.innerHTML = Render.emergency();
    return;
  }

  // 补充规则 3：零条目兜底，不进入结果判定；紧急入口必须照常可用
  if (!Array.isArray(ITEMS) || !ITEMS.length) {
    root.innerHTML = Render.chips({ emergency: true }) + Render.error('清单暂时打不开，请稍后再试');
    return;
  }

  if (screen === 'result') {
    var g = groupAnswers(ITEMS, state.answers, state.needsHelp);
    root.innerHTML = Render.chips({ emergency: true, undo: undoVisible }) + Render.result(g, nextOf(g));
    return;
  }

  if (screen === 'unsure') {
    // 分支页给「返回」，不给「撤销」——否则辅助入口会到 3 个
    root.innerHTML = Render.chips({ emergency: true, back: true }) + Render.unsure(ITEMS[idx], idx, ITEMS.length);
    return;
  }

  if (idx >= ITEMS.length) {
    screen = 'result';
    render();
    return;
  }

  root.innerHTML = Render.chips({ emergency: true, undo: undoVisible }) + Render.check(ITEMS[idx], idx, ITEMS.length);
}

function answer(a) {
  // 「不确定」先进分支页，三种去向都由用户自己选（contract §3）
  if (a === 'unsure') {
    rememberUndo(ITEMS[idx].id, idx);
    screen = 'unsure';
    render();
    return;
  }
  rememberUndo(ITEMS[idx].id, idx);
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
  rememberUndo(id, idx);
  if (kind === 'help') {
    state.answers[id] = 'unsure';
    if (state.needsHelp.indexOf(id) < 0) state.needsHelp.push(id); // needsHelp 去重
  } else {
    state.answers[id] = kind;
  }
  save();
  advance();
}

// 记下这次回答之前的样子，5 秒内可撤销（契约 §7.2：删键 + 清 needsHelp，不写回「否」）
function rememberUndo(id, prevIdx) {
  lastAction = {
    id: id,
    prevIdx: prevIdx,
    hadAnswer: Object.prototype.hasOwnProperty.call(state.answers, id),
    prevAnswer: state.answers[id],
    hadHelp: state.needsHelp.indexOf(id) >= 0
  };
  undoVisible = true;
  if (undoTimer !== null) clearTimeout(undoTimer);
  if (typeof setTimeout === 'function') {
    undoTimer = setTimeout(function () {
      undoVisible = false;
      undoTimer = null;
      render();
    }, 5000);
  }
}

function undoLast() {
  if (!lastAction) return;
  var a = lastAction;
  if (a.hadAnswer) state.answers[a.id] = a.prevAnswer;
  else delete state.answers[a.id];
  if (!a.hadHelp) {
    var k = state.needsHelp.indexOf(a.id);
    if (k >= 0) state.needsHelp.splice(k, 1);
  }
  idx = a.prevIdx;
  screen = 'check';
  undoVisible = false;
  lastAction = null;
  if (undoTimer !== null) { clearTimeout(undoTimer); undoTimer = null; }
  save();
  render();
}

// 返回＝辅助出口，不写答案、不动进度（§6 验收 4：每条分支都能退回）
function back() {
  if (screen === 'emergency') {
    screen = prevScreen; // 从哪来回哪去
    render();
    return;
  }
  screen = 'check';
  render();
}

// 进紧急页：记住来路，回来时不至于把人丢到第一项
function openEmergency() {
  if (screen !== 'emergency') prevScreen = screen;
  screen = 'emergency';
  render();
}

function restart() {
  state = emptyState();
  save();
  idx = 0;
  screen = 'check';
  render();
}

// 调起系统短信并预填正文，由用户按下发送；不发号码，不自动发送（§2 转发边界）
function forward() {
  var g = groupAnswers(ITEMS, state.answers, state.needsHelp);
  var body = buildMessage(g);
  try {
    if (typeof location !== 'undefined') {
      location.href = 'sms:?body=' + encodeURIComponent(body);
      return;
    }
  } catch (e) {
    // 桌面或受限环境忽略，落到下方兜底
  }
  alert(body);
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
  if (t.getAttribute('data-emergency')) {
    openEmergency();
    return;
  }
  if (t.getAttribute('data-forward')) {
    forward();
    return;
  }
  if (t.getAttribute('data-undo')) {
    undoLast();
    return;
  }
  if (t.getAttribute('data-restart')) restart();
}

function init() {
  var rootEl = null;
  try { rootEl = document.getElementById('root'); } catch (e) { rootEl = null; }

  // 读取存储：禁用/隐私模式下 getItem 会抛 SecurityError，必须自己兜住
  var raw = null;
  try {
    if (typeof localStorage !== 'undefined') raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    raw = null;
  }
  state = loadState(raw);

  // 数据层没到位（data.js 404 / 语法错 / 被截断）：先渲染兜底页，紧急入口照常可用
  if (!Array.isArray(ITEMS) || ITEMS.length === 0) {
    if (rootEl) {
      rootEl.innerHTML = Render.chips({ emergency: true }) + Render.error('清单暂时打不开，请稍后再试');
      rootEl.addEventListener('click', onClick);
    }
    return;
  }

  // 补充规则 1：有部分答案就从中断项继续
  var pending = firstUnansweredIndex(ITEMS, state.answers);
  idx = pending === -1 ? ITEMS.length : pending;
  screen = pending === -1 ? 'result' : 'check';

  if (rootEl) rootEl.addEventListener('click', onClick);
  render();
}

if (typeof document !== 'undefined' && document.getElementById) init();
