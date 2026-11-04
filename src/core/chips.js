// core/chips.js —— 顶部常驻区（三模块共用）
// 依据 docs/01-需求基线.md §2 计数口径：辅助入口不计入主操作，最多 2 个
var Render = typeof Render === 'object' && Render ? Render : {};

Render.chips = function (opts) {
  var left = opts.emergency
    ? '<button class="chip" data-emergency="1">我现在有急事</button>'
    : '<span></span>';
  var right = '';
  if (opts.undo) right += '<button class="chip" data-undo="1">撤销</button>';
  if (opts.back) right += '<button class="chip" data-back="1">返回</button>';
  if (!right) right = '<span></span>';
  return '<div class="top-chips">' + left + right + '</div>';
};
