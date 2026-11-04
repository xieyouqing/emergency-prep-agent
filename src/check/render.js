// check/render.js —— 自检模块的渲染（只出 HTML 字符串，不碰状态）
// 依据 docs/02-数据契约.md §4；主操作按钮 ≤3、辅助入口 ≤2（docs/01-需求基线.md §2）
var Render = typeof Render === 'object' && Render ? Render : {};

Render.check = function (item, index, total) {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">第 ' + (index + 1) + ' / ' + total + ' 项</p>' +
    '  <h1 class="item-name">' + item.name + '</h1>' +
    '  <p class="hint">怎么算有：' + item.check + '</p>' +
    '  <p class="hint-sub">符合上面这句，才点「有」</p>' +
    this.inferredNote(item) +
    '  <div class="actions">' +
    '    <button class="btn" data-answer="yes">有</button>' +
    '    <button class="btn" data-answer="no">没有</button>' +
    '    <button class="btn btn-ghost" data-answer="unsure">不确定</button>' +
    '  </div>' +
    '</section>';
};

// 分支页：三条去向都是主操作（≤3），「返回」走辅助入口（契约 §3 / 验收 4）
// 这里回答「判断不了怎么办」，不重复主屏判据；howto 有内容就显示操作指引
Render.unsure = function (item, index, total) {
  var lead = item.howto
    ? '<p class="hint">' + item.howto + '</p>'
    : '<p class="hint">说不知道也行，我帮你分到该去的地方。</p>';
  return '' +
    '<section class="screen screen-unsure">' +
    '  <p class="progress">第 ' + (index + 1) + ' / ' + total + ' 项 · 不确定</p>' +
    '  <h1 class="item-name">' + item.name + '</h1>' +
    lead +
    '  <div class="actions">' +
    '    <button class="btn" data-pick="yes">看到了，有</button>' +
    '    <button class="btn" data-pick="no">确认没有</button>' +
    '    <button class="btn btn-ghost" data-pick="help">看不了，找人帮</button>' +
    '  </div>' +
    '</section>';
};

Render.result = function (groups, next) {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">本家庭适用清单</p>' +
    // 「下一步」放在滚动区之外：它是核心产出，不能默认藏在折叠线以下
    '  <div class="next-box">' +
    '    <p class="next-label">下一步只做一件</p>' +
    '    <p class="next-one">' + nextText(next) + '</p>' +
    '  </div>' +
    '  <div class="scroll">' +
    '    <h2 class="group-title">已有 · ' + groups.has.length + ' 项</h2>' + this.list(groups.has) +
    '    <h2 class="group-title">待采购 · ' + groups.buy.length + ' 项</h2>' + this.list(groups.buy) +
    '    <h2 class="group-title">找人帮 · ' + groups.help.length + ' 项</h2>' + this.list(groups.help) +
    '    <h2 class="group-title">待确认 · ' + groups.verify.length + ' 项</h2>' + this.list(groups.verify) +
    '  </div>' +
    '  <div class="actions">' +
    (groups.help.length || groups.buy.length || groups.verify.length
      ? '    <button class="btn" data-forward="1">发给家人代办</button>'
      : '') +
    '    <button class="btn btn-ghost" data-restart="1">再查一遍</button>' +
    '  </div>' +
    '</section>';
};

// 判据是推断时，必须让用户知道这不是权威标准（docs/04 §0：inferred 不能当规则）
Render.inferredNote = function (item) {
  return item.checkLevel === 'inferred'
    ? '<p class="hint-sub warn">这条判断标准暂无权威依据，是推断，仅供参考</p>'
    : '';
};

Render.list = function (items) {
  if (!items.length) return '<p class="empty">无</p>';
  var html = '<ul class="list">';
  for (var i = 0; i < items.length; i++) {
    // 结果页每条带判据：家人复核时能看到「说有」到底按什么标准
    var tag = items[i].checkLevel === 'inferred' ? '<span class="li-tag">推断</span>' : '';
    html += '<li>' + items[i].name + tag + '<span class="li-check">' + items[i].check + '</span></li>';
  }
  return html + '</ul>';
};

Render.error = function (msg) {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">暂时打不开</p>' +
    '  <h1 class="item-name">' + msg + '</h1>' +
    '  <p class="hint">稍后重新打开即可，不会影响你已经答过的内容。</p>' +
    '</section>';
};
