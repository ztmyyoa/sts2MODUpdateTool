/** 和 updatemod 界面同一套配色，视频看起来就是那个工具的延伸 */
export const C = {
  bg: '#0b0e13',
  bgSoft: '#0f131b',
  panel: '#141a24',
  panel2: '#1a2230',
  border: '#243044',
  text: '#e8edf7',
  dim: '#9aa5b8',
  muted: '#66718a',
  accent: '#4f8cff',
  accentSoft: '#7aa2ff',
  ok: '#3ecf8e',
  warn: '#f5a524',
  error: '#ff5f6d',
} as const

export const FONT = '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'
export const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, monospace'

/** 把 #rrggbb 加透明度 */
export function alpha(hex: string, a: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
