/** 一些格式化小工具 */

/** 字节数 → 人类可读（1.23 MB 这种） */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 时间戳 → HH:mm:ss */
export function formatClock(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 时间戳 → YYYY-MM-DD HH:mm */
export function formatDateTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 把 Windows 路径的最后一个片段取出来 */
export function baseName(p: string): string {
  if (!p) return ''
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || p
}

/** 统一成反斜杠、去掉结尾多余的斜杠（前端没有 node 的 path 模块，路径操作都是手写的） */
export function normWinPath(value: string): string {
  return (value || '').replace(/\//g, '\\').replace(/\\{2,}/g, '\\').replace(/\\+$/, '')
}

/** 拼 Windows 路径：base 后面接 sub（两边多余的斜杠会处理掉） */
export function joinWin(base: string, sub: string): string {
  if (!base) return sub
  const left = normWinPath(base)
  const right = (sub || '').replace(/^[\\/]+/, '')
  if (!left) return right
  if (!right) return left
  return `${left}\\${right}`
}

/** full 在 base 之下时返回相对路径，否则返回 null（Windows 路径不区分大小写） */
export function relativeUnder(base: string, full: string): string | null {
  const b = normWinPath(base)
  const f = normWinPath(full)
  if (!b) return null
  const lowerB = b.toLowerCase()
  const lowerF = f.toLowerCase()
  if (lowerF === lowerB) return ''
  if (!lowerF.startsWith(`${lowerB}\\`)) return null
  return f.slice(b.length + 1)
}

/** 取相对路径里的目录部分（没有目录就返回空串） */
export function dirNameOf(rel: string): string {
  const index = rel.lastIndexOf('\\')
  return index < 0 ? '' : rel.slice(0, index)
}

/** 生成一个足够用的本地 id */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 深拷贝（配置对象都是纯数据，用这个够了） */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
