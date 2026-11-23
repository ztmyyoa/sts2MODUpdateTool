/**
 * 配置读写模块
 * ------------------------------------------------------------------
 * 配置文件位置：<项目根>/config/app.config.json（已在 .gitignore 里，不会被提交）
 * 首次启动如果文件不存在，会自动写入一份空的默认配置，MOD 列表由你在界面里新增。
 * 所有字段都会经过 normalizeConfig() 清洗，避免前端传来脏数据把程序弄崩。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

/** 项目根目录（server/ 的上一级） */
export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
export const CONFIG_DIR = path.join(ROOT, 'config')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'app.config.json')

const DEFAULT_DLL_SUB = '.godot\\mono\\temp\\bin\\Debug'

/**
 * 新建 MOD 时用来预填路径的模板，{mod} 会被替换成 MOD 名称。
 * 这些只是示例路径（按常见的整理方式写的），第一次使用时在「设置」里改成你自己的即可。
 */
function defaultTemplates() {
  return {
    sourceDir: 'D:\\stsmod\\stsmods\\{mod}',
    dllSubPath: DEFAULT_DLL_SUB,
    pckSourceDir: 'D:\\steam\\steamapps\\workshop\\content\\2868840',
    steamPaksDir: 'D:\\stsmod\\modmaker\\SteamMOD\\{mod}\\paks',
    steamScript: 'D:\\stsmod\\modmaker\\SteamMOD\\{mod}\\mod_create.bat',
    githubDir: 'D:\\stsmod\\SlayTheSpire2MODs\\mods_finished\\{mod}',
    githubScript: 'D:\\stsmod\\SlayTheSpire2MODs\\mods_finished\\{mod}\\build.bat',
    jsonPath: 'D:\\stsmod\\modmaker\\SteamMOD\\{mod}\\paks\\{mod}.json',
  }
}

function target(partial = {}) {
  return {
    id: partial.id || randomUUID(),
    label: partial.label ?? '目标',
    dir: partial.dir ?? '',
    script: partial.script ?? '',
    enabled: partial.enabled !== false,
    copyDll: partial.copyDll !== false,
    copyPck: partial.copyPck !== false,
    copyJson: partial.copyJson === true,
  }
}

/**
 * 默认配置。
 * 刻意不带任何 MOD 条目：不同人整理的目录五花八门，预填反而误导，
 * 第一次启动就是空列表，点左上角「＋ 新增 MOD」按模板生成，再改成自己的路径。
 */
function defaultConfig() {
  return {
    version: 1,
    global: {
      workshopDir: 'D:\\steam\\steamapps\\workshop\\content\\2868840',
      openBrowser: true,
      scriptTimeoutMs: 600000,
    },
    templates: defaultTemplates(),
    mods: [],
  }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** 清洗单个目标配置 */
function normalizeTarget(raw = {}) {
  const t = target({})
  return {
    id: str(raw.id) || t.id,
    label: str(raw.label) || '未命名目标',
    dir: str(raw.dir),
    script: str(raw.script),
    enabled: raw.enabled !== false,
    copyDll: raw.copyDll !== false,
    copyPck: raw.copyPck !== false,
    copyJson: raw.copyJson === true,
  }
}

/** 清洗单个 MOD 配置 */
function normalizeMod(raw = {}) {
  return {
    id: str(raw.id) || randomUUID(),
    name: str(raw.name) || '未命名MOD',
    enabled: raw.enabled !== false,
    sourceDir: str(raw.sourceDir),
    dllSubPath: str(raw.dllSubPath, DEFAULT_DLL_SUB) || DEFAULT_DLL_SUB,
    dllName: str(raw.dllName),
    pckSourceDir: str(raw.pckSourceDir),
    pckFiles: Array.isArray(raw.pckFiles)
      ? raw.pckFiles.map((x) => str(x)).filter(Boolean)
      : [],
    jsonPath: str(raw.jsonPath),
    jsonName: str(raw.jsonName),
    targets: Array.isArray(raw.targets) ? raw.targets.map(normalizeTarget) : [],
    notes: str(raw.notes),
  }
}

/** 清洗整份配置 */
export function normalizeConfig(raw = {}) {
  const base = defaultConfig()
  const templates = { ...base.templates }
  if (raw.templates && typeof raw.templates === 'object') {
    for (const key of Object.keys(templates)) {
      const value = raw.templates[key]
      if (typeof value === 'string' && value.trim()) templates[key] = value.trim()
    }
  }
  const global = { ...base.global }
  if (raw.global && typeof raw.global === 'object') {
    if (typeof raw.global.workshopDir === 'string') global.workshopDir = raw.global.workshopDir.trim()
    if (typeof raw.global.openBrowser === 'boolean') global.openBrowser = raw.global.openBrowser
    const timeout = Number(raw.global.scriptTimeoutMs)
    if (Number.isFinite(timeout) && timeout >= 1000) global.scriptTimeoutMs = Math.floor(timeout)
  }
  const mods = Array.isArray(raw.mods) ? raw.mods.map(normalizeMod) : []
  return { version: 1, global, templates, mods }
}

/** 用模板生成一个全新 MOD 的配置 */
export function createModFromTemplate(config, name) {
  const tpl = config.templates || defaultTemplates()
  const fill = (value) => (typeof value === 'string' ? value.split('{mod}').join(name) : value)
  return normalizeMod({
    name,
    sourceDir: fill(tpl.sourceDir),
    dllSubPath: tpl.dllSubPath || DEFAULT_DLL_SUB,
    dllName: `${name}.dll`,
    pckSourceDir: '',
    pckFiles: [`${name}.pck`],
    jsonPath: fill(tpl.jsonPath),
    targets: [
      target({ label: 'SteamMOD', dir: fill(tpl.steamPaksDir), script: fill(tpl.steamScript), copyJson: false }),
      target({ label: 'GitHub', dir: fill(tpl.githubDir), script: fill(tpl.githubScript), copyJson: true }),
    ],
  })
}

/** 读取配置（不存在则写入默认配置） */
export async function loadConfig() {
  try {
    const text = await readFile(CONFIG_FILE, 'utf8')
    return normalizeConfig(JSON.parse(text))
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[config] 读取配置失败，改用默认配置：', err.message)
    }
    const fresh = defaultConfig()
    await saveConfig(fresh)
    return normalizeConfig(fresh)
  }
}

/** 保存配置（自动清洗 + 2 空格缩进） */
export async function saveConfig(raw) {
  const clean = normalizeConfig(raw)
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8')
  return clean
}
