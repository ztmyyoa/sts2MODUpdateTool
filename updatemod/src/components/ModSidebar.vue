<script setup lang="ts">
/** 左侧 MOD 列表（带搜索：这就是增删改查里的「查」） */
import { computed, ref } from 'vue'
import type { ModConfig } from '@/lib/types'

const props = defineProps<{ mods: ModConfig[]; selectedId: string }>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
  (e: 'remove', id: string): void
  (e: 'toggle', id: string): void
}>()

function enabledTargets(mod: ModConfig): number {
  return mod.targets.filter((t) => t.enabled !== false).length
}

const enabledCount = () => props.mods.filter((m) => m.enabled !== false).length

const keyword = ref('')

/** 名字、DLL 名、目标目录都能搜 */
const visibleMods = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.mods
  return props.mods.filter((mod) => {
    const haystack = [mod.name, mod.dllName, mod.sourceDir, ...mod.targets.map((t) => t.dir)]
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <span class="title">MOD 列表</span>
      <button class="btn btn-sm" title="新增一个 MOD" @click="emit('add')">＋ 新增</button>
    </div>

    <div class="search">
      <input v-model="keyword" class="input" placeholder="搜索名称 / DLL / 目录…" spellcheck="false" />
      <button v-if="keyword" class="clear" title="清空搜索" @click="keyword = ''">✕</button>
    </div>

    <div class="list">
      <div
        v-for="mod in visibleMods"
        :key="mod.id"
        class="mod-item"
        :class="{ active: mod.id === selectedId, off: mod.enabled === false }"
        @click="emit('select', mod.id)"
      >
        <input
          class="switcher"
          type="checkbox"
          :checked="mod.enabled !== false"
          title="是否参与“一键更新”（不勾选则整个 MOD 被忽略）"
          @click.stop
          @change="emit('toggle', mod.id)"
        />
        <div class="mod-main">
          <div class="mod-name">{{ mod.name }}</div>
          <div class="mod-sub">
            <span class="mono">{{ mod.dllName || 'DLL 未设置' }}</span>
            <span class="dot">·</span>
            <span>{{ enabledTargets(mod) }} 个目标</span>
            <span v-if="mod.pckFiles.length" class="dot">·</span>
            <span v-if="mod.pckFiles.length">{{ mod.pckFiles.length }} 个 PCK</span>
          </div>
        </div>
        <button class="remove" title="删除这个 MOD 的配置" @click.stop="emit('remove', mod.id)">✕</button>
      </div>

      <div v-if="!mods.length" class="empty">
        还没有 MOD。<br />
        点上面的「＋ 新增」加一个。
      </div>
      <div v-else-if="!visibleMods.length" class="empty">
        没有匹配「{{ keyword }}」的 MOD。<br />
        点搜索框右边的 ✕ 清空。
      </div>
    </div>

    <div class="sidebar-foot muted">
      共 {{ mods.length }} 个，启用 {{ enabledCount() }} 个
      <span v-if="keyword">，匹配 {{ visibleMods.length }} 个</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.title {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  text-transform: uppercase;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.search {
  position: relative;
  padding: 8px 12px 2px;
}

.search .input {
  padding-right: 26px;
  font-size: 12px;
}

.search .clear {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-30%);
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
}

.search .clear:hover {
  color: var(--text-dim);
}

.mod-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s;
}

.mod-item:hover {
  background: var(--bg-hover);
}

.mod-item.active {
  background: var(--accent-soft);
  border-color: rgba(79, 140, 255, 0.45);
}

.mod-item.off {
  opacity: 0.5;
}

.switcher {
  margin-top: 3px;
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
  cursor: pointer;
  flex: none;
}

.mod-main {
  flex: 1;
  min-width: 0;
}

.mod-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mod-sub {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  margin: 0 4px;
}

.remove {
  flex: none;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 3px 4px;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}

.mod-item:hover .remove {
  opacity: 1;
}

.remove:hover {
  color: var(--error);
  background: rgba(255, 95, 109, 0.12);
}

.empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}

.sidebar-foot {
  padding: 8px 12px;
  border-top: 1px solid var(--border-soft);
  font-size: 11px;
}
</style>
