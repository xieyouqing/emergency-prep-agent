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

// 同源相对路径：浏览器发 /ask，由 dev-server（开发）或 Nginx（生产）代理到后端。
// 这样本地、手机、云端行为一致，代码里不出现环境硬编码。
// 测试（node）里把它设成绝对地址即可。
var DAILY_API = '';
var contactMode = 'send';   // 'send'（存完发短信）/ 'manage'（只在主页主动进来管号码）
var contactHint = '';       // 号码格式提示
var maintList = [];         // T8：轮末「顺手看一眼」的待检项
var maintIdx = 0;
var dailyRes = null;                       // 最近一次问答结果
var dailyLoading = false;

// 入口分流（纯函数，方便测）：没答完 → 接着答那一项；全答完 → 主页
function entryOf(items, answers) {
  var pending = firstUnansweredIndex(items, answers);
  if (pending === -1) return { screen: 'home', idx: items.length };
  return { screen: 'check', idx: pending };
}

// 主页要显示的两句话：上次检查多久前、按钮文案
function homeInfo() {
  var done = state.lastCompletedAt ? new Date(state.lastCompletedAt).getTime() : 0;
  var lastText = '还没查过';
  if (done) {
    var days = Math.floor((Date.now() - done) / 86400000);
    lastText = days <= 0 ? '今天' : (days + ' 天前');
  }
  var answered = Object.keys(state.answers).length;
  var left = ITEMS.length - answered;
  var startText = left > 0 ? (answered ? '继续（还剩 ' + left + ' 项）' : '开始自查') : '开始新一轮自查';
  return { lastText: lastText, startText: startText, muted: state.remind.muted === true };
}

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

// 屏 → 出口配置（单一来源）。新增屏不在这张表里，断言会红（见 tools/checks.mjs）。
// 出口＝给用户一个「可执行的下一步动作」：返回 / 回到主页 / 先不查了。
var SCREEN_CHIPS = {
  emergency:   {},
  remind:      { emergency: true, back: true },
  home:        { emergency: true, daily: true },
  maint:       { emergency: true, exit: true },
  contact:     { emergency: true, back: true },
  daily:       { emergency: true, back: true },
  dailyAnswer: { emergency: true, back: true },
  result:      { emergency: true, daily: true },
  unsure:      { emergency: true, back: true },
  check:       { emergency: true, exit: true }
};

// 撤销是瞬时状态：只可能在 check / result 顶替「先不查了」或「问个事」
function chipsFor(name) {
  var base = SCREEN_CHIPS[name] || {};
  var cfg = { emergency: !!base.emergency, daily: !!base.daily, back: !!base.back, exit: !!base.exit, undo: false };
  if (undoVisible && (name === 'check' || name === 'result')) {
    cfg.undo = true;
    cfg.exit = false;
  }
  return Render.chips(cfg);
}

function screenBody() {
  if (screen === 'remind') return Render.remind(remindInfo(state).days || 0);
  if (screen === 'home') return Render.home(homeInfo());
  if (screen === 'maint') return Render.maint(maintList[maintIdx], maintIdx, maintList.length);
  if (screen === 'contact') {
    return Render.contact({ contacts: state.contacts, mode: contactMode, hint: contactHint });
  }
  if (screen === 'daily') return Render.dailyAsk();
  if (screen === 'dailyAnswer') {
    var r = dailyRes || { answer: null, channels: [] };
    return r.answer ? Render.dailyAnswer(r) : Render.dailyFallback(r);
  }
  if (screen === 'result') {
    var g = groupAnswers(ITEMS, state.answers, state.needsHelp);
    return Render.result(g, nextOf(g));
  }
  if (screen === 'unsure') return Render.unsure(ITEMS[idx], idx, ITEMS.length);
  return Render.check(ITEMS[idx], idx, ITEMS.length);
}

function render() {
  if (typeof document === 'undefined') return; // 无浏览器环境（测试）直接跳过
  var root = document.getElementById('root');
  if (!root) return;

  // 零条目兜底：不进入结果判定，但出口照常（紧急入口必须可用）
  if (!Array.isArray(ITEMS) || !ITEMS.length) {
    root.innerHTML = Render.chips({ emergency: true }) + Render.error('清单暂时打不开，请稍后再试');
    return;
  }

  if (screen === 'emergency') {
    root.innerHTML = Render.emergency();
    return;
  }

  if (screen !== 'remind' && screen !== 'home' && screen !== 'maint' && screen !== 'contact'
    && screen !== 'daily' && screen !== 'dailyAnswer' && screen !== 'result' && screen !== 'unsure'
    && idx >= ITEMS.length) {
    screen = 'result';
    render();
    return;
  }

  root.innerHTML = chipsFor(screen) + screenBody();
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
    // T8：答完 14 项先进「顺手看一眼」，走完才算这一轮完成
    var list = maintItems(ITEMS);
    if (list.length) {
      maintList = list;
      maintIdx = 0;
      screen = 'maint';
    } else {
      finishRound();
      return;
    }
  } else {
    // 必须切回主屏：否则从分支页出来后，下一项还停在「不确定」那一页
    screen = 'check';
  }
  render();
}

function finishRound() {
  complete();
  save();
  screen = 'result';
  render();
}

// 维护屏的两个选择：还好不动答案；该换新的 → 进待采购
function maintPick(kind) {
  var item = maintList[maintIdx];
  if (kind === 'bad') {
    state.answers[item.id] = 'no';
    save();
  }
  maintIdx = maintIdx + 1;
  if (maintIdx >= maintList.length) {
    maintList = [];
    finishRound();
    return;
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
  if (screen === 'unsure') {
    screen = 'check';
    render();
    return;
  }
  // 提醒 / 日常问答 / 联系人：返回到主页
  if (screen === 'remind' || screen === 'daily' || screen === 'dailyAnswer' || screen === 'contact') {
    screen = 'home';
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

// 再查一遍：只清本轮答案，保留「上次完成时间」和提醒设置
function restart() {
  state.answers = {};
  state.needsHelp = [];
  save();
  idx = 0;
  screen = 'check';
  undoVisible = false;
  lastAction = null;
  render();
}

// 问日常问题：调后端检索；后端不可达就按基线转渠道
function askDaily(q) {
  q = (q || '').trim();
  if (!q) return;
  dailyLoading = true;
  dailyRes = null;
  screen = 'dailyAnswer';
  render();

  function fail() {
    dailyLoading = false;
    // 区分「连不上」和「查不到」：连不上时明确告诉用户，别让人以为是没这个知识
    dailyRes = {
      answer: null,
      fallback: 'channel',
      reason: '连不上知识库（后端没开或端口不对），先打电话问',
      channels: [{ name: '12345 政务热线', tel: '12345' }]
    };
    render();
  }

  if (typeof fetch !== 'function') { fail(); return; }
  fetch(DAILY_API + '/ask?q=' + encodeURIComponent(q))
    .then(function (r) { return r.json(); })
    .then(function (json) {
      dailyLoading = false;
      dailyRes = json;
      render();
    })
    .catch(fail);
}

// 读输入框（无浏览器环境返回空串，方便测试）
function inputValue(id) {
  try {
    var el = document.getElementById(id);
    return (el && typeof el.value === 'string') ? el.value : '';
  } catch (e) {
    return '';
  }
}

// 调起系统短信：有号码就带号码，没有先引导去存（docs/07 已知平台差异）
function forward() {
  if (!state.contacts || !state.contacts.length) {
    contactMode = 'send';
    contactHint = '';
    screen = 'contact';
    render();
    return;
  }
  var g = groupAnswers(ITEMS, state.answers, state.needsHelp);
  var href = buildSmsHref(state.contacts[0].tel, buildMessage(g));
  try {
    if (typeof location !== 'undefined') {
      location.href = href;
      return;
    }
  } catch (e) {
    // 落下方兜底
  }
  if (typeof alert === 'function') alert(href);
}

// 删号码：按输入框里的号码删；输入框为空则删最后一个
function delContact() {
  var tel = normalizeTel(inputValue('tel'));
  var list = (state.contacts || []).slice();
  if (tel) {
    list = list.filter(function (c) { return c.tel !== tel; });
  } else if (list.length) {
    list = list.slice(0, list.length - 1);
  }
  state.contacts = list;
  contactHint = '';
  save();
  render();
}

// T11 主动退出：只把「当前这一项」记成待确认，其余未答保持未答
function exitCheck() {
  if (screen !== 'check') return;
  var id = ITEMS[idx].id;
  if (!Object.prototype.hasOwnProperty.call(state.answers, id)) {
    state.answers[id] = 'unsure';
    save();
  }
  undoVisible = false;
  lastAction = null;
  screen = 'home';
  render();
}

// 维护屏退出：回主页，**不写 lastCompletedAt**（这一轮不算完成）
function exitMaint() {
  maintList = [];
  maintIdx = 0;
  undoVisible = false;
  lastAction = null;
  screen = 'home';
  render();
}

// 「先不查了」按屏分派：自查主屏记待确认；维护屏只退出
function exitFlow() {
  if (screen === 'check') { exitCheck(); return; }
  if (screen === 'maint') { exitMaint(); return; }
}

// 存号码：mode=send 存完立即发送；mode=manage 只回主页
function saveContact() {
  var raw = inputValue('tel');
  var tel = normalizeTel(raw);
  if (!tel) {
    contactHint = telHint(raw);
    screen = 'contact';
    render();
    return;
  }
  var name = inputValue('cname') || '家人';
  var list = (state.contacts || []).slice();
  var found = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].tel === tel) { found = i; break; }
  }
  if (found >= 0) {
    list[found] = { name: name, tel: tel };        // 同号＝更新，不新增
  } else {
    if (list.length >= MAX_CONTACTS) {
      contactHint = '最多存 ' + MAX_CONTACTS + ' 个号码，先删一个';
      screen = 'contact';
      render();
      return;
    }
    list.push({ name: name, tel: tel });
  }
  state.contacts = list.slice(0, MAX_CONTACTS);
  contactHint = '';
  save();
  if (contactMode === 'send') {
    forward();
  } else {
    screen = 'home';
    render();
  }
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
  // 提醒三态：现在查 / 稍后 24 小时 / 别再问（可恢复）
  if (t.getAttribute('data-remind-now')) {
    state.remind.snoozedUntil = null;
    restart();
    return;
  }
  if (t.getAttribute('data-remind-snooze')) {
    state.remind.snoozedUntil = new Date(Date.now() + SNOOZE_HOURS * 3600000).toISOString();
    save();
    screen = 'home';
    render();
    return;
  }
  if (t.getAttribute('data-remind-mute')) {
    state.remind.muted = true;
    save();
    screen = 'home';
    render();
    return;
  }
  if (t.getAttribute('data-remind-resume')) {
    state.remind.muted = false;
    state.remind.snoozedUntil = null;
    save();
    screen = 'home';
    render();
    return;
  }

  if (t.getAttribute('data-contacts')) {
    contactMode = 'manage';
    contactHint = '';
    screen = 'contact';
    render();
    return;
  }
  if (t.getAttribute('data-del-contact')) {
    delContact();
    return;
  }
  if (t.getAttribute('data-exit')) {
    exitFlow();
    return;
  }
  if (t.getAttribute('data-maint')) {
    maintPick(t.getAttribute('data-maint'));
    return;
  }
  if (t.getAttribute('data-save-contact')) {
    saveContact();
    return;
  }
  if (t.getAttribute('data-preset')) {
    askDaily(t.getAttribute('data-preset'));
    return;
  }
  if (t.getAttribute('data-daily-again')) {
    dailyRes = null;
    screen = 'daily';
    render();
    return;
  }
  if (t.getAttribute('data-daily')) {
    undoVisible = false;
    dailyRes = null;
    screen = 'daily';
    render();
    return;
  }
  if (t.getAttribute('data-home')) {
    undoVisible = false;
    screen = 'home';
    render();
    return;
  }
  if (t.getAttribute('data-start')) {
    var p = firstUnansweredIndex(ITEMS, state.answers);
    idx = p === -1 ? 0 : p;
    undoVisible = false;
    screen = 'check';
    render();
    return;
  }
  if (t.getAttribute('data-show-list')) {
    screen = 'result';
    render();
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

  // 入口分流：没答完 → 接着答；全部答完 → 到期先提醒，否则主页
  var entry = entryOf(ITEMS, state.answers);
  idx = entry.idx;
  screen = entry.screen;
  if (entry.screen === 'home' && remindInfo(state).show) screen = 'remind';

  if (rootEl) {
    rootEl.addEventListener('click', onClick);
    // 日常输入框回车提交（不多加一个按钮，主操作才守得住 ≤3）
    rootEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'q') askDaily(e.target.value);
    });
  }
  render();
}

if (typeof document !== 'undefined' && document.getElementById) init();
