// daily/render.js —— 日常问答模块（对话优先的产品入口）
// 依据 docs/01 §2（日常＝在线检索，失败转渠道）、docs/05（答案必带来源）
var Render = typeof Render === 'object' && Render ? Render : {};

// 问句屏：3 个预设（主操作 ≤3），输入框靠回车提交，不再多一个按钮
Render.dailyAsk = function () {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">问个事</p>' +
    '  <h1 class="item-name">想问什么？</h1>' +
    '  <p class="hint">点一个常见问题，或者在下面打字问。</p>' +
    '  <input id="q" class="ask-input" type="text" placeholder="打字问，按回车" />' +
    '  <div class="actions">' +
    '    <button class="btn" data-preset="饮用水要备多少">水和吃的</button>' +
    '    <button class="btn" data-preset="手电怎么挑">照明和火</button>' +
    '    <button class="btn btn-ghost" data-preset="家里该备哪些药">急救和药</button>' +
    '  </div>' +
    '</section>';
};

// 答案屏：答案 + 来源（名称/等级/获取日）+ 两个操作
Render.dailyAnswer = function (res) {
  var src = (res.sources || []).map(function (s) {
    return '<li>' + s.name + '<span class="li-check">等级：' + s.level + ' · 获取日：' + s.fetch_date + '</span></li>';
  }).join('');
  return '' +
    '<section class="screen">' +
    '  <p class="progress">问个事</p>' +
    '  <h1 class="item-name">' + (res.answer || '') + '</h1>' +
    '  <div class="scroll">' +
    '    <h2 class="group-title">来源</h2>' +
    '    <ul class="list">' + src + '</ul>' +
    '  </div>' +
    '  <div class="actions">' +
    '    <button class="btn" data-daily-again="1">再问一个</button>' +
    '    <button class="btn btn-ghost" data-home="1">回到主页</button>' +
    '  </div>' +
    '</section>';
};

// 查不到 / 拒答：按基线 §5、§2 转渠道，不给「大概」答案
Render.dailyFallback = function (res) {
  var chans = (res.channels || []).map(function (c) {
    if (c.tel) return '<a class="btn" href="tel:' + c.tel + '">打 ' + c.tel + '（' + c.name + '）</a>';
    return '';
  }).join('');
  var why = res.reason ? '<p class="hint-sub warn">' + res.reason + '</p>' : '';
  return '' +
    '<section class="screen">' +
    '  <p class="progress">问个事</p>' +
    '  <h1 class="item-name">这个问题我答不了</h1>' +
    '  <p class="hint">可以打下面这些电话问，或者问家人、社区。</p>' +
    why +
    '  <div class="actions">' +
    chans +
    '    <button class="btn btn-ghost" data-daily-again="1">换个问题</button>' +
    '  </div>' +
    '</section>';
};
