<script setup lang="ts">
/** 一个“输出目标”的编辑卡片（SteamMOD 目录 / GitHub 目录 / 以后想加的其它目录） */
import PathInput from './PathInput.vue'
import type { TargetConfig } from '@/lib/types'

defineProps<{ target: TargetConfig; index: number }>()

const emit = defineEmits<{ (e: 'remove'): void }>()
</script>

<template>
  <div class="target-card" :class="{ off: target.enabled === false }">
    <div class="target-head">
      <input v-model="target.label" class="input name" placeholder="目标名称，例如 SteamMOD" spellcheck="false" />
      <label class="check">
        <input v-model="target.enabled" type="checkbox" />
        启用
      </label>
      <button class="btn btn-sm btn-danger" title="删除这个目标" @click="emit('remove')">删除</button>
    </div>

    <PathInput
      v-model="target.dir"
      label="目标目录"
      placeholder="文件会被复制到这个目录"
      hint="目录不存在时会自动创建"
    />

    <PathInput
      v-model="target.script"
      label="更新脚本（可选）"
      kind="file"
      :extensions="['.bat', '.cmd', '.ps1']"
      placeholder="复制完成后要执行的 .bat，留空则不执行"
      hint="脚本会在它自己所在的目录里执行，输出会实时显示在下方日志里"
    />

    <div class="row-wrap">
      <label class="check"><input v-model="target.copyDll" type="checkbox" /> 复制 DLL</label>
      <label class="check"><input v-model="target.copyPck" type="checkbox" /> 复制 PCK</label>
      <label class="check"><input v-model="target.copyJson" type="checkbox" /> 复制 JSON</label>
    </div>
  </div>
</template>

<style scoped>
.target-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-panel-2);
}

.target-card.off {
  opacity: 0.6;
}

.target-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  flex: 1;
  font-weight: 600;
  max-width: 260px;
}

.target-head .btn {
  margin-left: auto;
}
</style>
