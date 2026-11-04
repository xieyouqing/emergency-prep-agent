// check/logic.js —— 自检模块的纯逻辑（不碰 DOM，可在 node 里直接测）
// 依据 docs/02-数据契约.md §3 分支去向、§4 分组与下一步优先级

function groupAnswers(items, answers, needsHelp) {
  var has = [];
  var buy = [];
  var help = [];
  var verify = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var a = answers[it.id];
    // 关键：unsure 不等于 no；只有 no 进待采购（契约 §2）
    if (a === 'yes') has.push(it);
    else if (a === 'no') buy.push(it);
    else if (a === 'unsure' && needsHelp.indexOf(it.id) >= 0) help.push(it); // 已决定找人帮，不再让他自己先确认
    else if (a === 'unsure') verify.push(it);
  }
  return { has: has, buy: buy, help: help, verify: verify };
}

// 下一步优先级：待采购 → 找人帮 → 待确认 → 配齐（契约 §4）
function nextOf(groups) {
  if (groups.buy.length) return { kind: 'buy', item: groups.buy[0] };
  if (groups.help.length) return { kind: 'help', item: groups.help[0] };
  if (groups.verify.length) return { kind: 'verify', item: groups.verify[0] };
  return null;
}

function nextText(next) {
  if (!next) return '都配齐了，半年后再看一遍';
  if (next.kind === 'buy') return '今天把「' + next.item.name + '」配上';
  if (next.kind === 'help') return '发消息请家人帮你看「' + next.item.name + '」';
  return '先确认「' + next.item.name + '」有没有：' + next.item.check;
}

function firstUnansweredIndex(items, answers) {
  for (var i = 0; i < items.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(answers, items[i].id)) return i;
  }
  return -1;
}

// 代办消息：三类内容都带上（docs/03 T7 验收 #5）
function buildMessage(groups) {
  var names = function (list) {
    return list.map(function (it) { return it.name; }).join('、');
  };
  var lines = [];
  if (groups.buy.length) lines.push('要买：' + names(groups.buy));
  if (groups.help.length) lines.push('请帮忙看看：' + names(groups.help));
  if (groups.verify.length) lines.push('还没确认：' + names(groups.verify));
  return '家里应急自查结果\n' + (lines.length ? lines.join('\n') : '已经配齐了');
}
