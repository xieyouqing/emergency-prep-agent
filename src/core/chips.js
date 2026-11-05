// core/chips.js —— 顶部常驻区（三模块共用）
// 依据 docs/01-需求基线.md §2 计数口径：辅助入口不计入主操作，最多 2 个
// 两个 chip 放同一边（右上，拇指区），不再一左一右。
// 优先级：撤销 > 返回 > 问个事——临时出现的撤销不会把个数顶到 3。
var Render = typeof Render === 'object' && Render ? Render : {};

Render.chips = function (opts) {
  var chips = [];
  if (opts.emergency) chips.push('<button class="chip" data-emergency="1">我现在有急事</button>');
  if (opts.undo) chips.push('<button class="chip" data-undo="1">撤销</button>');
  else if (opts.back) chips.push('<button class="chip" data-back="1">返回</button>');
  else if (opts.exit) chips.push('<button class="chip" data-exit="1">先不查了</button>');
  else if (opts.daily) chips.push('<button class="chip" data-daily="1">问个事</button>');
  return '<div class="top-chips">' + chips.join('') + '</div>';
};
