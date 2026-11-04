// emergency/render.js —— 紧急模块：零数据依赖，号码写死
// 依据 docs/01-需求基线.md §2 三层降级、§5 不给有分歧的指令
// tel: 只调起系统拨号盘并预填，由用户按拨号键——系统拨号器本身即防误触
var Render = typeof Render === 'object' && Render ? Render : {};

Render.emergency = function () {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">现在有急事</p>' +
    '  <h1 class="item-name">按情况直接拨号，不用等自查做完</h1>' +
    '  <p class="hint">火警、燃气、冒烟：打 119</p>' +
    '  <p class="hint">有人受伤、晕倒、出血不止：打 120</p>' +
    '  <div class="actions">' +
    '    <a class="btn" href="tel:119">打 119（火警）</a>' +
    '    <a class="btn" href="tel:120">打 120（急救）</a>' +
    '    <button class="btn btn-ghost" data-back="1">回到自查</button>' +
    '  </div>' +
    '</section>';
};
