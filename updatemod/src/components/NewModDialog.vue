<script setup lang="ts">
/**
 * 新增 MOD 对话框
 * ------------------------------------------------------------------
 * 模板只是「建议值」：所有路径都能在这里直接点「选择…」挑磁盘上的真实位置，
 * 不想用模板就留空、或者自己填。填了模板以外的值时以你填的为准。
 */
import { computed, ref } from 'vue'
import PathInput from './PathInput.vue'
import FsBrowser from './FsBrowser.vue'
import { baseName, dirNameOf, joinWin, relativeUnder, uid } from '@/lib/format'
import type { ModConfig, TargetConfig, TemplateConfig } from '@/lib/types'

const props = defineProps<{
  templates: TemplateConfig
  existingNames: string[]
}>()

const emit = defineEmits<{
  (e: 'create', mod: ModConfig): void
  (e: 'close'): void
}>()

const name = ref('')
const sourceDir = ref('')
const dllSubPath = ref(props.templates.dllSubPath || '')
const dllName = ref('')
const jsonPath = ref('')

const pckSourceDir = ref('')
const pckFiles = ref<string[]>([])

const steamEnabled = ref(true)
const steamDir = ref('')
const steamScript = ref('')

const githubEnabled = ref(true)
const githubDir = ref('')
const githubScript = ref('')

const message = ref('')
const dllPicking = ref(false)

/** 把模板里的 {mod} 换成当前名字（名字还没填就原样显示） */
function fill(value: string): string {
  return (value || '').split('{mod}').join(name.value.trim() || '{mod}')
}

const tplSourceDir = computed(() => fill(props.templates.sourceDir))
const tplJsonPath = computed(() => fill(props.templates.jsonPath))
const tplPckSourceDir = computed(() => fill(props.templates.pckSourceDir))
const tplSteamDir = computed(() => fill(props.templates.steamPaksDir))
const tplSteamScript = computed(() => fill(props.templates.steamScript))
const tplGithubDir = computed(() => fill(props.templates.githubDir))
const tplGithubScript = computed(() => fill(props.templates.githubScript))

const nameTaken = computed(() => {
  const current = name.value.trim().toLowerCase()
  return !!current && props.existingNames.some((item) => item.toLowerCase() === current)
})

const canCreate = computed(() => !!name.value.trim() && !nameTaken.value)

/** 一键把模板值填进还空着的字段，然后照样可以改 */
function applyTemplate() {
  if (!sourceDir.value.trim()) sourceDir.value = tplSourceDir.value
  if (!dllSubPath.value.trim()) dllSubPath.value = props.templates.dllSubPath
  if (!jsonPath.value.trim()) jsonPath.value = tplJsonPath.value
  if (!pckSourceDir.value.trim()) pckSourceDir.value = tplPckSourceDir.value
  if (!steamDir.value.trim()) steamDir.value = tplSteamDir.value
  if (!steamScript.value.trim()) steamScript.value = tplSteamScript.value
  if (!githubDir.value.trim()) githubDir.value = tplGithubDir.value
  if (!githubScript.value.trim()) githubScript.value = tplGithubScript.value
  message.value = '已按模板填入，可以继续改。'
}

/* ---------------- 选 PCK 文件 ---------------- */

const isAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')

const pckPicking = ref(false)

const pckPickStart = computed(() => {
  const first = pckFiles.value[0]
  if (first && isAbsolutePath(first)) return first
  const base = pckSourceDir.value.trim() || tplPckSourceDir.value
  return first ? joinWin(base, first) : base
})

function addPck(value: string) {
  const trimmed = value.trim()
  if (!trimmed || pckFiles.value.includes(trimmed)) return
  pckFiles.value.push(trimmed)
}

function removePck(index: number) {
  pckFiles.value.splice(index, 1)
}

/** 选完 PCK：在来源目录下就记相对路径，否则记绝对路径（后端两种都认） */
function onPckPicked(filePath: string) {
  pckPicking.value = false
  const base = pckSourceDir.value.trim() || tplPckSourceDir.value
  const rel = relativeUnder(base, filePath)
  if (rel === null) {
    addPck(filePath)
    message.value = `已按绝对路径加入：${baseName(filePath)}`
    return
  }
  const value = rel || baseName(filePath)
  addPck(value)
  message.value = `已加入 PCK：${value}`
}

/* ---------------- 选 DLL 文件 ---------------- */

const dllPickStart = computed(() => {
  if (!sourceDir.value.trim()) return dllSubPath.value
  const dir = joinWin(sourceDir.value, dllSubPath.value)
  return dllName.value ? joinWin(dir, dllName.value) : dir
})

function onDllPicked(filePath: string) {
  dllPicking.value = false
  dllName.value = baseName(filePath)
  const rel = relativeUnder(sourceDir.value, filePath)
  if (rel === null) {
    message.value = '已填入文件名，但这个 DLL 不在源目录下面，请确认「源 MOD 目录」填对了。'
    return
  }
  dllSubPath.value = dirNameOf(rel)
  message.value = `已选用：${rel}`
}

/* ---------------- 创建 ---------------- */

function create() {
  const finalName = name.value.trim()
  if (!finalName || nameTaken.value) return
  const tpl = props.templates

  const targets: TargetConfig[] = []
  if (steamEnabled.value) {
    targets.push({
      id: uid('target'),
      label: 'SteamMOD',
      dir: steamDir.value.trim() || fill(tpl.steamPaksDir),
      script: steamScript.value.trim() || fill(tpl.steamScript),
      enabled: true,
      copyDll: true,
      copyPck: true,
      copyJson: false,
    })
  }
  if (githubEnabled.value) {
    targets.push({
      id: uid('target'),
      label: 'GitHub',
      dir: githubDir.value.trim() || fill(tpl.githubDir),
      script: githubScript.value.trim() || fill(tpl.githubScript),
      enabled: true,
      copyDll: true,
      copyPck: true,
      copyJson: true,
    })
  }

  const mod: ModConfig = {
    id: uid('mod'),
    name: finalName,
    enabled: true,
    sourceDir: sourceDir.value.trim() || fill(tpl.sourceDir),
    dllSubPath: dllSubPath.value.trim() || tpl.dllSubPath,
    dllName: dllName.value.trim() || `${finalName}.dll`,
    pckSourceDir: pckSourceDir.value.trim(),
    pckFiles: [...pckFiles.value],
    jsonPath: jsonPath.value.trim() || fill(tpl.jsonPath),
    jsonName: jsonPath.value.trim() ? baseName(jsonPath.value) : '',
    targets,
    notes: '',
  }
  emit('create', mod)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog add-dialog fade-in">
      <h3>新增 MOD</h3>
      <p class="dialog-tip">
        下面每个路径都可以点「选择…」挑磁盘上的真实位置；不想一个个填，也可以先点「按模板填入」再改。
      </p>

      <div class="field">
        <label class="field-label">MOD 名称 <span class="req">*</span></label>
        <input
          v-model="name"
          class="input"
          placeholder="和文件夹名保持一致，例如 MyMod"
          spellcheck="false"
          autofocus
        />
        <div v-if="nameTaken" class="field-hint error-text">已经有同名的 MOD 了，换个名字。</div>
      </div>

      <div class="section-title">路径</div>

      <PathInput
        v-model="sourceDir"
        label="源 MOD 目录"
        :placeholder="tplSourceDir"
        hint="Godot 工程根目录，选了之后可以去挑 DLL"
      />
      <PathInput
        v-model="jsonPath"
        label="JSON 路径"
        kind="file"
        :extensions="['.json']"
        :placeholder="tplJsonPath"
        hint="这个 MOD 的 json 文件，留空则按模板生成"
      />

      <div class="grid-2">
        <div class="field">
          <label class="field-label">DLL 相对子目录</label>
          <input v-model="dllSubPath" class="input mono" spellcheck="false" />
        </div>
        <div class="field">
          <label class="field-label">DLL 文件名</label>
          <div class="row">
            <input v-model="dllName" class="input mono grow" placeholder="例如 MyMod.dll" spellcheck="false" />
            <button class="btn btn-sm btn-primary" @click="dllPicking = true">选择…</button>
          </div>
        </div>
      </div>

      <div class="section-title">PCK</div>

      <PathInput
        v-model="pckSourceDir"
        label="PCK 来源目录"
        :placeholder="tplPckSourceDir"
        hint="留空则用「设置」里的创意工坊目录"
      />
      <div class="row">
        <button class="btn btn-sm btn-primary" @click="pckPicking = true">选择 PCK 文件…</button>
        <span class="muted small">{{ pckFiles.length }} 个已选</span>
      </div>
      <div v-if="pckFiles.length" class="pck-list">
        <div v-for="(file, index) in pckFiles" :key="`${file}-${index}`" class="pck-chip">
          <span class="mono grow ellipsis" :title="file">{{ file }}</span>
          <button class="chip-x" title="移除" @click="removePck(index)">✕</button>
        </div>
      </div>

      <div class="section-title">输出目标</div>

      <div class="target-box">
        <label class="check">
          <input v-model="steamEnabled" type="checkbox" />
          生成 Steam 上传目标
        </label>
        <template v-if="steamEnabled">
          <PathInput v-model="steamDir" label="目标目录" :placeholder="tplSteamDir" />
          <PathInput
            v-model="steamScript"
            label="上传脚本（可选）"
            kind="file"
            :extensions="['.bat', '.cmd', '.ps1']"
            :placeholder="tplSteamScript"
          />
        </template>
      </div>

      <div class="target-box">
        <label class="check">
          <input v-model="githubEnabled" type="checkbox" />
          生成 GitHub 仓库目标
        </label>
        <template v-if="githubEnabled">
          <PathInput v-model="githubDir" label="目标目录" :placeholder="tplGithubDir" />
          <PathInput
            v-model="githubScript"
            label="上传脚本（可选）"
            kind="file"
            :extensions="['.bat', '.cmd', '.ps1']"
            :placeholder="tplGithubScript"
          />
        </template>
      </div>

      <div v-if="message" class="hint-box">{{ message }}</div>

      <div class="dialog-foot">
        <button class="btn btn-sm" @click="applyTemplate">按模板填入</button>
        <span class="grow" />
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!canCreate" @click="create">创建</button>
      </div>
    </div>

    <FsBrowser
      v-if="dllPicking"
      mode="file"
      title="选择 DLL 文件"
      :initial-path="dllPickStart"
      :extensions="['.dll']"
      @select="onDllPicked"
      @close="dllPicking = false"
    />
    <FsBrowser
      v-if="pckPicking"
      mode="file"
      title="选择 PCK 文件"
      :initial-path="pckPickStart"
      :extensions="['.pck']"
      @select="onPckPicked"
      @close="pckPicking = false"
    />
  </div>
</template>

<style scoped>
/* 这几个是弹窗骨架，App.vue 里是 scoped 的，本组件里得自己带一份 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog h3 {
  margin: 0;
  font-size: 14px;
}

.dialog-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hint-box {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-dim);
  background: rgba(79, 140, 255, 0.08);
  border: 1px solid rgba(79, 140, 255, 0.25);
  border-radius: 6px;
  padding: 8px 10px;
}

.add-dialog {
  width: min(640px, 94vw);
  max-height: 88vh;
  overflow-y: auto;
}

.dialog-tip {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.section-title {
  margin: 16px 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  text-transform: uppercase;
}

.req {
  color: var(--error);
}

.error-text {
  color: var(--error);
}

.target-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel, #151922);
}

.pck-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pck-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-input, #0f1218);
  border: 1px solid var(--border-soft);
}

.chip-x {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
}

.chip-x:hover {
  color: var(--error);
  background: rgba(255, 95, 109, 0.12);
}
</style>
