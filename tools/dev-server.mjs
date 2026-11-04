// 开发服务器：零依赖，静态托管 src/，文件变了自动刷新浏览器。
// 用法：node tools/dev-server.mjs [端口]    默认 8000
// 生产不受影响：直接双击 src/index.html 仍然可用（没有自动刷新而已）。
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { watch } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const PORT = Number(process.argv[2] || 8000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const RELOAD_CLIENT = `<script>
  (function () {
    try {
      var es = new EventSource('/__reload')
      es.onmessage = function () { location.reload() }
    } catch (e) { /* 老浏览器忽略 */ }
  })()
</script>`

const clients = new Set()

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])

  if (url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write('retry: 1000\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('403')
    return
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 没这个文件')
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'

  if (ext === '.html') {
    // 注入自动刷新脚本，只对开发服务器提供的页面生效
    let html = ''
    const stream = createReadStream(filePath, { encoding: 'utf8' })
    stream.on('data', (chunk) => { html += chunk })
    stream.on('end', () => {
      html = html.replace('</body>', RELOAD_CLIENT + '</body>')
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
      res.end(html)
    })
    stream.on('error', () => res.writeHead(500).end('500'))
    return
  }

  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  createReadStream(filePath).pipe(res)
})

watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename || filename.endsWith('.tmp') || filename.includes('.tmpdir')) return
  console.log(`[reload] ${filename}`)
  for (const res of clients) res.write('data: reload\n\n')
})

server.listen(PORT, () => {
  console.log(`dev server: http://localhost:${PORT}/  (监听 ${ROOT})`)
})
