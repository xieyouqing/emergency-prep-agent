// core/store.js —— 存储与状态形状（三模块共用）
// 契约：docs/02-数据契约.md §2 答案结构、§5 持久化、§7 补充规则

var STORAGE_KEY = 'ep-v1';
var REMIND_DAYS = 90;      // 距上次完成多久提醒（docs/01 §2 触发时机）
var SNOOZE_HOURS = 24;     // 「稍后」冷却
var MAX_CONTACTS = 3;      // 家人号码上限（docs/02 §4.5）

function emptyState() {
  return {
    answers: {},
    needsHelp: [],
    lastCompletedAt: null,
    remind: { snoozedUntil: null, muted: false },
    contacts: []          // 家人手机号：[{name, tel}]，最多 3 个，只存本机
  };
}

// 号码归一与校验：手机号 11 位（1[3-9] 开头）或固话 5–20 位数字
function isMobileTel(tel) {
  return /^1[3-9]\d{9}$/.test(String(tel || ''));
}

function normalizeTel(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (isMobileTel(digits)) return digits;
  return (digits.length >= 5 && digits.length <= 20) ? digits : '';
}

// 给用户看的提示：空 / 手机号格式 / 太短
function telHint(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '先填一个号码';
  if (digits.length === 11 && !isMobileTel(digits)) return '手机号要以 1 开头、第二位 3–9';
  if (digits.length > 1 && digits.length < 5) return '号码太短，再核一下';
  if (digits.length > 20) return '号码太长，再核一下';
  return '';
}

// 拼接短信链接：号码 + 正文（platform 差异见 docs/07 已知问题）
function buildSmsHref(tel, body) {
  var t = normalizeTel(tel);
  return 'sms:' + t + '?body=' + encodeURIComponent(body);
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
    var r = (s && s.remind && typeof s.remind === 'object') ? s.remind : {};
    var rawContacts = (s && Array.isArray(s.contacts)) ? s.contacts : [];
    var contacts = [];
    rawContacts.forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      var tel = normalizeTel(c.tel);
      if (!tel) return;
      contacts.push({ name: (typeof c.name === 'string' && c.name) ? c.name : '家人', tel: tel });
    });
    return {
      answers: clean,
      needsHelp: help,
      lastCompletedAt: (s && typeof s.lastCompletedAt === 'string') ? s.lastCompletedAt : null,
      remind: {
        snoozedUntil: (typeof r.snoozedUntil === 'string') ? r.snoozedUntil : null,
        muted: r.muted === true
      },
      contacts: contacts.slice(0, MAX_CONTACTS)
    };
  } catch (e) {
    return emptyState();
  }
}

// 该不该提醒（纯函数，方便测）
// 只有「查过一轮」才提醒；没查过的直接进自查，不打扰（docs/01 §2 + 入口分流）
function remindInfo(state, now) {
  var t = typeof now === 'number' ? now : Date.now();
  var r = state.remind || {};

  if (r.muted) return { show: false, days: null, muted: true };
  if (!state.lastCompletedAt) return { show: false, days: null, muted: false };

  if (r.snoozedUntil && t < Date.parse(r.snoozedUntil)) {
    return { show: false, days: null, muted: false, snoozed: true };
  }

  var days = Math.floor((t - Date.parse(state.lastCompletedAt)) / 86400000);
  return { show: days >= REMIND_DAYS, days: days, muted: false };
}
