<script setup lang="ts">
/** 底部日志面板：显示后端推送过来的实时日志 */
import { computed, nextTick, ref, watch } from 'vue'
import type { LogEvent } from '@/lib/types'
import { formatClock } from '@/lib/format'

const props = defineProps<{
  logs: LogEvent[]
  running: boolean
  open: boolean
  height: number
  /** 正在被拖动：暂时关掉高度过渡动画 */
  resizing?: boolean
}>()
const emit = defineEmits<{ (e: 'clear'): void; (e: 'cancel'): void; (e: 'toggle'): void }>()

const onlyProblems = ref(false)
const stick = ref(true)
const box = ref<HTMLElement | null>(null)

const MAX_RENDER = 2000

const visible = computed(() => {
  let list = props.logs
  if (onlyProblems.value) list = list.filter((l) => l.level === 'error' || l.level === 'warn')
  return list.length > MAX_RENDER ? list.slice(list.length - MAX_RENDER) : list
})

const counts = computed(() => {
  let errors = 0
  let warns = 0
  for (const log of props.logs) {
    if (log.level === 'error') errors++
    else if (log.level === 'warn') warns++
  }
  return { errors, warns }
})

function onScroll() {
  const el = box.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

async function scrollToBottom() {
  await nextTick()
  const el = box.value
  if (el && stick.value) el.scrollTop = el.scrollHeight
}

watch(
  () => props.logs.length,
  () => scrollToBottom(),
)
watch(
  () => props.open,
  (open) => {
    if (open) scrollToBottom()
  },
)
</script>

<template>
  <section
    class="log-panel"
    :class="{ collapsed: !open, resizing }"
    :style="{ height: open ? `${height}px` : '38px' }"
  >
    <header class="log-head" @click="emit('toggle')">
      <span class="chevron">{{ open ? '▾' : '▸' }}</span>
      <span class="log-title">运行日志</span>
      <span v-if="props.logs.length" class="counter">{{ props.logs.length }} 条</span>
      <span v-if="counts.errors" class="counter error-text">错误 {{ counts.errors }}</span>
      <span v-if="counts.warns" class="counter warn-text">警告 {{ counts.warns }}</span>
      <span v-if="running" class="running"><span class="spinner" /> 正在执行…</span>
      <span class="grow" />
      <label v-if="open" class="check" @click.stop>
        <input v-model="onlyProblems" type="checkbox" />
        只看问题
      </label>
      <button v-if="running" class="btn btn-sm btn-danger" @click.stop="emit('cancel')">中止</button>
      <button v-if="open" class="btn btn-sm" :disabled="!props.logs.length || running" @click.stop="emit('clear')">
        清空
      </button>
    </header>

    <div v-show="open" ref="box" class="log-body" @scroll="onScroll">
      <div v-if="!visible.length" class="log-empty">
        还没有日志。点右上角「一键更新」开始。
      </div>
      <div v-for="(log, index) in visible" :key="index" class="log-line" :class="`lv-${log.level}`">
        <span class="time mono">{{ formatClock(log.ts) }}</span>
        <span class="scope">{{ log.scope }}</span>
        <span class="text">{{ log.text }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  /* 高度由父组件拖动后传进来，默认 230px */
  transition: height 0.16s ease;
}

/* 拖动时去掉过渡，否则会“粘手” */
.log-panel.resizing {
  transition: none;
}

.log-panel.collapsed {
  height: 38px;
}

.log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  flex: none;
  min-height: 38px;
}

.chevron {
  color: var(--muted);
  font-size: 11px;
  width: 10px;
}

.log-title {
  font-size: 12px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  text-transform: uppercase;
}

.counter {
  font-size: 11px;
  color: var(--muted);
  background: var(--bg-panel-2);
  border-radius: 20px;
  padding: 0 8px;
}

.running {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--accent);
}

.running .spinner {
  border-color: rgba(79, 140, 255, 0.3);
  border-top-color: var(--accent);
}

.log-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 10px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.65;
}

.log-empty {
  color: var(--muted);
  padding: 12px 0;
  font-family: inherit;
}

.log-line {
  display: flex;
  gap: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.time {
  flex: none;
  color: var(--muted);
}

.scope {
  flex: none;
  color: #7f8aa3;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text {
  color: var(--text-dim);
}

.lv-ok .text {
  color: var(--ok);
}

.lv-warn .text {
  color: var(--warn);
}

.lv-error .text {
  color: var(--error);
}

.lv-step .text {
  color: var(--text);
  font-weight: 600;
}

.lv-plan .text {
  color: #7fa6ff;
}

.lv-script .text {
  color: #9aa5b8;
}

.lv-done .text {
  color: var(--accent);
}

/* 需要用户去操作的提醒：整行高亮，扫一眼就能看到 */
.lv-action .text {
  color: #ffd479;
  font-weight: 600;
  background: rgba(245, 165, 36, 0.12);
  border-left: 3px solid var(--warn);
  padding: 2px 8px;
  border-radius: 0 4px 4px 0;
  flex: 1;
}
</style>
