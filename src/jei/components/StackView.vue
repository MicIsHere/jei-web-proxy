<template>
  <div class="stack-view" :class="{ 'stack-view--clickable': clickable }" @click="onClick">
    <div class="stack-view__main">
      <q-img v-if="iconSrc" :src="iconSrc" :ratio="1" fit="contain" class="stack-view__icon" />
      <q-icon v-else :name="fallbackIcon" size="22px" class="stack-view__icon-fallback" />
      <div class="stack-view__text">
        <div class="stack-view__name">{{ displayName }}</div>
        <div class="stack-view__sub">{{ subtitle }}</div>
      </div>
    </div>
    <q-badge v-if="badgeText" color="primary" class="stack-view__badge">{{ badgeText }}</q-badge>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef, ItemKey, SlotContent, Stack } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';

const props = defineProps<{
  content: SlotContent | undefined;
  itemDefsByKeyHash: Record<string, ItemDef>;
}>();

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
}>();

const stacks = computed<Stack[]>(() => {
  if (!props.content) return [];
  return Array.isArray(props.content) ? props.content : [props.content];
});

const stack = computed<Stack | undefined>(() => stacks.value[0]);

const clickable = computed(() => stack.value?.kind === 'item');

const badgeText = computed(() => {
  if (stacks.value.length > 1) return `+${stacks.value.length - 1}`;
  return '';
});

const iconSrc = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  return def?.icon ?? '';
});

const displayName = computed(() => {
  const s = stack.value;
  if (!s) return '';
  if (s.kind === 'item') {
    const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
    return def?.name ?? s.id;
  }
  if (s.kind === 'fluid') return s.id;
  return s.id;
});

const subtitle = computed(() => {
  const s = stack.value;
  if (!s) return '';
  const unit = s.unit ?? (s.kind === 'fluid' ? 'mB' : '');
  const amountText = unit ? `${s.amount}${unit}` : `${s.amount}`;
  if (s.kind === 'tag') return `${amountText} · tag`;
  if (s.kind === 'fluid') return `${amountText} · fluid`;
  return amountText;
});

const fallbackIcon = computed(() => {
  const s = stack.value;
  if (!s) return 'help';
  if (s.kind === 'fluid') return 'water_drop';
  if (s.kind === 'tag') return 'sell';
  return 'inventory_2';
});

function stackItemKeyHash(s: { id: string; meta?: number | string; nbt?: unknown }): string {
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  return itemKeyHash(key);
}

function onClick() {
  const s = stack.value;
  if (!s || s.kind !== 'item') return;
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  emit('item-click', key);
}
</script>

<style scoped>
.stack-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.stack-view--clickable {
  cursor: pointer;
}

.stack-view--clickable:hover .stack-view__name {
  text-decoration: underline;
}

.stack-view__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stack-view__icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
}

.stack-view__icon-fallback {
  width: 28px;
  height: 28px;
}

.stack-view__text {
  min-width: 0;
}

.stack-view__name {
  font-size: 12px;
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.stack-view__sub {
  font-size: 11px;
  opacity: 0.7;
  line-height: 13px;
}

.stack-view__badge {
  flex: 0 0 auto;
}
</style>
