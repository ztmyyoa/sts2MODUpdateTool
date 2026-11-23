<script setup lang="ts">
/** 全局设置抽屉：Workshop 目录、脚本超时、以及“新建 MOD 时的路径模板” */
import { computed } from 'vue'
import PathInput from './PathInput.vue'
import type { AppConfig } from '@/lib/types'

const props = defineProps<{ config: AppConfig; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const timeoutSeconds = computed({
  get: () => Math.round((props.config.global.scriptTimeoutMs || 600000) / 1000),
  set: (value: number) => {
    const seconds = Number(value)
    props.config.global.scriptTimeoutMs = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 600000
  },
})

const tpl = computed(() => props.config.templates)
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="drawer fade-in">
      <header class="drawer-head">
        <strong>全局设置</strong>
        <button class="btn btn-sm" @click="emit('close')">关闭</button>
      </header>

      <div class="drawer-body">
        <section class="section">
          <h3>通用</h3>
          <PathInput
            v-model="config.global.workshopDir"
            label="Steam 创意工坊目录"
            hint="MOD 的 .pck 一般从这里取：D:\steam\steamapps\workshop\content\2868840"
          />
          <div class="field">
            <label class="field-label">脚本最长执行时间（秒）</label>
            <input v-model.number="timeoutSeconds" class="input" type="number" min="10" step="10" />
            <div class="field-hint">超时后会自动结束脚本进程，避免卡死。</div>
          </div>
          <label class="check">
            <input v-model="config.global.openBrowser" type="checkbox" />
            启动服务后自动打开浏览器
          </label>
        </section>

        <section class="section">
          <h3>新建 MOD 时的路径模板</h3>
          <p class="field-hint">
            用 <code>{mod}</code> 代表 MOD 名称。以后加新 MOD 时，这些路径会自动填好，省得一条条选。
          </p>

          <PathInput v-model="tpl.sourceDir" label="源 MOD 目录" hint="例如 D:\stsmod\stsmods\{mod}" />
          <div class="field">
            <label class="field-label">DLL 相对子目录</label>
            <input v-model="tpl.dllSubPath" class="input mono" spellcheck="false" />
            <div class="field-hint">相对于源 MOD 目录，通常是 .godot\mono\temp\bin\Debug</div>
          </div>
          <PathInput v-model="tpl.pckSourceDir" label="PCK 来源目录（默认）" hint="留空则用上面的创意工坊目录" />

          <div class="divider" />

          <PathInput v-model="tpl.steamPaksDir" label="SteamMOD 的 paks 目录" hint="D:\stsmod\modmaker\SteamMOD\{mod}\paks" />
          <PathInput v-model="tpl.steamScript" label="Steam 更新脚本" kind="file" :extensions="['.bat']" />
          <PathInput v-model="tpl.githubDir" label="GitHub 仓库目录" hint="D:\stsmod\SlayTheSpire2MODs\mods_finished\{mod}" />
          <PathInput
            v-model="tpl.githubScript"
            label="GitHub 更新脚本"
            kind="file"
            :extensions="['.bat']"
            hint="例如 ...\{mod}\{mod}mod.bat"
          />
          <PathInput v-model="tpl.jsonPath" label="JSON 模板路径" hint="D:\stsmod\modmaker\SteamMOD\{mod}\paks\{mod}.json" />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: flex-end;
  z-index: 50;
}

.drawer {
  width: 560px;
  max-width: 92vw;
  height: 100%;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-soft);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  text-transform: uppercase;
}

code {
  background: var(--bg-input);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: var(--mono);
}
</style>
