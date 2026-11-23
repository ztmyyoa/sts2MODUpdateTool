<script setup lang="ts">
/**
 * JSON 编辑器
 * 读的是配置里那个 jsonPath 的真实文件，改完点保存会直接写回磁盘。
 * 保存前会先做一次 JSON 语法校验，格式错误不会写进去。
 */
import { computed, ref, watch } from 'vue'
import { api } from '@/lib/api'

const props = defineProps<{ path: string }>()

const content = ref('')
const original = ref('')
const exists = ref(false)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageOk = ref(true)

const dirty = computed(() => content.value !== original.value)

const validation = computed<{ ok: boolean; text: string }>(() => {
  if (!content.value.trim()) return { ok: false, text: '内容为空' }
  try {
    JSON.parse(content.value)
    return { ok: true, text: 'JSON 格式正确' }
  } catch (err) {
    return { ok: false, text: `语法错误：${(err as Error).message}` }
  }
})

async function load() {
  message.value = ''
  if (!props.path) {
    content.value = ''
    original.value = ''
    exists.value = false
    return
  }
  loading.value = true
  try {
    const result = await api.readJson(props.path)
    exists.value = result.exists
    if (result.exists) {
      content.value = result.content
      original.value = result.content
    } else {
      content.value = ''
      original.value = ''
      message.value = result.error ? `读取失败：${result.error}` : '文件还不存在，保存后会新建。'
      messageOk.value = false
    }
  } catch (err) {
    message.value = (err as Error).message
    messageOk.value = false
  } finally {
    loading.value = false
  }
}

function formatJson() {
  if (!validation.value.ok) return
  content.value = JSON.stringify(JSON.parse(content.value), null, 2)
}

async function save() {
  if (!props.path) {
    message.value = '还没设置 JSON 路径。'
    messageOk.value = false
    return
  }
  if (!validation.value.ok) {
    message.value = `无法保存：${validation.value.text}`
    messageOk.value = false
    return
  }
  saving.value = true
  message.value = ''
  try {
    await api.saveJson(props.path, content.value)
    const result = await api.readJson(props.path)
    content.value = result.content
    original.value = result.content
    exists.value = true
    message.value = '已保存到磁盘。'
    messageOk.value = true
  } catch (err) {
    message.value = (err as Error).message
    messageOk.value = false
  } finally {
    saving.value = false
  }
}

function reset() {
  content.value = original.value
  message.value = ''
}

async function revealFile() {
  if (!props.path) return
  try {
    await api.reveal(props.path)
  } catch (err) {
    message.value = (err as Error).message
    messageOk.value = false
  }
}

watch(() => props.path, load, { immediate: true })
</script>

<template>
  <div class="json-editor">
    <div class="toolbar">
      <span class="mono path">{{ path || '（未设置 JSON 路径）' }}</span>
      <span v-if="exists" class="tag ok">已存在</span>
      <span v-else class="tag warn">不存在</span>
      <span class="grow" />
      <button class="btn btn-sm" :disabled="loading" @click="load">重新读取</button>
      <button class="btn btn-sm" :disabled="!validation.ok" @click="formatJson">格式化</button>
      <button class="btn btn-sm" :disabled="!path" @click="revealFile">打开位置</button>
      <button class="btn btn-sm" :disabled="!dirty" @click="reset">还原</button>
      <button
        class="btn btn-sm btn-primary"
        :disabled="saving || !dirty || !validation.ok"
        @click="save"
      >
        <span v-if="saving" class="spinner" />
        <span v-else>保存</span>
      </button>
    </div>

    <div v-if="loading" class="placeholder">读取中…</div>
    <textarea
      v-else
      v-model="content"
      class="textarea code"
      spellcheck="false"
      placeholder="这个文件还不存在。可以直接在这里写 JSON，保存时会创建。"
      @keydown.ctrl.s.prevent="save"
      @keydown.meta.s.prevent="save"
    />

    <div class="status">
      <span :class="validation.ok ? 'ok-text' : 'error-text'">
        {{ validation.ok ? '✓' : '✗' }}
        {{ validation.text }}
      </span>
      <span v-if="dirty" class="warn-text">· 有未保存的修改</span>
      <span v-if="message" :class="messageOk ? 'ok-text' : 'error-text'">· {{ message }}</span>
      <span class="grow" />
      <span class="muted">Ctrl+S 保存</span>
    </div>
  </div>
</template>

<style scoped>
.json-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.path {
  font-size: 11.5px;
  color: var(--text-dim);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 20px;
  border: 1px solid transparent;
}

.tag.ok {
  color: var(--ok);
  background: rgba(62, 207, 142, 0.12);
  border-color: rgba(62, 207, 142, 0.3);
}

.tag.warn {
  color: var(--warn);
  background: rgba(245, 165, 36, 0.12);
  border-color: rgba(245, 165, 36, 0.3);
}

.code {
  min-height: 420px;
  flex: 1;
  tab-size: 2;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  flex-wrap: wrap;
}

.placeholder {
  padding: 30px;
  text-align: center;
  color: var(--muted);
}
</style>
