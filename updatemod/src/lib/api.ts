/**
 * 和本地后端（server/index.mjs）通信的所有请求都放在这里
 */
import type {
  AppConfig,
  DirListing,
  HealthInfo,
  JsonReadResult,
  LogEvent,
  PckFile,
} from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`服务返回了非 JSON 内容：${text.slice(0, 200)}`)
    }
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `请求失败（HTTP ${res.status}）`
    throw new Error(message)
  }
  return data as T
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const api = {
  health() {
    return request<HealthInfo>('/api/health')
  },

  getConfig() {
    return request<AppConfig>('/api/config')
  },

  saveConfig(config: AppConfig) {
    return request<AppConfig>('/api/config', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(config),
    })
  },

  listDir(dir: string) {
    return request<DirListing>(`/api/fs?path=${encodeURIComponent(dir)}`)
  },

  scanPck(dir: string, depth = 1) {
    return request<{ dir: string; depth: number; files: PckFile[] }>(
      `/api/scan-pck?dir=${encodeURIComponent(dir)}&depth=${depth}`,
    )
  },

  readJson(path: string) {
    return request<JsonReadResult>(`/api/json?path=${encodeURIComponent(path)}`)
  },

  saveJson(path: string, content: string) {
    return request<{ path: string; saved: boolean }>('/api/json', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ path, content }),
    })
  },

  reveal(path: string) {
    return request<{ ok: boolean }>('/api/reveal', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path }),
    })
  },
}

export interface RunUpdateOptions {
  config?: AppConfig
  modIds?: string[]
  dryRun?: boolean
  signal?: AbortSignal
  onEvent: (event: LogEvent) => void
}

/**
 * 执行更新，日志是流式返回的（服务端 SSE）。
 * 返回执行器给出的汇总数字。
 */
export async function runUpdate(options: RunUpdateOptions): Promise<Record<string, number>> {
  const res = await fetch('/api/update', {
    method: 'POST',
    headers: jsonHeaders,
    signal: options.signal,
    body: JSON.stringify({
      config: options.config,
      modIds: options.modIds ?? [],
      dryRun: options.dryRun === true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `更新请求失败（HTTP ${res.status}）`)
  }
  if (!res.body) throw new Error('浏览器不支持流式响应，请换用 Edge / Chrome 打开。')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let totals: Record<string, number> = {}

  const handleChunk = (chunk: string) => {
    for (const rawLine of chunk.split('\n')) {
      const line = rawLine.trimStart()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '{}') continue
      try {
        const event = JSON.parse(payload) as LogEvent
        if (event.level === 'done') {
          try {
            totals = JSON.parse(event.text) as Record<string, number>
          } catch {
            /* 汇总解析失败不影响日志 */
          }
        }
        options.onEvent(event)
      } catch {
        /* 半行数据，忽略 */
      }
    }
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      handleChunk(buffer.slice(0, index))
      buffer = buffer.slice(index + 2)
      index = buffer.indexOf('\n\n')
    }
  }
  if (buffer.trim()) handleChunk(buffer)
  return totals
}
