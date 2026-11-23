/**
 * 开发模式启动器：同时跑 vite（前端热更新）和后端服务。
 * 用法：npm run dev:all
 * 打开终端里打印的 vite 地址（通常是 http://localhost:5173 ）即可，
 * 页面里的 /api 请求会被 vite 代理到 127.0.0.1:5178。
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

const children = []

function launch(label, args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  child.on('exit', (code) => {
    console.log(`[${label}] 退出，code=${code}`)
    shutdown()
  })
  children.push(child)
  return child
}

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 200)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const viteBin = require.resolve('vite/bin/vite.js')
launch('vite', [viteBin])
launch('server', [path.join(ROOT, 'server', 'index.mjs')], { NO_OPEN: '1' })
