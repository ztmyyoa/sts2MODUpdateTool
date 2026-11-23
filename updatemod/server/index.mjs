/**
 * 本地后端服务
 * ------------------------------------------------------------------
 * 前端是 Vue（vite），真正的文件复制 / 执行 .bat 都在这里做，因为浏览器做不到。
 *
 * 启动方式：
 *   npm run app        # 先 build 前端，再启动本服务并自动打开浏览器
 *   npm run dev:all    # 开发模式：vite + 本服务同时启动（前端热更新）
 *
 * 接口一览：
 *   GET  /api/health                 健康检查
 *   GET  /api/config                 读配置
 *   PUT  /api/config                 存配置
 *   GET  /api/fs?path=               列目录（path 为空时列出所有盘符）
 *   GET  /api/scan-pck?dir=&depth=   递归找 .pck
 *   GET  /api/json?path=             读 JSON 文本
 *   PUT  /api/json                   校验并写 JSON
 *   POST /api/reveal                 在资源管理器里打开
 *   POST /api/update                 SSE 流式执行更新
 */
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises'
import { ROOT, CONFIG_FILE, loadConfig, saveConfig } from './config.mjs'
import { runUpdate } from './update-runner.mjs'
import { serveStatic, serveIndex } from './static.mjs'

const DIST = path.join(ROOT, 'dist')
const DEFAULT_PORT = Number(process.env.PORT) || 5178

/** 读取并解析请求体（限 8MB，防止误传大文件把内存撑爆） */
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  const body = Buffer.from(JSON.stringify(data), 'utf8')
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

async function listDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    let size = 0
    let mtimeMs = 0
    try {
      const info = await stat(full)
      size = info.size
      mtimeMs = info.mtimeMs
    } catch {
      /* 权限不足等，忽略 */
    }
    out.push({ name: entry.name, path: full, isDir: entry.isDirectory(), size, mtimeMs })
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name, 'zh-CN') : a.isDir ? -1 : 1))
  return out
}

async function scanPck(dir, depth, out) {
  if (depth < 0) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await scanPck(full, depth - 1, out)
    } else if (/\.pck$/i.test(entry.name)) {
      try {
        const info = await stat(full)
        out.push({ path: full, name: entry.name, size: info.size, mtimeMs: info.mtimeMs })
      } catch {
        /* ignore */
      }
    }
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url

  // ---------- 健康检查 ----------
  if (req.method === 'GET' && pathname === '/api/health') {
    const distReady = await stat(path.join(DIST, 'index.html')).then((s) => s.isFile()).catch(() => false)
    sendJson(res, 200, {
      ok: true,
      platform: process.platform,
      node: process.version,
      projectRoot: ROOT,
      configFile: CONFIG_FILE,
      distReady,
    })
    return true
  }

  // ---------- 配置 ----------
  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, await loadConfig())
    return true
  }
  if (pathname === '/api/config' && req.method === 'PUT') {
    const raw = await readBody(req)
    const parsed = JSON.parse(raw || '{}')
    sendJson(res, 200, await saveConfig(parsed))
    return true
  }

  // ---------- 目录浏览 / 扫描 ----------
  if (pathname === '/api/fs' && req.method === 'GET') {
    const target = url.searchParams.get('path') || ''
    // 没给路径 = 回到“我的电脑”这一层，列出所有可用盘符
    if (!target) {
      const entries = []
      for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        const drive = `${letter}:\\`
        try {
          const info = await stat(drive)
          if (info.isDirectory()) {
            entries.push({ name: `${letter}:`, path: drive, isDir: true, size: 0, mtimeMs: 0 })
          }
        } catch {
          /* 盘符不存在 */
        }
      }
      sendJson(res, 200, { path: '', parent: '', exists: true, isDir: true, entries })
      return true
    }
    try {
      const info = await stat(target)
      if (!info.isDirectory()) {
        sendJson(res, 200, { path: target, parent: path.dirname(target), exists: true, isDir: false })
        return true
      }
      const parent = path.dirname(target)
      sendJson(res, 200, {
        path: target,
        parent: parent === target ? '' : parent,
        exists: true,
        isDir: true,
        entries: await listDir(target),
      })
    } catch (err) {
      sendJson(res, 200, { path: target, parent: path.dirname(target), exists: false, isDir: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/scan-pck' && req.method === 'GET') {
    const dir = url.searchParams.get('dir') || ''
    const depth = Math.max(0, Math.min(6, Number(url.searchParams.get('depth') ?? 1)))
    if (!dir) {
      sendError(res, 400, '缺少 dir 参数')
      return true
    }
    const out = []
    await scanPck(dir, depth, out)
    out.sort((a, b) => b.mtimeMs - a.mtimeMs)
    sendJson(res, 200, { dir, depth, files: out })
    return true
  }

  // ---------- JSON 读写 ----------
  if (pathname === '/api/json' && req.method === 'GET') {
    const target = url.searchParams.get('path') || ''
    if (!target) {
      sendError(res, 400, '缺少 path 参数')
      return true
    }
    try {
      const content = await readFile(target, 'utf8')
      sendJson(res, 200, { path: target, exists: true, content })
    } catch (err) {
      sendJson(res, 200, { path: target, exists: false, content: '', error: err.message })
    }
    return true
  }

  if (pathname === '/api/json' && req.method === 'PUT') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const target = body.path
    const content = body.content
    if (!target) {
      sendError(res, 400, '缺少 path')
      return true
    }
    if (typeof content !== 'string') {
      sendError(res, 400, '缺少 content')
      return true
    }
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      sendError(res, 400, `JSON 格式有误：${err.message}`)
      return true
    }
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
    sendJson(res, 200, { path: target, saved: true })
    return true
  }

  // ---------- 资源管理器 ----------
  if (pathname === '/api/reveal' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const target = body.path
    if (!target) {
      sendError(res, 400, '缺少 path')
      return true
    }
    try {
      spawn('explorer.exe', [target], { detached: true, windowsHide: false }).unref()
      sendJson(res, 200, { ok: true })
    } catch (err) {
      sendError(res, 500, err.message)
    }
    return true
  }

  // ---------- 更新（SSE 流式日志）----------
  if (pathname === '/api/update' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const config = body.config ? await saveConfig(body.config) : await loadConfig()
    const modIds = Array.isArray(body.modIds) ? body.modIds : []
    const dryRun = body.dryRun === true

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()

    let closed = false
    res.on('close', () => {
      if (!res.writableEnded) closed = true
    })

    const gen = runUpdate({ config, modIds, dryRun })
    try {
      for (;;) {
        const { value, done } = await gen.next()
        if (done) break
        if (closed) {
          await gen.return()
          break
        }
        res.write(`data: ${JSON.stringify(value)}\n\n`)
      }
    } catch (err) {
      if (!closed) res.write(`data: ${JSON.stringify({ ts: Date.now(), level: 'error', scope: '服务端', text: `执行异常：${err.message}` })}\n\n`)
    }
    if (!closed) {
      res.write('event: end\ndata: {}\n\n')
      res.end()
    }
    return true
  }

  return false
}

async function handler(req, res) {
  const url = new URL(req.url || '/', `http://127.0.0.1:${DEFAULT_PORT}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url)
      if (!handled) sendError(res, 404, `未知接口：${url.pathname}`)
      return
    }
    // 静态资源
    if (await serveStatic(DIST, url.pathname, res)) return
    if (await serveIndex(DIST, res)) return
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('前端还没构建：请先运行 npm run build（或直接用 npm run dev:all 开发模式）。')
  } catch (err) {
    if (!res.headersSent) sendError(res, 500, err?.message || String(err))
    else res.end()
  }
}

function openBrowser(url) {
  try {
    spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, windowsHide: true }).unref()
  } catch {
    /* ignore */
  }
}

async function start(port, attempt = 0) {
  const server = http.createServer(handler)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 10) {
      start(port + 1, attempt + 1)
    } else {
      console.error('[server] 启动失败：', err.message)
      process.exitCode = 1
    }
  })
  server.listen(port, '127.0.0.1', async () => {
    const url = `http://127.0.0.1:${port}/`
    const config = await loadConfig().catch(() => null)
    console.log(`\n  MOD 更新工具已启动：${url}`)
    console.log(`  配置文件：${CONFIG_FILE}`)
    console.log(`  按 Ctrl+C 退出\n`)
    if (config?.global?.openBrowser !== false && process.env.NO_OPEN !== '1') openBrowser(url)
  })
}

start(DEFAULT_PORT)
