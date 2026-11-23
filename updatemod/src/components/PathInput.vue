<script setup lang="ts">
/**
 * 带“选择…/打开/复制”按钮的路径输入框
 * 选择按钮打开的是页面内置的文件浏览器（FsBrowser），
 * 因为它不会被浏览器窗口挡住，而且能直接返回真实的绝对路径。
 */
import { ref } from 'vue'
import { api } from '@/lib/api'
import FsBrowser from './FsBrowser.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    kind?: 'folder' | 'file'
    title?: string
    /** 文件模式下限制的扩展名，例如 ['.json', '.dll'] */
    extensions?: string[]
    hint?: string
    disabled?: boolean
    showOpen?: boolean
  }>(),
  {
    label: '',
    placeholder: '',
    kind: 'folder',
    title: '',
    extensions: () => [],
    hint: '',
    disabled: false,
    showOpen: true,
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const browsing = ref(false)
const error = ref('')

function choose() {
  if (props.disabled || browsing.value) return
  error.value = ''
  browsing.value = true
}

function onSelect(value: string) {
  browsing.value = false
  if (value) emit('update:modelValue', value)
}

async function openInExplorer() {
  const target = props.modelValue.trim()
  if (!target) return
  try {
    await api.reveal(target)
  } catch (err) {
    error.value = (err as Error).message
  }
}

function copyPath() {
  const target = props.modelValue.trim()
  if (!target) return
  if (navigator.clipboard) navigator.clipboard.writeText(target).catch(() => {})
}
</script>

<template>
  <div class="field">
    <label v-if="label" class="field-label">{{ label }}</label>
    <div class="row">
      <input
        :value="modelValue"
        class="input grow mono"
        :placeholder="placeholder"
        :disabled="disabled"
        spellcheck="false"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button class="btn btn-sm" :disabled="disabled" title="打开文件浏览器" @click="choose">选择…</button>
      <button
        v-if="showOpen"
        class="btn btn-sm"
        :disabled="disabled || !modelValue"
        title="在资源管理器里打开"
        @click="openInExplorer"
      >
        打开
      </button>
      <button class="btn btn-sm btn-icon" :disabled="!modelValue" title="复制路径" @click="copyPath">⧉</button>
    </div>
    <div v-if="hint" class="field-hint">{{ hint }}</div>
    <div v-if="error" class="field-hint error-text">{{ error }}</div>

    <FsBrowser
      v-if="browsing"
      :mode="kind"
      :title="title || label || (kind === 'folder' ? '选择文件夹' : '选择文件')"
      :initial-path="modelValue"
      :extensions="extensions"
      @select="onSelect"
      @close="browsing = false"
    />
  </div>
</template>

<style scoped>
input {
  font-size: 12px;
}
</style>
