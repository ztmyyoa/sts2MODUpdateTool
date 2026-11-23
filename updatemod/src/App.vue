<script setup lang="ts">
/**
 * 主界面
 * 顶部：工具栏（保存 / 一键更新 / 试运行 / 设置）
 * 左侧：MOD 列表
 * 右侧：当前 MOD 的编辑器
 * 底部：实时日志
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ModSidebar from './components/ModSidebar.vue'
import ModEditor from './components/ModEditor.vue'
import LogPanel from './components/LogPanel.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import NewModDialog from './components/NewModDialog.vue'
import { api, runUpdate } from './lib/api'
import type { AppConfig, HealthInfo, LogEvent, ModConfig } from './lib/types'
import { clone, uid } from './lib/format'

const config = ref<AppConfig | null>(null)
const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const loadError = ref('')
const health = ref<HealthInfo | null>(null)
const selectedId = ref('')
const logs = ref<LogEvent[]>([])
const logOpen = ref(true)
const showSettings = ref(false)
const toast = ref('')
const toastError = ref(false)
const snapshot = ref('')
/** 需要用户去别处操作（比如在手机上确认 Steam 登录）时弹出的提示框 */
const actionAlert = ref<{ text: string; ts: number } | null>(null)
/** 提示框出现后已经等了多久（秒），用来显示倒计时 */
const waited = ref(0)

const APP_TITLE = 'STS2 MOD 更新工具'
/** steamcmd 留给手机确认的时间，官方提示是 60 秒左右 */
const CONFIRM_LIMIT = 60

const SIDEBAR_DEFAULT = 272
const LOG_DEFAULT = 230
const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 560
const LOG_MIN = 110

/** 布局尺寸记在 localStorage 里，下次打开还是用户拉过的样子 */
function loadSize(key: string, fallback: number): number {
  const raw = localStorage.getItem(`sts2mod:${key}`)
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const sidebarWidth = ref(loadSize('sidebarWidth', SIDEBAR_DEFAULT))
const logHeight = ref(loadSize('logHeight', LOG_DEFAULT))
/** 正在拖动的分隔条：side = 左右分栏，log = 日志高度 */
const dragKind = ref<'' | 'side' | 'log'>('')

// 提示框出现时改浏览器标签标题：即使切到别的窗口，任务栏上也能一眼看到
watch(actionAlert, (alert) => {
  document.title = alert ? '⚠ 请在手机上确认登录' : APP_TITLE
  waited.value = 0
})

// 提示框开着时每秒加一，让用户看到还剩多少时间
let waitTimer: ReturnType<typeof setInterval> | null = null
watch(
  () => actionAlert.value !== null,
  (open) => {
    if (waitTimer) {
      clearInterval(waitTimer)
      waitTimer = null
    }
    if (!open) return
    waitTimer = setInterval(() => {
      waited.value += 1
    }, 1000)
  },
)

/* ---------------- 拖动分隔条改布局 ---------------- */

function startDrag(kind: 'side' | 'log', event: PointerEvent) {
  dragKind.value = kind
  const startX = event.clientX
  const startY = event.clientY
  const baseWidth = sidebarWidth.value
  const baseHeight = logHeight.value
  event.preventDefault()

  const onMove = (move: PointerEvent) => {
    if (kind === 'side') {
      const next = baseWidth + (move.clientX - startX)
      sidebarWidth.value = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, next)))
    } else {
      const next = baseHeight - (move.clientY - startY)
      const max = Math.max(LOG_MIN + 40, window.innerHeight - 220)
      logHeight.value = Math.round(Math.min(max, Math.max(LOG_MIN, next)))
    }
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    dragKind.value = ''
    localStorage.setItem('sts2mod:sidebarWidth', String(sidebarWidth.value))
    localStorage.setItem('sts2mod:logHeight', String(logHeight.value))
    document.body.classList.remove('dragging-col', 'dragging-row')
  }

  document.body.classList.add(kind === 'side' ? 'dragging-col' : 'dragging-row')
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

/** 双击分隔条恢复默认尺寸 */
function resetDrag(kind: 'side' | 'log') {
  if (kind === 'side') sidebarWidth.value = SIDEBAR_DEFAULT
  else logHeight.value = LOG_DEFAULT
  localStorage.setItem('sts2mod:sidebarWidth', String(sidebarWidth.value))
  localStorage.setItem('sts2mod:logHeight', String(logHeight.value))
}

let controller: AbortController | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** 用 WebAudio 发一声提示音，保证用户切到别的窗口也能注意到 */
function beep() {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    setTimeout(() => ctx.close().catch(() => {}), 1200)
  } catch {
    /* 浏览器不允许发声就算了 */
  }
}

/* ---------------- 基础状态 ---------------- */

const selectedMod = computed<ModConfig | undefined>(() =>
  config.value ? config.value.mods.find((mod) => mod.id === selectedId.value) : undefined,
)

const dirty = computed(() => {
  if (!config.value) return false
  return JSON.stringify(config.value) !== snapshot.value
})

const enabledCount = computed(() =>
  config.value ? config.value.mods.filter((mod) => mod.enabled !== false).length : 0,
)

/* ---------------- 提示条 ---------------- */

function showToast(message: string, isError = false) {
  toast.value = message
  toastError.value = isError
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, isError ? 6000 : 2600)
}

function log(level: LogEvent['level'], scope: string, text: string) {
  logs.value.push({ ts: Date.now(), level, scope, text })
}

/* ---------------- 读取 / 保存 ---------------- */

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    const loaded = await api.getConfig()
    config.value = loaded
    snapshot.value = JSON.stringify(loaded)
    const exists = loaded.mods.some((mod) => mod.id === selectedId.value)
    if (!exists) selectedId.value = loaded.mods[0]?.id ?? ''
    if (!loaded.mods.length) logOpen.value = true
  } catch (err) {
    loadError.value = (err as Error).message
    log('error', '界面', `读取配置失败：${(err as Error).message}`)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!config.value) return
  saving.value = true
  try {
    const saved = await api.saveConfig(config.value)
    config.value = saved
    snapshot.value = JSON.stringify(saved)
    showToast('配置已保存')
    log('ok', '配置', '配置文件已保存到 config/app.config.json')
  } catch (err) {
    showToast(`保存失败：${(err as Error).message}`, true)
    log('error', '配置', `保存失败：${(err as Error).message}`)
  } finally {
    saving.value = false
  }
}

/* ---------------- 更新 ---------------- */

async function startUpdate(ids: string[] = [], dryRun = false) {
  if (!config.value || running.value) return
  running.value = true
  logOpen.value = true
  logs.value = []
  controller = new AbortController()

  const targetNames = ids.length
    ? config.value.mods.filter((mod) => ids.includes(mod.id)).map((mod) => mod.name).join('、')
    : '全部启用的 MOD'

  log('step', '开始', `${dryRun ? '试运行' : '开始更新'}：${targetNames}`)

  // 运行前先保存，避免后端用的是旧配置
  try {
    const saved = await api.saveConfig(config.value)
    config.value = saved
    snapshot.value = JSON.stringify(saved)
  } catch (err) {
    log('error', '配置', `保存配置失败：${(err as Error).message}`)
  }

  try {
    const totals = await runUpdate({
      config: config.value,
      modIds: ids,
      dryRun,
      signal: controller.signal,
      onEvent: (event) => {
        logs.value.push(event)
        if (logs.value.length > 6000) logs.value.splice(0, 1000)
        // 后端发现“需要你本人去操作”（例如 Steam 手机确认）时，弹框 + 提示音
        if (event.level === 'action' && !actionAlert.value) {
          actionAlert.value = { text: event.text, ts: event.ts }
          beep()
        }
      },
    })
    const failed = (totals.failed ?? 0) + (totals.scriptFailed ?? 0)
    if (dryRun) showToast('试运行结束，详见日志')
    else if (failed) showToast(`更新结束，有 ${failed} 处失败，请看日志`, true)
    else showToast('更新完成')
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log('warn', '中止', '已被手动中止。')
    } else {
      log('error', '异常', (err as Error).message)
      showToast(`更新异常：${(err as Error).message}`, true)
    }
  } finally {
    running.value = false
    controller = null
    // 跑完了还挂着“去手机上确认”的框会让人以为流程没结束
    actionAlert.value = null
  }
}

function cancelUpdate() {
  controller?.abort()
}

/* ---------------- MOD 增删改 ---------------- */

const adding = ref(false)

function openAdd() {
  adding.value = true
}

/** 新增对话框里已经把所有路径挑好了，这里只做重名检查和插入 */
function onCreateMod(mod: ModConfig) {
  if (!config.value) return
  const name = mod.name.trim()
  if (config.value.mods.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    showToast('已经有同名的 MOD 了', true)
    return
  }
  config.value.mods.push(mod)
  selectedId.value = mod.id
  adding.value = false
  showToast(`已创建「${name}」，核对路径后记得保存`)
}

function removeMod(id: string) {
  if (!config.value) return
  const mod = config.value.mods.find((item) => item.id === id)
  if (!mod) return
  if (!window.confirm(`删除「${mod.name}」的配置？\n只删配置，不会动磁盘上的文件。`)) return
  const index = config.value.mods.findIndex((item) => item.id === id)
  config.value.mods.splice(index, 1)
  if (selectedId.value === id) selectedId.value = config.value.mods[0]?.id ?? ''
}

/** 复制一份配置：路径原样带过来，改个名字就能用在同源的不同 MOD 上 */
function duplicateMod() {
  if (!config.value || !selectedMod.value) return
  const source = selectedMod.value
  const used = new Set(config.value.mods.map((item) => item.name.toLowerCase()))
  let copyName = `${source.name} 副本`
  let counter = 2
  while (used.has(copyName.toLowerCase())) {
    copyName = `${source.name} 副本 ${counter}`
    counter += 1
  }
  const copy: ModConfig = {
    ...clone(source),
    id: uid('mod'),
    name: copyName,
    targets: source.targets.map((target) => ({ ...clone(target), id: uid('target') })),
  }
  config.value.mods.push(copy)
  selectedId.value = copy.id
  showToast(`已复制为「${copyName}」，记得保存`)
}

function toggleMod(id: string) {
  const mod = config.value?.mods.find((item) => item.id === id)
  if (mod) mod.enabled = mod.enabled === false
}

function selectMod(id: string) {
  selectedId.value = id
}

/* ---------------- 生命周期 ---------------- */

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (dirty.value) void save()
    else showToast('没有需要保存的修改')
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  try {
    health.value = await api.health()
  } catch {
    log('warn', '界面', '没有连上本地后端服务（开发模式下请用 npm run dev:all 启动）。')
  }
  await reload()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (waitTimer) clearInterval(waitTimer)
  if (toastTimer) clearTimeout(toastTimer)
  cancelUpdate()
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo">◈</span>
        <div class="brand-text">
          <div class="brand-title">STS2 MOD 更新工具</div>
          <div class="brand-sub">
            <template v-if="config">
              {{ config.mods.length }} 个 MOD · 启用 {{ enabledCount }} 个
              <template v-if="health"> · 后端 {{ health.node }}</template>
            </template>
            <template v-else-if="loading">读取配置中…</template>
            <template v-else>未连接</template>
          </div>
        </div>
      </div>

      <span class="grow" />

      <span v-if="dirty" class="dirty" title="配置改了但还没保存">● 未保存</span>

      <button class="btn btn-sm" :disabled="saving || !config" @click="save">
        <span v-if="saving" class="spinner" />
        <span v-else>保存配置</span>
      </button>
      <button class="btn btn-sm" @click="showSettings = true" :disabled="!config">设置</button>
      <button class="btn btn-sm" :disabled="loading" @click="reload">刷新</button>
      <button class="btn btn-sm" :disabled="running || !config" title="只打印计划，不复制、不执行脚本" @click="startUpdate([], true)">
        试运行
      </button>
      <button class="btn btn-primary" :disabled="running || !config" @click="startUpdate()">
        <span v-if="running" class="spinner" />
        <span v-else>一键更新</span>
      </button>
    </header>

    <div v-if="loadError" class="banner error">
      连不上本地服务：{{ loadError }}
      <button class="btn btn-sm" @click="reload">重试</button>
    </div>

    <main class="body" :class="{ 'no-side': !config }" :style="{ '--sbw': `${sidebarWidth}px` }">
      <ModSidebar
        v-if="config"
        :mods="config.mods"
        :selected-id="selectedId"
        @select="selectMod"
        @add="openAdd"
        @remove="removeMod"
        @toggle="toggleMod"
      />

      <!-- 左右分栏的拖拽条：拖动改列表宽度，双击恢复默认 -->
      <div
        v-if="config"
        class="splitter-v"
        :class="{ active: dragKind === 'side' }"
        title="拖动调整左侧宽度，双击恢复默认"
        @pointerdown="startDrag('side', $event)"
        @dblclick="resetDrag('side')"
      />

      <ModEditor
        v-if="config && selectedMod"
        :key="selectedMod.id"
        :mod="selectedMod"
        :global="config.global"
        @remove="removeMod(selectedMod.id)"
        @duplicate="duplicateMod"
        @update-mod="startUpdate([selectedMod.id])"
      />

      <div v-else-if="!loading" class="empty">
        <div class="empty-inner">
          <div class="empty-icon">◈</div>
          <h2>{{ config ? '还没有选中的 MOD' : '欢迎使用' }}</h2>
          <p v-if="config && !config.mods.length" class="muted">
            左边还没有任何 MOD。点「＋ 新增」创建第一个，路径会按模板自动填好。
          </p>
          <p v-else class="muted">从左边选一个 MOD 开始编辑。</p>
          <button v-if="config && !config.mods.length" class="btn btn-primary" @click="openAdd">＋ 新增 MOD</button>
        </div>
      </div>
    </main>

    <!-- 日志栏上方的拖拽条：上下拖动改高度，双击恢复默认 -->
    <div
      v-if="logOpen"
      class="splitter-h"
      :class="{ active: dragKind === 'log' }"
      title="拖动调整日志高度，双击恢复默认"
      @pointerdown="startDrag('log', $event)"
      @dblclick="resetDrag('log')"
    />

    <LogPanel
      :logs="logs"
      :running="running"
      :open="logOpen"
      :height="logHeight"
      :resizing="dragKind === 'log'"
      @clear="logs = []"
      @cancel="cancelUpdate"
      @toggle="logOpen = !logOpen"
    />

    <SettingsDrawer v-if="config" :config="config" :open="showSettings" @close="showSettings = false" />

    <!-- 新增 MOD 对话框：路径都能自己挑 -->
    <NewModDialog
      v-if="adding && config"
      :templates="config.templates"
      :existing-names="config.mods.map((item) => item.name)"
      @create="onCreateMod"
      @close="adding = false"
    />

    <!-- 需要用户操作时的提示框（例如 Steam 手机确认登录） -->
    <div v-if="actionAlert" class="overlay" @click.self="actionAlert = null">
      <div class="dialog action-dialog fade-in">
        <div class="action-head">
          <span class="action-dot" />
          <h3>需要你在手机上操作</h3>
        </div>
        <p class="action-text">{{ actionAlert.text }}</p>
        <div class="action-tip">
          <template v-if="waited < CONFIRM_LIMIT">
            已等待 <b>{{ waited }}</b> 秒，steamcmd 大约 {{ CONFIRM_LIMIT }} 秒就会放弃这次登录。
          </template>
          <template v-else>
            已经等了 {{ waited }} 秒还没确认，这次登录多半已经超时，失败后重新点一次更新即可。
          </template>
        </div>
        <div class="action-tip">更新流程还在后台继续跑，不会中断；确认完成后日志里会继续输出结果。</div>
        <div class="dialog-foot">
          <span class="grow" />
          <button class="btn btn-primary" @click="actionAlert = null">知道了</button>
        </div>
      </div>
    </div>

    <transition name="toast">
      <div v-if="toast" class="toast" :class="{ error: toastError }">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  flex: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 20px;
  color: var(--accent);
  line-height: 1;
}

.brand-title {
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.brand-sub {
  font-size: 11px;
  color: var(--muted);
}

.dirty {
  font-size: 11.5px;
  color: var(--warn);
}

.body {
  flex: 1;
  display: grid;
  grid-template-columns: var(--sbw, 272px) 6px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

/* 没有配置时（欢迎页）不显示左侧栏，也就没有拖拽条 */
.body.no-side {
  grid-template-columns: minmax(0, 1fr);
}

/* ---- 分隔条 ---- */
.splitter-v {
  position: relative;
  cursor: col-resize;
  background: transparent;
  touch-action: none;
}

.splitter-v::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--border);
  transition: background 0.15s, width 0.15s;
}

.splitter-v:hover::after,
.splitter-v.active::after {
  width: 3px;
  background: var(--accent);
}

.splitter-h {
  position: relative;
  height: 6px;
  flex: none;
  cursor: row-resize;
  background: transparent;
  touch-action: none;
}

.splitter-h::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-50%);
  background: var(--border);
  transition: background 0.15s, height 0.15s;
}

.splitter-h:hover::after,
.splitter-h.active::after {
  height: 3px;
  background: var(--accent);
}

/* 拖动期间：全局光标 + 禁止选中文字，不然会一路把界面刷蓝 */
:global(body.dragging-col),
:global(body.dragging-col *) {
  cursor: col-resize !important;
  user-select: none !important;
}

:global(body.dragging-row),
:global(body.dragging-row *) {
  cursor: row-resize !important;
  user-select: none !important;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-inner {
  text-align: center;
  max-width: 420px;
}

.empty-icon {
  font-size: 42px;
  color: #2b3444;
  margin-bottom: 8px;
}

.empty-inner h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  font-size: 12px;
  flex: none;
}

.banner.error {
  background: rgba(255, 95, 109, 0.12);
  color: var(--error);
  border-bottom: 1px solid rgba(255, 95, 109, 0.25);
}

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
  width: 520px;
  max-width: 92vw;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog h3 {
  margin: 0;
  font-size: 14px;
}

/* ---- 需要用户操作的提示框 ---- */
.action-dialog {
  border-color: rgba(245, 165, 36, 0.55);
  box-shadow: 0 0 0 1px rgba(245, 165, 36, 0.15), 0 20px 60px rgba(0, 0, 0, 0.6);
}

.action-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--warn);
  box-shadow: 0 0 0 0 rgba(245, 165, 36, 0.7);
  animation: action-pulse 1.4s ease-out infinite;
}

@keyframes action-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 165, 36, 0.6);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(245, 165, 36, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 165, 36, 0);
  }
}

.action-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}

.action-tip {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.dialog-foot {
  display: flex;
  gap: 8px;
}

.toast {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  background: #202836;
  border: 1px solid #33415a;
  color: var(--text);
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 12.5px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  z-index: 80;
}

.toast.error {
  border-color: rgba(255, 95, 109, 0.5);
  color: #ffb3b8;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
