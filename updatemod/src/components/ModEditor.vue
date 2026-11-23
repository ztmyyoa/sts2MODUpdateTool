<script setup lang="ts">
/**
 * 右侧编辑器：一个 MOD 的全部设置都在这
 * 分四个页签：基本信息 / PCK / 输出目标 / JSON
 */
import { ref } from 'vue'
import PathInput from './PathInput.vue'
import TargetRow from './TargetRow.vue'
import JsonEditorPanel from './JsonEditorPanel.vue'
import FsBrowser from './FsBrowser.vue'
import { api } from '@/lib/api'
import type { GlobalConfig, ModConfig, PckFile } from '@/lib/types'
import { baseName, dirNameOf, formatDateTime, formatSize, joinWin, relativeUnder, uid } from '@/lib/format'

const props = defineProps<{ mod: ModConfig; global: GlobalConfig }>()

const emit = defineEmits<{
  (e: 'remove'): void
  (e: 'update-mod'): void
  (e: 'duplicate'): void
}>()

type Tab = 'basic' | 'pck' | 'targets' | 'json'
const tab = ref<Tab>('basic')

const isAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')

/* ---------------- DLL 探测 ---------------- */

const dllCandidates = ref<{ name: string; size: number }[]>([])
const detecting = ref(false)
const detectMessage = ref('')

async function detectDll() {
  if (!props.mod.sourceDir) {
    detectMessage.value = '先设置“源 MOD 目录”。'
    return
  }
  detecting.value = true
  detectMessage.value = ''
  try {
    const dir = joinWin(props.mod.sourceDir, props.mod.dllSubPath)
    const listing = await api.listDir(dir)
    if (!listing.exists || !listing.isDir) {
      dllCandidates.value = []
      detectMessage.value = `目录不存在：${dir}`
      return
    }
    const dlls = (listing.entries || [])
      .filter((entry) => !entry.isDir && entry.name.toLowerCase().endsWith('.dll'))
      .map((entry) => ({ name: entry.name, size: entry.size }))
    dllCandidates.value = dlls
    const first = dlls[0]
    if (!dlls.length) {
      detectMessage.value = '这个目录里没有 .dll 文件。'
    } else if (dlls.length === 1 && first) {
      props.mod.dllName = first.name
      detectMessage.value = `找到 1 个 DLL，已自动选中：${first.name}`
    } else {
      detectMessage.value = `找到 ${dlls.length} 个 DLL，点一下即可选中。`
    }
  } catch (err) {
    detectMessage.value = (err as Error).message
  } finally {
    detecting.value = false
  }
}

/* ---------------- DLL 直接选择 ---------------- */

const dllPicking = ref(false)

/** DLL 所在目录 = 源目录 + 相对子目录 */
function dllDir(): string {
  return joinWin(props.mod.sourceDir, props.mod.dllSubPath)
}

function dllPickStart(): string {
  const dir = dllDir()
  return props.mod.dllName ? joinWin(dir, props.mod.dllName) : dir
}

/** 选完文件后：把「文件名」填好，路径能换算就把「相对子目录」也一起对齐 */
function applyPickedDll(filePath: string) {
  const name = baseName(filePath)
  const rel = relativeUnder(props.mod.sourceDir, filePath)
  if (rel === null) {
    props.mod.dllName = name
    detectMessage.value = `已填入文件名 ${name}，但它不在「源 MOD 目录」下面。请把源目录改成它的工程根目录，否则更新时会找不到文件。`
    return
  }
  props.mod.dllSubPath = dirNameOf(rel)
  props.mod.dllName = name
  detectMessage.value = `已选用：${rel || name}`
}

/* ---------------- PCK 扫描 ---------------- */

const scanning = ref(false)
const scanResults = ref<PckFile[]>([])
const scanMessage = ref('')
const scanDepth = ref(1)
const manualPck = ref('')

async function scan(dir: string, label: string) {
  if (!dir) {
    scanMessage.value = `没有配置「${label}」，无法扫描。`
    return
  }
  scanning.value = true
  scanMessage.value = ''
  try {
    const result = await api.scanPck(dir, scanDepth.value)
    scanResults.value = result.files
    scanMessage.value = result.files.length
      ? `在「${label}」找到 ${result.files.length} 个 .pck`
      : `在「${label}」里没找到 .pck`
  } catch (err) {
    scanMessage.value = (err as Error).message
  } finally {
    scanning.value = false
  }
}

function addPck(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  if (props.mod.pckFiles.includes(trimmed)) return
  props.mod.pckFiles.push(trimmed)
}

function removePck(index: number) {
  props.mod.pckFiles.splice(index, 1)
}

function pckDirForMod(): string {
  return props.mod.pckSourceDir || props.global.workshopDir || ''
}

const pckPicking = ref(false)

function pckPickStart(): string {
  const first = props.mod.pckFiles[0]
  if (first && isAbsolutePath(first)) return first
  const dir = pckDirForMod()
  return first ? joinWin(dir, first) : dir
}

/** 选完 PCK 后：在本目录下就记相对路径，否则记绝对路径（后端两种都认） */
function applyPickedPck(filePath: string) {
  const name = baseName(filePath)
  const base = pckDirForMod()
  const rel = relativeUnder(base, filePath)
  if (rel === null) {
    addPck(filePath)
    scanMessage.value = `已按绝对路径添加：${name}（不在 PCK 来源目录下面）`
    return
  }
  addPck(rel || name)
  scanMessage.value = `已添加：${rel || name}`
}

function onDllSelected(filePath: string) {
  applyPickedDll(filePath)
  dllPicking.value = false
}

function onPckSelected(filePath: string) {
  applyPickedPck(filePath)
  pckPicking.value = false
}

/* ---------------- 目标 ---------------- */

function addTarget() {
  props.mod.targets.push({
    id: uid('target'),
    label: '新目标',
    dir: '',
    script: '',
    enabled: true,
    copyDll: true,
    copyPck: true,
    copyJson: false,
  })
}

function removeTarget(index: number) {
  props.mod.targets.splice(index, 1)
}
</script>

<template>
  <div class="editor">
    <!-- 顶部：名字 + 操作 -->
    <header class="editor-head">
      <input v-model="mod.name" class="input name-input" placeholder="MOD 名称" spellcheck="false" />
      <label class="check">
        <input v-model="mod.enabled" type="checkbox" />
        参与一键更新
      </label>
      <span class="grow" />
      <button class="btn btn-sm btn-primary" title="只更新这一个 MOD" @click="emit('update-mod')">更新此 MOD</button>
      <button class="btn btn-sm" title="复制一份配置（不动磁盘文件）" @click="emit('duplicate')">复制</button>
      <button class="btn btn-sm btn-danger" title="删除这个 MOD 的配置" @click="emit('remove')">删除</button>
    </header>

    <!-- 页签 -->
    <nav class="tabs">
      <button class="tab" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本信息</button>
      <button class="tab" :class="{ active: tab === 'pck' }" @click="tab = 'pck'">
        PCK
        <span v-if="mod.pckFiles.length" class="count">{{ mod.pckFiles.length }}</span>
      </button>
      <button class="tab" :class="{ active: tab === 'targets' }" @click="tab = 'targets'">
        输出目标
        <span v-if="mod.targets.length" class="count">{{ mod.targets.length }}</span>
      </button>
      <button class="tab" :class="{ active: tab === 'json' }" @click="tab = 'json'">JSON</button>
    </nav>

    <div class="editor-body">
      <!-- ======= 基本信息 ======= -->
      <div v-if="tab === 'basic'" class="pane fade-in">
        <PathInput
          v-model="mod.sourceDir"
          label="源 MOD 目录"
          placeholder="D:\stsmod\stsmods\你的MOD"
          hint="Godot 工程根目录，DLL 就在它下面的 .godot\mono\temp\bin\Debug"
        />

        <div class="grid-2">
          <div class="field">
            <label class="field-label">DLL 相对子目录</label>
            <input v-model="mod.dllSubPath" class="input mono" spellcheck="false" />
          </div>
          <div class="field">
            <label class="field-label">DLL 文件名</label>
            <div class="row">
              <input v-model="mod.dllName" class="input mono grow" placeholder="例如 MyMod.dll" spellcheck="false" />
              <button class="btn btn-sm btn-primary" title="浏览磁盘选择 .dll" @click="dllPicking = true">选择…</button>
              <button class="btn btn-sm" :disabled="detecting" @click="detectDll">
                <span v-if="detecting" class="spinner" />
                <span v-else>自动检测</span>
              </button>
            </div>
            <div class="field-hint">可以直接选文件，也可以点「自动检测」从 DLL 目录里挑</div>
          </div>
        </div>

        <div v-if="detectMessage" class="hint-box">{{ detectMessage }}</div>
        <div v-if="dllCandidates.length > 1" class="candidates">
          <button
            v-for="dll in dllCandidates"
            :key="dll.name"
            class="btn btn-sm"
            :class="{ 'btn-ok': dll.name === mod.dllName }"
            @click="mod.dllName = dll.name"
          >
            {{ dll.name }} <span class="muted">{{ formatSize(dll.size) }}</span>
          </button>
        </div>

        <div class="field">
          <label class="field-label">备注</label>
          <textarea v-model="mod.notes" class="textarea" rows="3" placeholder="随便记点什么，比如这个 MOD 的特殊注意事项" />
        </div>
      </div>

      <!-- ======= PCK ======= -->
      <div v-else-if="tab === 'pck'" class="pane fade-in">
        <PathInput
          v-model="mod.pckSourceDir"
          label="PCK 来源目录（留空则用全局创意工坊目录）"
          :placeholder="global.workshopDir"
          :hint="`当前生效：${pckDirForMod() || '（未设置）'}`"
        />

        <div class="row-wrap">
          <span class="field-label">扫描深度</span>
          <select v-model.number="scanDepth" class="select" style="width: 110px">
            <option :value="0">仅当前目录</option>
            <option :value="1">下一层</option>
            <option :value="2">下两层</option>
          </select>
          <button class="btn btn-sm btn-primary" title="浏览磁盘选择 .pck" @click="pckPicking = true">选择 PCK 文件…</button>
          <button class="btn btn-sm" :disabled="scanning" @click="scan(pckDirForMod(), 'PCK 来源目录')">
            扫描来源目录
          </button>
          <button
            class="btn btn-sm"
            :disabled="scanning || !global.workshopDir"
            @click="scan(global.workshopDir, '创意工坊目录')"
          >
            扫描创意工坊
          </button>
          <span v-if="scanning" class="spinner" />
        </div>

        <div v-if="scanMessage" class="hint-box">{{ scanMessage }}</div>

        <div v-if="scanResults.length" class="scan-list">
          <div v-for="file in scanResults" :key="file.path" class="scan-row">
            <div class="scan-main">
              <span class="mono name">{{ file.name }}</span>
              <span class="muted small">{{ formatSize(file.size) }} · {{ formatDateTime(file.mtimeMs) }}</span>
              <span class="mono muted path">{{ file.path }}</span>
            </div>
            <button
              class="btn btn-sm"
              :disabled="mod.pckFiles.includes(file.path)"
              @click="addPck(file.path)"
            >
              {{ mod.pckFiles.includes(file.path) ? '已添加' : '添加' }}
            </button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">本次要复制的 PCK（{{ mod.pckFiles.length }} 个）</label>
          <div v-if="!mod.pckFiles.length" class="hint-box">还没有添加 PCK。用上面的扫描，或在下面手动填文件名。</div>
          <div v-for="(file, index) in mod.pckFiles" :key="`${file}-${index}`" class="pck-row">
            <span class="tag" :class="isAbsolutePath(file) ? 'tag-blue' : 'tag-gray'">
              {{ isAbsolutePath(file) ? '绝对路径' : '相对路径' }}
            </span>
            <span class="mono grow ellipsis" :title="file">{{ file }}</span>
            <button class="btn btn-sm btn-danger" @click="removePck(index)">移除</button>
          </div>
        </div>

        <div class="row">
          <input
            v-model="manualPck"
            class="input mono grow"
            placeholder="手动输入文件名，例如 MyMod.pck（相对来源目录）"
            spellcheck="false"
            @keydown.enter="addPck(manualPck); manualPck = ''"
          />
          <button class="btn btn-sm" :disabled="!manualPck.trim()" @click="addPck(manualPck); manualPck = ''">
            添加
          </button>
        </div>
      </div>

      <!-- ======= 输出目标 ======= -->
      <div v-else-if="tab === 'targets'" class="pane fade-in">
        <p class="field-hint">
          每个目标 = 一个文件夹 + 可选的一个 .bat。复制完成后会按顺序执行该目标的脚本（比如上传 Steam / push GitHub）。
        </p>
        <TargetRow
          v-for="(target, index) in mod.targets"
          :key="target.id"
          :target="target"
          :index="index"
          @remove="removeTarget(index)"
        />
        <button class="btn" @click="addTarget">＋ 添加目标</button>
        <div v-if="!mod.targets.length" class="hint-box">
          还没有目标。至少加一个，否则更新时没有地方可复制。
        </div>
      </div>

      <!-- ======= JSON ======= -->
      <div v-else class="pane fade-in">
        <PathInput
          v-model="mod.jsonPath"
          label="JSON 模板路径"
          kind="file"
          :extensions="['.json']"
          hint="一般是 D:\stsmod\modmaker\SteamMOD\<MOD>\paks\<MOD>.json"
        />
        <div class="field">
          <label class="field-label">复制到目标时的文件名（留空则沿用原名）</label>
          <input v-model="mod.jsonName" class="input mono" placeholder="例如 MyMod.json" spellcheck="false" />
        </div>
        <JsonEditorPanel :path="mod.jsonPath" />
      </div>
    </div>

    <!-- 选 DLL / PCK 用的页面内文件浏览器 -->
    <FsBrowser
      v-if="dllPicking"
      mode="file"
      title="选择 DLL 文件"
      :initial-path="dllPickStart()"
      :extensions="['.dll']"
      @select="onDllSelected"
      @close="dllPicking = false"
    />
    <FsBrowser
      v-if="pckPicking"
      mode="file"
      title="选择 PCK 文件"
      :initial-path="pckPickStart()"
      :extensions="['.pck']"
      @select="onPckSelected"
      @close="pckPicking = false"
    />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--bg);
}

.editor-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-soft);
  flex: none;
}

.name-input {
  font-size: 15px;
  font-weight: 600;
  max-width: 320px;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-soft);
  flex: none;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-family: inherit;
  padding: 9px 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--text-dim);
}

.tab.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.count {
  font-size: 10.5px;
  background: var(--bg-panel-2);
  border-radius: 20px;
  padding: 0 6px;
  color: var(--muted);
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.hint-box {
  background: var(--bg-panel);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 8px 11px;
  font-size: 12px;
  color: var(--text-dim);
}

.candidates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scan-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}

.scan-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-soft);
}

.scan-row:last-child {
  border-bottom: none;
}

.scan-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.scan-main .name {
  font-size: 12.5px;
}

.small {
  font-size: 11px;
}

.path {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pck-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-panel);
}

.tag {
  font-size: 10.5px;
  padding: 0 6px;
  border-radius: 20px;
  flex: none;
}

.tag-blue {
  color: #85b4ff;
  background: rgba(79, 140, 255, 0.14);
}

.tag-gray {
  color: var(--muted);
  background: var(--bg-panel-2);
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
