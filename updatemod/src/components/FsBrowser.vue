<script setup lang="ts">
/**
 * 内置文件浏览器
 * ------------------------------------------------------------------
 * 原本这里调的是 Windows 原生对话框，但那个对话框由后台服务进程创建，
 * 常常被浏览器窗口挡在下面（看起来像"点了没反应"），所以改成页面内的选择器：
 * 后端只负责列目录（/api/fs），界面自己画列表，绝不会被遮挡。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '@/lib/api'
import { formatSize } from '@/lib/format'
import type { DirEntry } from '@/lib/types'

const props = withDefaults(
  defineProps<{
    mode?: 'folder' | 'file'
    title?: string
    initialPath?: string
    /** 文件模式下只显示这些扩展名，例如 ['.dll', '.pck']；留空表示不过滤 */
    extensions?: string[]
    /** 文件模式下是否允许多选（只影响提示，选择仍返回第一个） */
    multi?: boolean
  }>(),
  {
    mode: 'folder',
    title: '选择文件夹',
    initialPath: '',
    extensions: () => [],
    multi: false,
  },
)

const emit = defineEmits<{ (e: 'select', value: string): void; (e: 'close'): void }>()

const current = ref('')
const parent = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const selected = ref('')
const pathInput = ref('')

const visible = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return entries.value.filter((entry) => {
    // 文件模式下按扩展名过滤（目录永远保留，用来导航）
    if (props.mode === 'file' && !entry.isDir && props.extensions.length) {
      const lower = entry.name.toLowerCase()
      if (!props.extensions.some((ext) => lower.endsWith(ext.toLowerCase()))) return false
    }
    return kw ? entry.name.toLowerCase().includes(kw) : true
  })
})

const folderCount = computed(() => entries.value.filter((entry) => entry.isDir).length)
const selectedName = computed(() => {
  if (props.mode === 'folder') return current.value
  return selected.value
})

async function load(target: string) {
  loading.value = true
  error.value = ''
  try {
    const listing = await api.listDir(target)
    if (!listing.exists || !listing.isDir) {
      error.value = listing.error || `打不开这个目录：${target || '(我的电脑)'}`
      return
    }
    current.value = listing.path
    parent.value = listing.parent ?? ''
    pathInput.value = listing.path
    entries.value = listing.entries ?? []
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

/** 打开时尽量定位到当前值：是文件就跳到它所在目录并选中 */
async function openInitial() {
  const start = (props.initialPath || '').trim()
  if (!start) {
    await load('')
    return
  }
  try {
    const info = await api.listDir(start)
    if (info.exists && !info.isDir) {
      await load(info.parent || '')
      if (props.mode === 'file') selected.value = start
      if (props.mode === 'folder') current.value = info.parent || ''
      return
    }
    if (info.exists && info.isDir) {
      await load(start)
      return
    }
  } catch {
    /* 落到默认层 */
  }
  await load('')
}

function enter(entry: DirEntry) {
  if (entry.isDir) {
    load(entry.path)
    return
  }
  if (props.mode === 'file') selected.value = entry.path
}

function goUp() {
  load(parent.value)
}

function jump() {
  const target = pathInput.value.trim()
  if (target) load(target)
}

function confirm() {
  if (props.mode === 'folder') {
    if (current.value) emit('select', current.value)
    return
  }
  if (selected.value) emit('select', selected.value)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (event.key === 'Enter' && !(event.target instanceof HTMLInputElement)) {
    event.preventDefault()
    confirm()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  openInitial()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div class="fs-mask">
      <div class="fs-panel" tabindex="-1">
        <div class="fs-head">
          <strong>{{ title }}</strong>
          <button class="btn btn-sm btn-icon" title="关闭（Esc）" @click="emit('close')">✕</button>
        </div>

        <div class="fs-bar">
          <button class="btn btn-sm" :disabled="!parent" title="上一级" @click="goUp">↑ 上一级</button>
          <button class="btn btn-sm" title="列出所有盘符" @click="load('')">此电脑</button>
          <input
            v-model="pathInput"
            class="input mono grow"
            spellcheck="false"
            placeholder="直接粘贴路径后按回车"
            @keydown.enter.prevent="jump"
          />
          <button class="btn btn-sm" @click="jump">前往</button>
        </div>

        <div class="fs-tools">
          <input v-model="keyword" class="input" placeholder="按名称筛选…" />
          <span class="fs-hint">{{ folderCount }} 个文件夹 / {{ entries.length }} 项</span>
          <span v-if="loading" class="spinner" />
        </div>

        <div v-if="error" class="fs-error">{{ error }}</div>

        <div class="fs-list">
          <div
            v-for="entry in visible"
            :key="entry.path"
            class="fs-item"
            :class="{ 'is-dir': entry.isDir, 'is-selected': entry.path === selected }"
            :title="entry.path"
            @click="enter(entry)"
          >
            <span class="fs-icon">{{ entry.isDir ? '📁' : '📄' }}</span>
            <span class="fs-name grow">{{ entry.name }}</span>
            <span v-if="!entry.isDir" class="fs-size">{{ formatSize(entry.size) }}</span>
          </div>
          <div v-if="!visible.length && !loading" class="fs-empty">
            {{ current ? '这个目录里没有可选项' : '正在读取盘符…' }}
          </div>
        </div>

        <div class="fs-foot">
          <div class="fs-current mono" :title="selectedName">
            {{ mode === 'folder' ? '当前目录：' : '已选择：' }}{{ selectedName || '（未选择）' }}
          </div>
          <div class="row">
            <button class="btn btn-sm" @click="emit('close')">取消</button>
            <button
              class="btn btn-sm btn-primary"
              :disabled="mode === 'folder' ? !current : !selected"
              @click="confirm"
            >
              {{ mode === 'folder' ? '用这个文件夹' : '选择这个文件' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fs-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.fs-panel {
  width: min(820px, 92vw);
  height: min(640px, 86vh);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--bg-panel, #151922);
  border: 1px solid var(--border, #2a3040);
  border-radius: 10px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  outline: none;
}

.fs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.fs-bar,
.fs-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fs-tools .input {
  width: 200px;
}

.fs-hint {
  font-size: 12px;
  color: var(--text-dim, #8b93a7);
  margin-left: auto;
}

.fs-error {
  font-size: 12px;
  color: var(--error, #ff5f6d);
  padding: 4px 6px;
  background: rgba(255, 95, 109, 0.08);
  border-radius: 6px;
}

.fs-list {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border, #2a3040);
  border-radius: 8px;
  background: var(--bg, #0e1014);
}

.fs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12.5px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.fs-item:hover {
  background: rgba(79, 140, 255, 0.12);
}

.fs-item.is-selected {
  background: rgba(79, 140, 255, 0.22);
}

.fs-icon {
  width: 16px;
  text-align: center;
}

.fs-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-size {
  font-size: 11.5px;
  color: var(--text-dim, #8b93a7);
}

.fs-empty {
  padding: 18px;
  font-size: 12px;
  color: var(--text-dim, #8b93a7);
  text-align: center;
}

.fs-foot {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fs-current {
  flex: 1;
  font-size: 11.5px;
  color: var(--text-dim, #8b93a7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
