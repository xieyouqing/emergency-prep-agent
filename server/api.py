#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日常问答后端：零依赖（Python 标准库），只做检索 + 来源返回。

依据 docs/05-知识库设计.md：
- 只收 official / consensus / cross-checked（seed.json 里已按门槛筛过）
- 检索不到 -> 转渠道，不给「大概」答案
- 每条答案必带来源（名称 / 链接 / 获取日 / 等级）
- 用药 / 剂量类不问不答，直接转渠道

启动：python server/api.py [端口]   默认 8001
接口：
  GET /health          -> {"ok":true,"snippets":N}
  GET /ask?q=饮水      -> {"query","answer","sources":[...],"fallback":null}
  GET /ask?q=吃药      -> {"answer":null,"fallback":"channel","channels":[...]}
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(HERE, 'seed.json')

# 用药 / 剂量 / 医疗判断：不问不答，直接转渠道（基线 §5）
REFUSE_WORDS = ['用药', '药量', '剂量', '吃什么药', '吃多少', '止血带', '打针', '输液']

# 口语别名：老人不会说「救生哨」，会说「哨子」。命中即改写查询（只对短问句生效）
ALIASES = {
    '水': '饮用水', '喝的水': '饮用水', '饮水': '饮用水',
    '哨子': '救生哨', '哨': '救生哨', '吹哨': '救生哨',
    '手电筒': '手电', '电筒': '手电',
    '药': '医药品', '药箱': '医用材料', '创可贴': '医用材料', '口罩': '医用材料',
    '绳子': '逃生绳', '绳': '逃生绳',
    '灭火': '灭火器', '灭火器': '灭火器',
    '面罩': '呼吸面罩', '防烟面罩': '呼吸面罩',
    '饼干': '饼干', '吃的': '饼干', '食物': '饼干',
    '帐篷': '帐篷', '剪刀': '剪刀', '收音机': '手电',
}

CHANNELS = [
    {'name': '12345 政务热线', 'tel': '12345'},
    {'name': '社区 / 网格员', 'tel': None},
    {'name': '应急管理部官网', 'url': 'https://www.mem.gov.cn/'}
]


def load_snippets():
    with open(SEED, 'r', encoding='utf-8') as f:
        return json.load(f)['snippets']


SNIPPETS = load_snippets()

# 条目名（与 src/check/data.js 对应）。TODO：单一来源化——改为启动时从 data.js 读取或抽成共用 json
ITEM_NAMES = {
    'torch': '具备收音功能的手摇充电电筒',
    'mask': '呼吸面罩 消防过滤式自救呼吸器',
    'lifejacket': '救生衣 救生圈',
    'whistle': '救生哨',
    'towel': '毛巾 纸巾 湿纸巾',
    'light': '防水火柴 打火机 蜡烛 充电式应急灯',
    'food': '饼干 压缩饼干 干脆面 罐头 饮用水',
    'tent': '家庭小帐篷 防潮垫',
    'scissors': '多功能组合剪刀',
    'rope': '应急逃生绳',
    'extinguisher': '灭火器 防火毯',
    'medicine': '常用医药品',
    'firstaid': '医用材料 口罩 创可贴 纱布绷带 碘伏棉棒',
    'docs': '应急避灾自救资料',
}


def bigrams(text):
    """中文按二字切片；英文/数字整体保留。用于零依赖的粗检索。"""
    out = set()
    buf = ''
    for ch in text:
        if '\u4e00' <= ch <= '\u9fff':
            if buf:
                out.add(buf.lower()); buf = ''
            out.add(ch)
        elif ch.isalnum():
            buf += ch
        else:
            if buf:
                out.add(buf.lower()); buf = ''
    if buf:
        out.add(buf.lower())
    # 相邻汉字组成二元组，提升相关性
    zh = [c for c in text if '\u4e00' <= c <= '\u9fff']
    for i in range(len(zh) - 1):
        out.add(zh[i] + zh[i + 1])
    return out


def bigram_only(text):
    """只要相邻二字组合，用于相关性打分（单字噪声太大）。"""
    zh = [c for c in text if '\u4e00' <= c <= '\u9fff']
    return set(zh[i] + zh[i + 1] for i in range(len(zh) - 1))


# 问句填充词：不参与检索，否则「怎么挑」「要备多少」会把相关性拉低
STOPWORDS = [
    '请问', '问一下', '想问', '怎么', '如何', '怎样', '哪些', '什么',
    '需要', '应该', '要不要', '要备', '备多少', '多少', '有没有', '是不是',
    '的话', '可以', '能不能', '呢', '吗', '啊', '呀', '吧', '要', '该',
]


def clean_query(q):
    q = q.strip()
    for w in STOPWORDS:
        q = q.replace(w, '')
    return q.strip()


def search(q, top=3):
    """打分：条目名 3 / 正文 2 / 每个命中二元组 2；去掉填充词后 >=2 即视为命中。"""
    q = clean_query(q)
    if not q:
        return []
    grams = bigram_only(q)
    scored = []
    for s in SNIPPETS:
        name = ITEM_NAMES.get(s.get('item_id') or '', '')
        hay = name + ' ' + s['text'] + ' ' + s.get('source_name', '')
        score = 0
        if q in name:
            score += 3
        if q in hay:
            score += 2
        score += 2 * sum(1 for g in grams if g in hay)
        if score >= 2:
            scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:top]]


def qs_hay(s):
    return (s.get('source_name', '') + ' ' + ' '.join(s.get('scope') or []))


def handle_ask(q):
    raw = (q or '').strip()
    # 拒答判断必须在清理之前：清理会删掉「什么」这类词，导致「吃什么药」漏判
    if any(w in raw for w in REFUSE_WORDS):
        return {'query': raw, 'answer': None, 'sources': [], 'fallback': 'channel',
                'reason': '涉及用药或医疗判断，按基线 §5 转渠道', 'channels': CHANNELS}

    q = raw
    if q in ALIASES:
        q = ALIASES[q]
    q = clean_query(q)
    if not q:
        return {'query': raw, 'answer': None, 'sources': [], 'fallback': 'channel', 'channels': CHANNELS}
    hits = search(q)
    if not hits:
        return {'query': q, 'answer': None, 'sources': [], 'fallback': 'channel', 'channels': CHANNELS}
    sources = [{
        'name': s['source_name'],
        'url': s['source_url'],
        'fetch_date': s['fetch_date'],
        'level': s['level']
    } for s in hits]
    distinct = []
    for s in sources:
        if s not in distinct:
            distinct.append(s)
    return {
        'query': q,
        'answer': hits[0]['text'],
        'also': [h['text'] for h in hits[1:]],
        'sources': distinct,
        'fallback': None
    }


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/health':
            self._json(200, {'ok': True, 'snippets': len(SNIPPETS)})
            return
        if u.path == '/ask':
            q = (parse_qs(u.query).get('q') or [''])[0]
            self._json(200, handle_ask(unquote(q)))
            return
        self._json(404, {'error': 'not found'})

    def log_message(self, fmt, *args):
        sys.stderr.write('[api] ' + fmt % args + '\n')


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    print('api: http://127.0.0.1:%d/  (snippets=%d)' % (port, len(SNIPPETS)))
    # 绑 0.0.0.0：兼容 localhost / 127.0.0.1 两种访问（IPv4）
    HTTPServer(('0.0.0.0', port), Handler).serve_forever()


if __name__ == '__main__':
    main()
