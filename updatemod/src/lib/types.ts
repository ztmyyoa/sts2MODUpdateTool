/**
 * 前后端共用的数据结构说明（后端在 server/config.mjs 里产出同样的形状）
 */

export type LogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step' | 'plan' | 'script' | 'done' | 'action'

/** 一条日志 */
export interface LogEvent {
  ts: number
  level: LogLevel
  scope: string
  text: string
}

/** 一个输出目标：比如 SteamMOD 目录、或 GitHub 仓库目录 */
export interface TargetConfig {
  id: string
  label: string
  dir: string
  script: string
  enabled: boolean
  copyDll: boolean
  copyPck: boolean
  copyJson: boolean
}

/** 一个 MOD 的配置 */
export interface ModConfig {
  id: string
  name: string
  enabled: boolean
  sourceDir: string
  dllSubPath: string
  dllName: string
  pckSourceDir: string
  pckFiles: string[]
  jsonPath: string
  jsonName: string
  targets: TargetConfig[]
  notes: string
}

export interface GlobalConfig {
  workshopDir: string
  openBrowser: boolean
  scriptTimeoutMs: number
}

/** 新建 MOD 时用来预填路径的模板，{mod} 会被替换成名字 */
export interface TemplateConfig {
  sourceDir: string
  dllSubPath: string
  pckSourceDir: string
  steamPaksDir: string
  steamScript: string
  githubDir: string
  githubScript: string
  jsonPath: string
}

export interface AppConfig {
  version: number
  global: GlobalConfig
  templates: TemplateConfig
  mods: ModConfig[]
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mtimeMs: number
}

export interface DirListing {
  path: string
  /** 上一级目录；已经在盘符层时是空字符串 */
  parent?: string
  exists: boolean
  isDir: boolean
  entries?: DirEntry[]
  error?: string
}

export interface PckFile {
  path: string
  name: string
  size: number
  mtimeMs: number
}

export interface JsonReadResult {
  path: string
  exists: boolean
  content: string
  error?: string
}

export interface HealthInfo {
  ok: boolean
  platform: string
  node: string
  projectRoot: string
  configFile: string
  distReady: boolean
}

export interface UpdateTotals {
  copied: number
  skipped: number
  failed: number
  scripts: number
  scriptFailed: number
}
