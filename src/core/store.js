// core/store.js —— 存储与状态形状（三模块共用）
// 契约：docs/02-数据契约.md §2 答案结构、§5 持久化、§7 补充规则

var STORAGE_KEY = 'ep-v1';

function emptyState() {
  return { answers: {}, needsHelp: [], lastCompletedAt: null };
}

// 结构校验：解析成功但形状不对也要归一，否则 needsHelp 非数组会让 indexOf 抛错
function loadState(raw) {
  if (!raw) return emptyState();
  try {
    var s = JSON.parse(raw);
    var src = (s && typeof s === 'object' && s.answers && typeof s.answers === 'object') ? s.answers : {};
    var clean = {};
    Object.keys(src).forEach(function (k) {
      var v = src[k];
      if (v === 'yes' || v === 'no' || v === 'unsure') clean[k] = v;
    });
    var help = (s && Array.isArray(s.needsHelp)) ? s.needsHelp.filter(function (x) { return typeof x === 'string'; }) : [];
    return {
      answers: clean,
      needsHelp: help,
      lastCompletedAt: (s && typeof s.lastCompletedAt === 'string') ? s.lastCompletedAt : null
    };
  } catch (e) {
    return emptyState();
  }
}
