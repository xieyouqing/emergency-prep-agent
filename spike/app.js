// spike：纯静态、零构建。只验证一件事——这套代码你改不改得动。
// 条目池先用任务说明 §3「必配最低集」5 项占位，正式版换成省级清单 14 项。

var ITEMS = [
  { id: 'torch', name: '手电（可手摇充电）', check: '按一下开关能亮；摇 30 秒还能亮' },
  { id: 'whistle', name: '救生哨', check: '吹一下有响声，挂在门口或床头' },
  { id: 'water', name: '饮用水与压缩饼干', check: '够全家喝 3 天，看包装日期' },
  { id: 'towel', name: '毛巾 / 纸巾', check: '在洗手间和玄关各有一份' },
  { id: 'firstaid', name: '创可贴 + 纱布 + 碘伏棉棒', check: '打开药箱，三样都在且没过期' }
];

var STORAGE_KEY = 'ep-spike-answers';

var answers = (function () {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
})();

var index = 0;
var root = document.getElementById('root');

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch (e) {
    // file:// 或隐私模式下可能写不进去，演示不受影响
  }
}

function renderCheck() {
  var item = ITEMS[index];
  root.innerHTML =
    '<section class="screen">' +
    '  <p class="progress">第 ' + (index + 1) + ' / ' + ITEMS.length + ' 项</p>' +
    '  <h1 class="item-name">' + item.name + '</h1>' +
    '  <div class="actions">' +
    '    <button class="btn" data-answer="yes">有</button>' +
    '    <button class="btn" data-answer="no">没有</button>' +
    '    <button class="btn btn-ghost" data-answer="unsure">不确定</button>' +
    '  </div>' +
    '</section>';
}

function renderUnsure() {
  var item = ITEMS[index];
  root.innerHTML =
    '<section class="screen">' +
    '  <p class="progress">不确定 · 三选一</p>' +
    '  <h1 class="item-name">' + item.name + '</h1>' +
    '  <p class="hint">照着做一遍，10 秒：' + item.check + '</p>' +
    '  <div class="actions">' +
    '    <button class="btn" data-unsure="yes">看到了，有</button>' +
    '    <button class="btn" data-unsure="no">确认没有</button>' +
    '    <button class="btn btn-ghost" data-unsure="help">看不了，找人帮</button>' +
    '  </div>' +
    '</section>';
}

function group() {
  var has = [];
  var verify = [];
  var buy = [];
  for (var i = 0; i < ITEMS.length; i++) {
    var it = ITEMS[i];
    var a = answers[it.id];
    if (a === 'yes') has.push(it);
    else if (a === 'no') buy.push(it);
    else if (a === 'unsure') verify.push(it);
  }
  return { has: has, verify: verify, buy: buy };
}

function listHtml(items) {
  if (!items.length) return '<p class="empty">无</p>';
  var html = '<ul class="list">';
  for (var i = 0; i < items.length; i++) html += '<li>' + items[i].name + '</li>';
  return html + '</ul>';
}

function renderResult() {
  var g = group();
  // 「不确定」不等于「确认没有」：不能直接进待采购（任务说明 §2）
  var next = g.buy.length
    ? { kind: 'buy', item: g.buy[0] }
    : g.verify.length
      ? { kind: 'verify', item: g.verify[0] }
      : null;

  var nextText = next
    ? (next.kind === 'buy'
        ? '今天把「' + next.item.name + '」配上'
        : '先确认「' + next.item.name + '」有没有：' + next.item.check)
    : '都配齐了，半年后再看一遍';

  root.innerHTML =
    '<section class="screen">' +
    '  <p class="progress">本家庭适用清单</p>' +
    '  <div class="scroll">' +
    '    <h2 class="group-title">已有 · ' + g.has.length + ' 项</h2>' + listHtml(g.has) +
    '    <h2 class="group-title">待采购 · ' + g.buy.length + ' 项</h2>' + listHtml(g.buy) +
    '    <h2 class="group-title">待确认 / 找人帮 · ' + g.verify.length + ' 项</h2>' + listHtml(g.verify) +
    '    <h2 class="group-title">下一步只做一件</h2>' +
    '    <p class="next-one">' + nextText + '</p>' +
    '  </div>' +
    '  <div class="actions">' +
    '    <button class="btn btn-ghost" data-restart="1">再查一遍</button>' +
    '  </div>' +
    '</section>';
}

function advance() {
  index = index + 1;
  if (index >= ITEMS.length) renderResult();
  else renderCheck();
}

root.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'BUTTON') return;

  if (t.dataset.answer) {
    answers[ITEMS[index].id] = t.dataset.answer;
    save();
    if (t.dataset.answer === 'unsure') renderUnsure();
    else advance();
    return;
  }

  if (t.dataset.unsure) {
    var v = t.dataset.unsure;
    answers[ITEMS[index].id] = v === 'help' ? 'unsure' : v;
    save();
    advance();
    return;
  }

  if (t.dataset.restart) {
    answers = {};
    save();
    index = 0;
    renderCheck();
  }
});

renderCheck();
