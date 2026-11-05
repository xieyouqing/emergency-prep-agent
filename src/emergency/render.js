// emergency/render.js —— 紧急模块：零数据依赖，号码写死
// 依据 docs/01-需求基线.md §2 三层降级、§5 不给有分歧的指令
// tel: 只调起系统拨号盘并预填，由用户按拨号键——系统拨号器本身即防误触
var Render = typeof Render === 'object' && Render ? Render : {};

// 紧急页：只做二值判断（着火/被困 → 119，其余 → 120），并给「拿不准」的保底规则。
// 不做医疗判断（基线 §5）；也明说 App 不是最快路径——手机能直接拨号就直接拨。
Render.emergency = function () {
  return '' +
    '<section class="screen">' +
    '  <p class="progress">现在有急事</p>' +
    '  <h1 class="item-name">打哪个？</h1>' +
    '  <p class="hint">着火了、有人被困 → <b>119</b></p>' +
    '  <p class="hint">受伤、晕倒、感觉不对 → <b>120</b></p>' +
    '  <p class="hint-sub warn">拿不准：先打 119，消防能转接</p>' +
    '  <div class="actions">' +
    '    <a class="btn" href="tel:119">打 119（火警 / 被困）</a>' +
    '    <a class="btn" href="tel:120">打 120（急救）</a>' +
    '    <button class="btn btn-ghost" data-back="1">回到自查</button>' +
    '  </div>' +
    '  <p class="hint-sub">手机能直接拨号就直接打，不用开这个。</p>' +
    '</section>';
};
