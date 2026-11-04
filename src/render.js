// 渲染层：只把数据变成 HTML 字符串，不碰状态、不绑事件。
// 依据 docs/02-数据契约.md §4；主操作按钮 ≤3、辅助入口 ≤2（docs/01-需求基线.md §2）
var Render = {
  check: function (item, index, total) {
    return '' +
      '<section class="screen">' +
      '  <p class="progress">第 ' + (index + 1) + ' / ' + total + ' 项</p>' +
      '  <h1 class="item-name">' + item.name + '</h1>' +
      '  <p class="hint">怎么算有：' + item.check + '</p>' +
      '  <p class="hint-sub">符合上面这句，才点「有」</p>' +
      '  <div class="actions">' +
      '    <button class="btn" data-answer="yes">有</button>' +
      '    <button class="btn" data-answer="no">没有</button>' +
      '    <button class="btn btn-ghost" data-answer="unsure">不确定</button>' +
      '  </div>' +
      '</section>';
  },

  // 分支页：三条去向都是主操作（≤3），「返回」走辅助入口（contract §3 / §6 验收 4）
  // 这里回答的是「判断不了怎么办」，不再重复主屏的判据（避免同一句话出现两次）。
  // howto 预留：有内容时显示操作指引（怎么摇、在哪看），没有时给兜底说明。
  unsure: function (item, index, total) {
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
  },

  // 辅助入口：不计入主操作数量（任务说明 §2 计数口径）
  chips: function (opts) {
    var html = '<div class="top-chips">';
    html += opts.back
      ? '<button class="chip" data-back="1">返回</button>'
      : '<span></span>';
    html += '<span></span></div>';
    return html;
  },

  result: function (groups, next) {
    return '' +
      '<section class="screen">' +
      '  <p class="progress">本家庭适用清单</p>' +
      '  <div class="scroll">' +
      '    <h2 class="group-title">已有 · ' + groups.has.length + ' 项</h2>' + this.list(groups.has) +
      '    <h2 class="group-title">待采购 · ' + groups.buy.length + ' 项</h2>' + this.list(groups.buy) +
      '    <h2 class="group-title">待确认 / 找人帮 · ' + groups.verify.length + ' 项</h2>' + this.list(groups.verify) +
      '    <h2 class="group-title">下一步只做一件</h2>' +
      '    <p class="next-one">' + nextText(next) + '</p>' +
      '  </div>' +
      '  <div class="actions">' +
      '    <button class="btn btn-ghost" data-restart="1">再查一遍</button>' +
      '  </div>' +
      '</section>';
  },

  list: function (items) {
    if (!items.length) return '<p class="empty">无</p>';
    var html = '<ul class="list">';
    for (var i = 0; i < items.length; i++) {
      // 结果页每条带判据：家人复核时能看到「说有」到底按什么标准
      html += '<li>' + items[i].name + '<span class="li-check">' + items[i].check + '</span></li>';
    }
    return html + '</ul>';
  },

  error: function (msg) {
    return '' +
      '<section class="screen">' +
      '  <p class="progress">暂时打不开</p>' +
      '  <h1 class="item-name">' + msg + '</h1>' +
      '  <p class="hint">稍后重新打开即可，不会影响你已经答过的内容。</p>' +
      '</section>';
  }
};
