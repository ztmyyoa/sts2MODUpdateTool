/** 极简静态文件服务：把 vite build 出来的 dist/ 端出去 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

/**
 * 尝试返回静态文件。
 * @returns {Promise<boolean>} 是否已处理（false 表示交给调用方做 404）
 */
export async function serveStatic(rootDir, pathname, res) {
  // 去掉查询串、解码、阻止 ../ 穿越
  const clean = decodeURIComponent(pathname.split('?')[0])
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '')
  const target = path.resolve(rootDir, relative)
  if (!target.toLowerCase().startsWith(path.resolve(rootDir).toLowerCase())) return false

  try {
    const info = await stat(target)
    if (!info.isFile()) return false
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    })
    res.end(body)
    return true
  } catch {
    return false
  }
}

/** 单页应用回退：任何未知路径都返回 index.html */
export async function serveIndex(rootDir, res) {
  try {
    const body = await readFile(path.join(rootDir, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length })
    res.end(body)
    return true
  } catch {
    return false
  }
}
